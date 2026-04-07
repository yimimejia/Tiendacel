# Vibran Tech System

Base técnica + capa de base de datos para **Vibran Tech**.

## Stack
- Frontend: React + TypeScript + Vite + Tailwind + React Router + TanStack Query.
- Backend: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL + Zod.

## Estructura
- `client`: aplicación web.
- `server`: API REST y capa de base de datos.
- `shared`: tipos/constantes compartidas.

## Requisitos
- Node.js 20+
- PostgreSQL 14+
- npm 10+

## Configuración de entorno
1. Copiar archivo de entorno:
```bash
cp .env.example .env
```
2. Ajustar `DATABASE_URL` a tu instancia local de PostgreSQL.

## Instalación
```bash
npm install
```

## Comandos de desarrollo
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api/health`

## Base de datos (Drizzle)
Generar migraciones:
```bash
npm run db:generate -w server
```

Ejecutar migraciones:
```bash
npm run db:migrate -w server
```

Ejecutar seed:
```bash
npm run db:seed -w server
```

## Usuario seed de prueba
- Usuario: `admin@vibran.tech`
- Contraseña: `VibranTech2026*`

## Scripts principales
```bash
npm run typecheck
npm run build
npm run dev
```

## Alcance actual
- ✅ Schema completo con 18 tablas de negocio.
- ✅ Relaciones Drizzle definidas.
- ✅ Migración SQL inicial generada en `server/drizzle`.
- ✅ Seed inicial funcional para roles, sucursales, usuarios, clientes, tipos de equipo, categorías, productos, inventario, reparaciones, pagos, ventas, transferencias, settings y auditoría.
