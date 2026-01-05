# Hypertube

A movie streaming platform built with NestJS and Next.js.

## 📦 Project Structure

```
hypertube/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── infra/            # Infrastructure documentation
├── docker-compose.yml
├── .env.example
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or later
- npm
- Docker and Docker Compose

### 1. Clone and setup environment

```bash
# Copy environment file
cp .env.example .env
```

### 2. Start infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Verify services are running
docker compose ps
```

### 3. Install dependencies

```bash
# Install all dependencies (root + apps)
npm run install:all
```

### 4. Setup database

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

### 5. Start development servers

```bash
# Terminal 1: Start API (http://localhost:3001)
npm run dev:api

# Terminal 2: Start Web (http://localhost:3000)
npm run dev:web
```

### 6. Verify everything works

- Web app: http://localhost:3000
- API health check: http://localhost:3001/health

## 📝 Available Scripts

### Root level

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install dependencies for all apps |
| `npm run dev:api` | Start API in development mode |
| `npm run dev:web` | Start Web in development mode |
| `npm run build:all` | Build both apps |
| `npm run lint:all` | Lint both apps |
| `npm run typecheck:all` | Typecheck both apps |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run infra:up` | Start Docker infrastructure |
| `npm run infra:down` | Stop Docker infrastructure |
| `npm run infra:logs` | View infrastructure logs |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio |

### API specific

```bash
cd apps/api
npm run start:dev      # Development with hot reload
npm run start:prod     # Production mode
npm run test           # Run tests
npm run lint           # Lint code
npm run typecheck      # Type check
```

### Web specific

```bash
cd apps/web
npm run dev            # Development mode
npm run build          # Production build
npm run lint           # Lint code
npm run typecheck      # Type check
```

## 🐳 Docker Services

| Service | Host Port | Container Port | Description |
|---------|-----------|----------------|-------------|
| PostgreSQL | 5433 | 5432 | Database (5433 avoids local conflicts) |
| Redis | 6379 | 6379 | Cache |

## 🔧 Environment Variables

**Strategy:** All environment variables are loaded from a single `.env` file at the **repository root**. Always run commands from the repo root directory.

See [.env.example](.env.example) for all available variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3001 | API server port |
| `DATABASE_URL` | - | PostgreSQL connection string (port 5433) |
| `REDIS_URL` | redis://localhost:6379 | Redis connection string |
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | API URL for frontend |

> **Note:** PostgreSQL runs on host port **5433** (not 5432) to avoid conflicts with local PostgreSQL installations.

## 🧪 CI/CD

GitHub Actions workflow runs on push/PR to main, master, and develop branches:

1. **Lint & Typecheck** - ESLint and TypeScript checks
2. **Test** - Jest tests with PostgreSQL and Redis services
3. **Build** - Production builds for both apps

## 📚 Tech Stack

- **Backend**: NestJS, Prisma, PostgreSQL, Redis
- **Frontend**: Next.js 15, React 19, TypeScript
- **Infrastructure**: Docker, Docker Compose
- **Tooling**: ESLint, Prettier, GitHub Actions

## 📖 Documentation

- [API README](apps/api/README.md)
- [Web README](apps/web/README.md)
- [Infrastructure README](infra/README.md)

## 🔜 Roadmap

- [ ] Stage 1: Authentication (OAuth 42, Google, GitHub)
- [ ] Stage 2: User profiles
- [ ] Stage 3: Movie search and metadata
- [ ] Stage 4: Torrent streaming
- [ ] Stage 5: HLS transcoding
- [ ] Stage 6: Comments and ratings
