# Hypertube Web

Next.js frontend for Hypertube.

## Prerequisites

- Node.js 20.x or later
- npm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

The app uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL of the API server | `http://localhost:3001` |

You can set these in a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run start` | Start production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   ├── globals.css      # Global styles
│   └── login/           # Login page (placeholder)
└── config/              # Configuration
    └── env.ts           # Environment config
```
