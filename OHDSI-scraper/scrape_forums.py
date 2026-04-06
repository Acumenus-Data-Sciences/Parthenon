#!/usr/bin/env python3
"""
OHDSI Forums Scraper
====================
Downloads high-quality Q&A threads from forums.ohdsi.org (Discourse).

The OHDSI forums contain 10+ years of practitioner Q&A covering:
- CDM mapping and ETL challenges
- Cohort definition best practices
- Analytical method selection
- HADES package troubleshooting
- Study design review

Quality filters:
- Only threads with accepted answers or high engagement (>=3 replies)
- Filters out administrative/announcement posts
- Prioritizes recent threads (2020+) but includes older canonical answers
- Strips quoted text to avoid duplication
- Tags with category, solved status, and recency
"""

import json
import logging
import os
import re
import sys
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("forums_scraper")

OUTPUT_DIR = Path("ohdsi_forums")
BASE_URL = "https://forums.ohdsi.org"

# Categories most relevant for Abby's knowledge
TARGET_CATEGORIES = [
    "cohort-definition",
    "cdm-builders",
    "developers",
    "researchers",
    "data-quality",
    "vocabulary-and-concept",
    "patient-level-prediction",
    "population-level-estimation",
    "characterization",
    "general",
    "implementers",
]

# Skip these categories — low knowledge value
SKIP_CATEGORIES = {
    "jobs", "events", "site-feedback", "announcements",
    "uncategorized", "community",
}


