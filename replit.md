# Vibran Tech System (Tiendacel)

Sistema de gestión administrativa para una cadena de tiendas de reparación de celulares.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + React Query + React Router
- **Backend**: Node.js + Express + TypeScript (tsx watch)
- **Database**: PostgreSQL (Replit built-in) + Drizzle ORM
- **Shared**: `@vibran-tech/shared` workspace package (types/utils)
- **Monorepo**: npm workspaces (`client/`, `server/`, `shared/`)

### Ports
- **Frontend (Vite dev)**: 5000
- **Backend (Express)**: 8000
- Vite proxies `/api` and `/uploads` → `http://localhost:8000`

### Workflows
- **Start application**: `npm run dev -w client`
- **Backend API**: `npm run dev -w server`
