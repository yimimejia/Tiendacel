# Vibran Tech System (Tiendacel)

Sistema de gestión administrativa para una cadena de tiendas de reparación de celulares.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + React Query + React Router
- **Backend**: Node.js + Express + TypeScript (tsx watch)
- **Database**: PostgreSQL (Replit built-in) + Drizzle ORM
- **Shared**: `@vibran-tech/shared` workspace package (types/utils)
- **Monorepo**: npm workspaces (`client/`, `server/`, `shared/`)

### Structure
```
/
├── client/          # React + Vite frontend (port 5000)
│   └── src/
│       ├── app/     # Layout
│       ├── components/
│       ├── config/  # env.ts
│       ├── features/auth/
│       ├── lib/     # api.ts (axios/fetch)
│       ├── pages/
│       ├── routes/  # router.tsx, protected-route.tsx
│       └── services/
├── server/          # Express backend (port 8000)
│   ├── drizzle/     # SQL migrations
│   └── src/
│       ├── app/     # create-app.ts
│       ├── config/  # env.ts (zod)
│       ├── db/      # schema.ts, client.ts, seed.ts
│       ├── middlewares/
│       ├── modules/ # auth, branches, customers, repairs, roles, search, settings, uploads, users
│       ├── routes/
│       ├── services/
│       ├── types/
│       └── utils/
├── shared/          # @vibran-tech/shared package
│   └── src/index.ts
└── uploads/         # File upload directory
```

## Ports
- **Frontend (Vite dev)**: 5000 (webview)
- **Backend (Express)**: 8000 (console)
- Vite proxies `/api` and `/uploads` → `http://localhost:8000`

## Workflows
- **Start application**: `npm run dev -w client` — Vite dev server (port 5000)
- **Backend API**: `npm run dev -w server` — Express with tsx watch (port 8000)

## Environment Variables (shared)
- `PORT=8000` — Backend port
- `DATABASE_URL` — PostgreSQL connection (Replit managed secret)
- `JWT_SECRET` — JWT signing key
- `CORS_ORIGIN=http://localhost:5000`
- `SERVE_FRONTEND=false` — Backend does NOT serve frontend in dev
- `VITE_API_URL=/api` — Frontend uses relative path (proxied by Vite)
- `VITE_PORT=5000`

## Database
- PostgreSQL via Replit built-in (DATABASE_URL secret)
- Migrations: `npm run db:migrate` (runs drizzle-kit migrate in server/)
- Seed: `npm run db:seed` (creates roles, branches, users, sample data)
- Default admin: `admin@vibran.tech` / `VibranTech2026*`

## Key Modules (Backend)
- **auth** — Login/logout with JWT (cookie + Bearer)
- **users** — User management with roles and branch assignment
- **branches** — Multi-branch management
- **customers** — Customer registry
- **repairs** — Device repair lifecycle (intake, status, payments, history)
- **settings** — System-wide configuration
- **search** — Global search
- **uploads** — File upload via multer

## Domain Model Highlights
- Roles: `administrador_general`, `encargado_sucursal`, `tecnico`, `caja_ventas`
- Devices track `internalStatus` (10 stages) and `customerVisibleStatus` (4 stages)
- Payment methods: `efectivo`, `transferencia`, `tarjeta`, `otro`
- Full audit log support
- Inventory and sales modules in schema

## Build
```bash
npm run build          # Build all workspaces
npm run db:migrate     # Apply migrations
npm run db:seed        # Seed initial data
npm run db:reset       # Migrate + seed
```
