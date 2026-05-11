# Abby Dedicated Ollama Endpoint

Date: 2026-04-04

## Goal

Keep Abby's MedGemma route resident on its own Ollama daemon so unrelated local-model traffic does not evict it and trigger multi-second cold loads.

## Repo Changes

- `python-ai` now supports:
  - `ABBY_OLLAMA_BASE_URL`
  - `ABBY_OLLAMA_MODEL`
  - `ABBY_OLLAMA_KEEP_ALIVE`
- Abby chat, Abby streaming, startup warmup, and AI health checks now use Abby-specific Ollama settings instead of the generic shared endpoint.

## Host Service Shape

Run a second Ollama instance on a dedicated port such as `11435`.

Example systemd unit:

```ini
[Unit]
Description=Ollama (Abby dedicated)
After=network-online.target
Wants=network-online.target

[Service]
Environment=OLLAMA_HOST=0.0.0.0:11435
Environment=OLLAMA_MODELS=/var/lib/ollama-abby/models
Environment=OLLAMA_KEEP_ALIVE=30m
Environment=OLLAMA_MAX_LOADED_MODELS=1
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_FLASH_ATTENTION=1
LimitMEMLOCK=infinity
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then pull Abby's model into that dedicated instance:

```bash
OLLAMA_HOST=0.0.0.0:11435 ollama pull MedAIBase/MedGemma1.5:4b
```

## Compose Wiring

Point the AI service at the dedicated endpoint:

```env
ABBY_OLLAMA_BASE_URL=http://host.docker.internal:11435
ABBY_OLLAMA_MODEL=MedAIBase/MedGemma1.5:4b
ABBY_OLLAMA_KEEP_ALIVE=3600
```

Leave the generic `OLLAMA_BASE_URL` untouched if other features still share the default daemon.

## Verification

1. `curl http://localhost:11435/api/tags`
2. `curl http://localhost:8002/health`
3. Confirm AI logs show `base_url=http://host.docker.internal:11435` on `abby_ollama_call`
4. Confirm repeated Abby calls no longer show large `load_ms` spikes after warmup
