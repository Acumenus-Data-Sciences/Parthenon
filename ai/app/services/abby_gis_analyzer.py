"""Abby GIS column analyzer — Ollama + ChromaDB integration."""

import json
import logging
from typing import Any

import chromadb
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://ollama:11434"
CHROMA_COLLECTION = "gis_import_mappings"

ANALYZE_PROMPT = """You are Abby, a GIS data analysis assistant. Analyze these columns from a data file upload.

File: {filename}
Columns: {headers}
Sample data (first 20 rows):
{sample_rows}

Statistics:
{stats}

Previously seen patterns:
{similar_mappings}

For each column, determine:
1. Purpose: geography_code, geography_name, latitude, longitude, value, metadata, skip
2. If geography_code: what type? (fips_county, fips_tract, fips_state, iso_country, iso_subdivision, nuts, custom)
3. If value: what does it measure? Suggest an exposure_type name.
4. Confidence: 0.0 to 1.0
5. Reasoning: brief explanation

Respond ONLY with a JSON object:
{{"suggestions": [{{"column": "...", "purpose": "...", "geo_type": null, "exposure_type": null, "confidence": 0.9, "reasoning": "..."}}]}}"""


def _get_chroma_client() -> chromadb.Client:
    """Get or create ChromaDB client (persistent storage)."""
    return chromadb.PersistentClient(path="/app/data/chromadb")


def _get_collection(client: chromadb.Client) -> chromadb.Collection:
    """Get or create the GIS import mappings collection."""
    return client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def search_similar_mappings(headers: list[str]) -> list[dict[str, Any]]:
    """Search ChromaDB for similar column names from past imports."""
    try:
        client = _get_chroma_client()
        collection = _get_collection(client)

        if collection.count() == 0:
            return []

        results = collection.query(
            query_texts=headers,
            n_results=min(3, collection.count()),
        )

        mappings = []
        if results and results.get("documents"):
            for docs in results["documents"]:
                for doc in docs:
                    try:
                        mappings.append(json.loads(doc))
                    except json.JSONDecodeError:
                        pass

        return mappings
    except Exception as e:
        logger.warning(f"ChromaDB search failed: {e}")
        return []


async def analyze_columns(
    filename: str,
    headers: list[str],
    sample_rows: list[dict[str, Any]],
    column_stats: dict[str, Any],
) -> dict[str, Any]:
    """Analyze columns using Ollama + ChromaDB."""

    # Search for similar past mappings
    similar = search_similar_mappings(headers)

    prompt = ANALYZE_PROMPT.format(
        filename=filename,
        headers=json.dumps(headers),
        sample_rows=json.dumps(sample_rows[:10], indent=2),
        stats=json.dumps(column_stats, indent=2),
        similar_mappings=json.dumps(similar, indent=2) if similar else "None found",
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "MedAIBase/MedGemma1.5:4b",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            resp.raise_for_status()

            result = resp.json()
            response_text = result.get("response", "")

            parsed = json.loads(response_text)
            return {"suggestions": parsed.get("suggestions", []), "source": "abby"}

    except Exception as e:
        logger.warning(f"Ollama analysis failed: {e}")
        return {"suggestions": [], "source": "error", "error": str(e)}


async def ask_about_column(
    column_name: str,
    sample_values: list[Any],
    stats: dict[str, Any],
    question: str,
) -> dict[str, Any]:
    """Ask Abby about a specific column."""
    prompt = f"""You are Abby, a GIS data analysis assistant.

Column: {column_name}
Sample values: {json.dumps(sample_values[:10])}
Statistics: {json.dumps(stats)}

User question: {question}

Answer concisely and helpfully."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "MedAIBase/MedGemma1.5:4b",
                    "prompt": prompt,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return {"answer": resp.json().get("response", "")}
    except Exception as e:
        return {"answer": f"Abby is unavailable: {e}"}


def store_confirmed_mappings(mappings: list[dict[str, Any]]) -> int:
    """Store user-confirmed mappings in ChromaDB (curated learning)."""
    try:
        client = _get_chroma_client()
        collection = _get_collection(client)

        ids = []
        documents = []
        metadatas = []

        for m in mappings:
            col_name = m.get("column_name", "")
            doc = json.dumps(m)
            ids.append(f"mapping_{col_name}")
            documents.append(doc)
            metadatas.append({
                "column_name": col_name,
                "mapped_to": m.get("mapped_to", ""),
                "data_type": m.get("data_type", ""),
            })

        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        return len(ids)
    except Exception as e:
        logger.warning(f"ChromaDB store failed: {e}")
        return 0
