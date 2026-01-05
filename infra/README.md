# Infrastructure

This directory contains infrastructure-related configuration and documentation.

## Docker Compose

The main `docker-compose.yml` is located at the repository root for easy access.

### Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| postgres | postgres:16-alpine | 5432 | PostgreSQL database |
| redis | redis:7-alpine | 6379 | Redis cache |

### Volumes

- `postgres_data` - Persistent storage for PostgreSQL
- `redis_data` - Persistent storage for Redis

### Usage

From the repository root:

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```

## Environment Variables

The Docker Compose file uses the following environment variables with defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | postgres | PostgreSQL username |
| `POSTGRES_PASSWORD` | postgres | PostgreSQL password |
| `POSTGRES_DB` | hypertube | PostgreSQL database name |

These can be overridden in a `.env` file at the repository root.
