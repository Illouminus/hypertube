# Hypertube API

NestJS backend for Hypertube.

## Prerequisites

- Node.js 20.x or later
- npm
- PostgreSQL 16 (via Docker or local installation)
- Redis 7 (via Docker or local installation)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the root `.env.example` to `.env` and adjust values:

```bash
cp ../../.env.example ../../.env
```

The API loads environment variables from the **repository root** `.env` file.
Always run commands from the repo root directory.

Required variables:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hypertube?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV=development
```

### 3. Start infrastructure (if not running)

```bash
docker compose -f ../../docker-compose.yml up -d
```

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

### 5. Run database migrations

```bash
npm run prisma:migrate
```

### 6. Start the development server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3001`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Start production build |
| `npm run build` | Build the application |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio |

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "uptime": 123.456,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```
