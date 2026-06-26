#!/usr/bin/env python3
"""Operator command: verify the Abby local model is reachable and answers.

Part of the Abby Provider Entitlements plan (Section 9). Runs the three-step
local preflight an operator needs before relying on local-only Abby:

  1. base URL reachable + tag listing  (GET /api/tags)
  2. configured model present
  3. model answers a 1-token probe       (POST /api/chat)

Usage:
    python -m scripts.check_abby_local            # uses configured Abby model
    python -m scripts.check_abby_local --model X  # probe a specific tag

Exits non-zero if the configured model cannot answer, so it can gate a deploy.
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from app.config import settings
from app.routing.provider_profiles import resolve_model_alias
from app.services.ollama_client import (
    check_ollama_health,
    list_ollama_models,
    probe_ollama_model,
)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Abby local Ollama model availability.")
    parser.add_argument("--model", default=None, help="Model tag to probe (default: configured Abby model)")
    parser.add_argument("--base-url", default=None, help="Ollama base URL (default: configured Abby base URL)")
    args = parser.parse_args()

    base_url = args.base_url or settings.abby_llm_base_url
    model = resolve_model_alias(args.model or settings.abby_llm_model, settings)

    print(f"Abby local preflight — base_url={base_url} model={model}")

    # Step 1 + 2: reachability + model present
    health = await check_ollama_health(base_url, model)
    print(f"[1/3] tags reachable + model present : {health}")
    inventory = await list_ollama_models(base_url)
    tags = [m["name"] for m in inventory.get("models", [])]
    print(f"      installed tags                 : {', '.join(tags[:8]) or '(none)'}")

    # Step 3: 1-token chat probe
    probe = await probe_ollama_model(base_url, model)
    print(f"[3/3] 1-token chat probe            : {probe.get('status')}"
          + (f"  ({probe.get('error')})" if probe.get("error") else ""))

    ok = health == "ok" and probe.get("status") == "ok"
    print("RESULT:", "OK — local Abby is ready." if ok else "FAILED — local Abby is not ready.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
