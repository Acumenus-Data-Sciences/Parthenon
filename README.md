# Parthenon

Unified outcomes research platform built on the OMOP Common Data Model v5.4. Consolidates the OHDSI ecosystem (Atlas, WebAPI, Achilles, DQD, Usagi, and more) into a single, AI-powered application.

## Tech Stack

- **Backend**: Laravel 11 (PHP 8.3)
- **Frontend**: React 18 + TypeScript + TailwindCSS
- **AI Service**: Python FastAPI (SapBERT, MedCAT, LLM concept mapping)
- **Analytics**: R Plumber API (HADES sidecar)
- **Database**: PostgreSQL 16 + pgvector
- **Cache/Queue**: Redis 7

## Quick Start

### Prerequisites

- Docker and Docker Compose v2
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Build and start all services
make build
make up

# Run database migrations
docker compose exec php php artisan migrate

# Open in browser
open http://localhost
```

### Development Commands

```bash
make up          # Start all services
make down        # Stop all services
make build       # Rebuild Docker images
make fresh       # Full reset: rebuild + migrate:fresh --seed
make logs        # Tail service logs
make test        # Run all test suites
make lint        # Run all linters

make shell-php      # Shell into PHP container
make shell-node     # Shell into Node container
make shell-python   # Shell into Python AI container
make shell-r        # Shell into R runtime container
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend (SPA) | http://localhost |
| API | http://localhost/api |
| API Health | http://localhost/api/health |
| Horizon (Queues) | http://localhost/horizon |
| Vite Dev Server | http://localhost:5173 |
| AI Service | http://localhost:8000 |
| R Runtime | http://localhost:8787 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Project Structure

```
Parthenon/
  backend/       Laravel 11 API
  frontend/      React 18 + TypeScript SPA
  ai/            Python FastAPI AI service
  r-runtime/     R Plumber API
  docker/        Docker configuration
  docs/          Documentation
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