def get_category_slug_map() -> dict[int, str]:
    """Fetch category ID -> slug mapping from Discourse."""
    try:
        resp = requests.get(f"{BASE_URL}/categories.json", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        mapping = {}
        for cat in data.get("category_list", {}).get("categories", []):
            mapping[cat["id"]] = cat["slug"]
            # Subcategories
            for sub in cat.get("subcategory_ids", []):
                mapping[sub] = cat["slug"]
        return mapping
    except Exception as e:
        log.warning("Failed to fetch categories: %s", e)
        return {}


def get_topic_list(page: int = 0, category_slug: str | None = None) -> list[dict]:
    """Fetch a page of topics from Discourse."""
    if category_slug:
        url = f"{BASE_URL}/c/{category_slug}.json"
    else:
        url = f"{BASE_URL}/latest.json"

    try:
        resp = requests.get(url, params={"page": page}, timeout=15)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("topic_list", {}).get("topics", [])
    except Exception as e:
        log.warning("Failed to fetch topic list (page %d): %s", page, e)
        return []


def get_topic_detail(topic_id: int) -> dict | None:
    """Fetch full topic with all posts."""
    try:
        resp = requests.get(f"{BASE_URL}/t/{topic_id}.json", timeout=15)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception as e:
        log.debug("Failed to fetch topic %d: %s", topic_id, e)
        return None


def clean_post_html(html: str) -> str:
    """Convert Discourse HTML post to clean text."""
    from html.parser import HTMLParser
    from io import StringIO

    # Remove quoted text blocks (avoid duplication)
    html = re.sub(r'<aside class="quote.*?</aside>', '', html, flags=re.DOTALL)

    # Remove image tags (keep alt text)
    html = re.sub(r'<img[^>]*alt="([^"]*)"[^>]*>', r'\1', html)
    html = re.sub(r'<img[^>]*>', '', html)

    # Convert code blocks
    html = re.sub(r'<pre><code[^>]*>(.*?)</code></pre>', r'\n```\n\1\n```\n', html, flags=re.DOTALL)
    html = re.sub(r'<code>(.*?)</code>', r'`\1`', html, flags=re.DOTALL)

    # Convert headers
    for i in range(1, 7):
        html = re.sub(rf'<h{i}[^>]*>(.*?)</h{i}>', rf'\n{"#" * i} \1\n', html, flags=re.DOTALL)

    # Convert lists
    html = re.sub(r'<li>(.*?)</li>', r'\n- \1', html, flags=re.DOTALL)

    # Convert links
    html = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', html, flags=re.DOTALL)

    # Convert paragraphs and breaks
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub(r'<p[^>]*>', '\n', html)
    html = re.sub(r'</p>', '\n', html)

    # Strip remaining HTML
    html = re.sub(r'<[^>]+>', '', html)

    # Decode HTML entities
    html = html.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    html = html.replace('&quot;', '"').replace('&#39;', "'")
    html = html.replace('&nbsp;', ' ')

    # Collapse whitespace
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()


def is_high_quality_topic(topic: dict) -> bool:
    """Filter for high-quality, knowledge-rich topics."""
    # Must have replies
    reply_count = topic.get("reply_count", 0) or topic.get("posts_count", 1) - 1
    if reply_count < 2:
        return False

    # Skip pinned/banner topics (usually announcements)
    if topic.get("pinned") or topic.get("pinned_globally"):
        return False

    # Skip closed topics with no accepted answer and low engagement
    views = topic.get("views", 0)
    if views < 50 and reply_count < 3:
        return False

    # Prefer solved topics
    has_accepted = topic.get("has_accepted_answer", False)
    if has_accepted:
        return True

    # For unsolved: require higher engagement
    like_count = topic.get("like_count", 0)
    return reply_count >= 3 or like_count >= 3 or views >= 200


def compute_quality_score(topic: dict, year: int) -> float:
    """Compute a quality score for ranking and retrieval weighting."""
    score = 0.0

    # Recency bonus (0-3 points)
    if year >= 2024:
        score += 3.0
    elif year >= 2022:
        score += 2.0
    elif year >= 2020:
        score += 1.0

    # Solved bonus
    if topic.get("has_accepted_answer"):
        score += 2.0

    # Engagement
    views = topic.get("views", 0)
    likes = topic.get("like_count", 0)
    replies = topic.get("reply_count", 0) or topic.get("posts_count", 1) - 1
    score += min(views / 500, 2.0)
    score += min(likes / 5, 2.0)
    score += min(replies / 5, 1.0)

    return round(score, 2)


def main():
    log.info("OHDSI Forums Scraper — Starting")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cat_map = get_category_slug_map()
    log.info("Loaded %d category mappings", len(cat_map))

    all_topics = []
    seen_ids = set()
    total_chars = 0

    # Scrape latest topics across all pages
    max_pages = 50  # ~50 topics per page = ~2500 topics
    for page in range(max_pages):
        log.info("Fetching topic list page %d/%d ...", page + 1, max_pages)
        time.sleep(0.3)

        topics = get_topic_list(page=page)
        if not topics:
            log.info("No more topics at page %d, stopping", page)
            break

        new_count = 0
        for topic in topics:
            topic_id = topic.get("id")
            if not topic_id or topic_id in seen_ids:
                continue
            seen_ids.add(topic_id)

            # Check category
            cat_id = topic.get("category_id", 0)
            cat_slug = cat_map.get(cat_id, "unknown")
            if cat_slug in SKIP_CATEGORIES:
                continue

            # Quality filter
            if not is_high_quality_topic(topic):
                continue

            new_count += 1

            # Fetch full topic
            time.sleep(0.3)
            detail = get_topic_detail(topic_id)
            if not detail:
                continue

            # Extract posts
            posts = detail.get("post_stream", {}).get("posts", [])
            if not posts:
                continue

            # Build thread text
            title = detail.get("title", "")
            created_at = detail.get("created_at", "")[:10]
            year = int(created_at[:4]) if created_at else 0

            thread_parts = [f"# {title}\n"]

            accepted_post_id = None
            for post in posts:
                if post.get("accepted_answer"):
                    accepted_post_id = post.get("id")

            for post in posts:
                username = post.get("username", "anonymous")
                cooked = post.get("cooked", "")
                clean_text = clean_post_html(cooked)

                if len(clean_text) < 20:
                    continue

                is_accepted = post.get("id") == accepted_post_id
                prefix = f"**{username}**"
                if is_accepted:
                    prefix += " (accepted answer)"
                if post.get("post_number", 0) == 1:
                    prefix += " (question)"

                thread_parts.append(f"\n{prefix}:\n{clean_text}")

            thread_text = "\n".join(thread_parts)

            if len(thread_text) < 200:
                continue

            # Compute quality
            quality_score = compute_quality_score(topic, year)

            # Save
            safe_id = str(topic_id)
            output_file = OUTPUT_DIR / f"topic_{safe_id}.md"
            output_file.write_text(thread_text, encoding="utf-8")

            all_topics.append({
                "topic_id": topic_id,
                "title": title,
                "category": cat_slug,
                "created_at": created_at,
                "year": year,
                "reply_count": topic.get("reply_count", 0),
                "views": topic.get("views", 0),
                "like_count": topic.get("like_count", 0),
                "has_accepted_answer": topic.get("has_accepted_answer", False),
                "quality_score": quality_score,
                "char_count": len(thread_text),
                "source": "ohdsi_forums",
                "priority": "high" if quality_score >= 5 else "medium" if quality_score >= 3 else "low",
            })
            total_chars += len(thread_text)

        log.info("  Page %d: %d new high-quality topics", page + 1, new_count)

        if new_count == 0:
            log.info("  No new qualifying topics, stopping")
            break

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "source": "OHDSI Forums (forums.ohdsi.org)",
            "total_topics": len(all_topics),
            "total_chars": total_chars,
            "quality_distribution": {
                "high": sum(1 for t in all_topics if t["priority"] == "high"),
                "medium": sum(1 for t in all_topics if t["priority"] == "medium"),
                "low": sum(1 for t in all_topics if t["priority"] == "low"),
            },
            "year_distribution": {},
            "topics": all_topics,
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, f, indent=2)

    # Compute year distribution
    year_dist = {}
    for t in all_topics:
        y = t.get("year", 0)
        year_dist[y] = year_dist.get(y, 0) + 1

    log.info("=== Complete ===")
    log.info("Topics saved: %d", len(all_topics))
    log.info("Total text: %d chars (%.1f MB)", total_chars, total_chars / 1_000_000)
    log.info("Year distribution: %s", dict(sorted(year_dist.items())))


if __name__ == "__main__":
    main()
