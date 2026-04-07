# Vibran Tech System

Sistema administrativo para sucursales de servicio técnico y ventas (panel interno + consulta pública), preparado para operación local y despliegue en entornos Node.js + PostgreSQL.

## 1) Tecnologías
- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query, Tailwind.
- **Backend:** Node.js, Express, TypeScript, Zod, JWT, Helmet, CORS.
- **Base de datos:** PostgreSQL + Drizzle ORM.

## 2) Requisitos previos
- Node.js **20+**
- npm **10+**
- PostgreSQL **14+**

## 3) Estructura general
- `client/` → SPA administrativa.
- `server/` → API REST + auth + módulos.
- `shared/` → tipos/constantes compartidas.
- `uploads/` → archivos subidos (persistir en producción).

## 4) Variables de entorno
Hay tres archivos ejemplo:
- `/.env.example` (combinado, útil para local rápido)
- `/server/.env.example`
- `/client/.env.example`

### Variables backend principales
- `NODE_ENV`: `development | test | production`
- `PORT`: puerto del backend
- `DATABASE_URL`: conexión PostgreSQL
- `JWT_SECRET`: mínimo 32 caracteres
- `CORS_ORIGIN`: uno o varios orígenes separados por coma
- `FRONTEND_URL`: URL pública del frontend
- `APP_BASE_URL`: URL pública backend
- `UPLOAD_DIR`: carpeta raíz de uploads
- `MAX_UPLOAD_MB`: tamaño máximo por archivo
- `SERVE_FRONTEND`: `true` para que backend sirva `client/dist`
- `FRONTEND_DIST_PATH`: ruta del build frontend
- `SEED_ADMIN_EMAIL`: admin inicial (seed)
- `SEED_ADMIN_PASSWORD`: contraseña inicial (seed)

### Variables frontend principales
- `VITE_API_URL`: URL base API (`.../api`)
- `VITE_APP_NAME`: nombre en UI
- `VITE_PUBLIC_BASE_URL`: base path SPA (ej. `/` o `/panel/`)
- `VITE_PORT`: puerto dev
- `VITE_PREVIEW_PORT`: puerto preview

## 5) Instalación (desde cero)
```bash
npm install
cp .env.example .env
# opcional: cp server/.env.example server/.env && cp client/.env.example client/.env
```

## 6) Base de datos: migraciones y seed
```bash
npm run db:migrate
npm run db:seed
```

Scripts disponibles:
```bash
npm run db:migrate      # corre migraciones
npm run db:seed         # inserta datos base
npm run db:reset        # migrate + seed
```

### Datos iniciales que deja seed
- Roles base (`administrador_general`, `encargado_sucursal`, `tecnico`, `caja_ventas`)
- Sucursales base
- Usuario administrador inicial
- Tipos de dispositivo
- Categorías/productos de ejemplo
- Inventario inicial
- Configuración inicial

## 7) Usuario administrador inicial
Por defecto:
- Usuario: `admin@vibran.tech`
- Contraseña: `VibranTech2026*`

Se puede cambiar sin tocar código mediante:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

> Recomendado: cambiar contraseña inmediatamente tras primer acceso.

## 8) Desarrollo
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Healthcheck API: `GET /api/health`

## 9) Build y ejecución de producción
### Build completo
```bash
npm run build
```

### Opción A (separado)
- Servir `client/dist` desde Nginx/Vercel/static host
- Ejecutar backend: `npm run start -w server`

### Opción B (un solo proceso Node)
1. `npm run build`
2. Configurar en backend:
   - `SERVE_FRONTEND=true`
   - `FRONTEND_DIST_PATH=client/dist`
3. Ejecutar:
```bash
npm run start -w server
```

Con esta opción, el backend sirve la SPA y evita errores al recargar rutas.

## 10) Uploads y archivos
- Carpeta configurable con `UPLOAD_DIR` (default `uploads`).
- Se crea automáticamente al iniciar backend.
- Archivos servidos en `GET /uploads/...`.
- Endpoint de carga (auth requerida):
  - `POST /api/uploads/devices/:deviceId/photos`
  - campo multipart: `photos`
  - tipos permitidos: JPG, PNG, WEBP
  - límite por archivo: `MAX_UPLOAD_MB`
  - máx. 5 archivos por request
- Estructura:
  - `uploads/devices/{deviceId}/...`

## 11) Seguridad y hardening básico aplicado
- Helmet activo.
- CORS configurable por ambiente (`CORS_ORIGIN`).
- Validación Zod en requests.
- Manejo de errores centralizado sin exponer stack en producción.
- JWT configurable por `JWT_SECRET`.


## Aislamiento absoluto por sucursal (regla maestra)
- Toda entidad operativa se consulta/crea/edita respetando `branch_id` desde backend.
- Solo `administrador_general` tiene vista global multi-sucursal.
- `encargado_sucursal` y roles operativos quedan aislados a su sucursal.
- Búsqueda global, clientes y reparaciones aplican filtros de sucursal en capa de servicio.
- Configuración operativa por sucursal se gestiona en `branch_settings` (incluye feature flags).

## 12) Módulos principales
- Auth / sesión
- Sucursales
- Usuarios
- Clientes
- Búsqueda global
- Configuración general
- Uploads de fotos de equipos
- Base preparada para reparaciones, ventas, inventario, transferencias, auditoría

## 13) Backup básico (obligatorio en operación)
Respaldar periódicamente:
1. **Base de datos PostgreSQL**
2. **Carpeta uploads/**
3. **Archivos .env**

Restauración mínima:
1. Restaurar BD (`pg_restore` o dump SQL)
2. Restaurar carpeta `uploads/`
3. Restaurar variables `.env`
4. Levantar app (`npm run start -w server`)

Si se pierden uploads pero no la BD:
- metadatos de negocio siguen, pero fotos/documentos se perderán.

## 14) Troubleshooting
### Error de conexión BD
- Verificar `DATABASE_URL` y acceso a PostgreSQL.
- Probar conexión manual con `psql`.

### Migraciones no corren
- Confirmar que BD existe y credenciales son válidas.
- Ejecutar `npm run db:migrate -w server`.

### Uploads no visibles
- Verificar `UPLOAD_DIR` y permisos de escritura.
- Confirmar que backend expone `/uploads`.

### Problemas CORS
- Ajustar `CORS_ORIGIN` al dominio real del frontend.
- Si hay varios, separarlos por coma.

### Rutas frontend fallan al recargar
- En despliegue único: `SERVE_FRONTEND=true`.
- En despliegue separado: configurar fallback SPA en proxy/webserver.

## 15) Checklist de despliegue
- [x] Variables de entorno claras
- [x] `.env.example` completo (root + client + server)
- [x] Build frontend y backend
- [x] Scripts de start/migrate/seed/reset
- [x] Healthcheck API (`/api/health`)
- [x] Uploads configurables y servidos
- [x] Seed con admin inicial configurable
- [x] Documentación de operación y backup
