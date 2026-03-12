# Parthenon Installer

Python-based Rich TUI installer for guided Parthenon deployment.

## Usage

```bash
python3 install.py
```

## Modules

- `bootstrap.py`
- `cli.py`
- `config.py`
- `demo_data.py`
- `docker_ops.py`
- `etl_mbu_patient.py`
- `eunomia.py`
- `preflight.py`
- `utils.py`

## What It Does

1. **Preflight checks** — Docker, Docker Compose, ports, disk space
2. **Environment setup** — generates `.env` files with secure defaults
3. **Container orchestration** — builds and starts all Docker services
4. **Database initialization** — runs migrations, seeds admin user
5. **Health verification** — waits for all services to report healthy
