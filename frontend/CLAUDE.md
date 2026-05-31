# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Full-stack car dealership app: **Next.js 16 frontend** (port 3000) + **Flask backend** (port 5001) + **MySQL** database. All API calls from the browser go through a Next.js server-side proxy rewrite — there is no direct browser-to-Flask traffic.

```
Browser → localhost:3000/api/* → [Next.js rewrite] → localhost:5001/api/*
```

Session auth uses Flask-Login cookies. The cookie is set on `localhost:3000` (not 5001) so the browser always sees it as same-origin.

## Dev commands

**Frontend** (this directory):
```bash
npm run dev       # start Next.js on :3000
npm run build     # production build (uses --webpack flag)
npm run lint      # eslint
```

**Backend** (from `../backend`):
```bash
# Windows
.venv\Scripts\activate
flask run --port 5001

# or directly:
.venv\Scripts\python -m flask run --port 5001
```

**Environment files:**
- Frontend: `frontend/.env` — must contain `NEXT_PUBLIC_API_URL=/api`
- Backend: `backend/.env` — copy from `.env.example`, fill DB credentials and SECRET_KEY

## Architecture

### Frontend (`app/` — Next.js App Router)

| Path | Type | Purpose |
|------|------|---------|
| `app/page.tsx` | Server | Home: hero + BrandNav + VehicleCatalog |
| `app/vehiculo/[id]/page.tsx` | Server | Vehicle detail with SSG (`generateStaticParams`) |
| `app/login/page.tsx` | Client | Login form |
| `app/registro/page.tsx` | Client | Registration form |
| `app/admin/layout.tsx` | Client | Auth guard: calls `/api/auth/me`, redirects to `/login` if 401 or to `/` if not ADMIN |
| `app/admin/page.tsx` | Server | Dashboard with vehicle stats |
| `app/admin/vehiculos/page.tsx` | Client | Vehicle management table |
| `app/admin/reservas/page.tsx` | Client | Reservations management |
| `app/admin/historial/page.tsx` | Server | Sales history |
| `app/admin/excel/page.tsx` | Client | Excel import/export |

### Data flow

- **Server components** call `lib/api.ts` directly (server-side fetch, no cookies forwarded automatically)
- **Client components** call `lib/api.ts` with `credentials: 'include'` — cookies are sent because requests go to same origin (`/api/*`)
- `lib/data.ts` is the server-component data layer (wraps `lib/api.ts` with try/catch)
- `lib/types.ts` contains: raw API types (`VehiculoAPI`, `MarcaAPI`…), the frontend flat type (`Vehicle`), and the `toVehicle()` adapter
- `components/header.tsx` manages auth state via `api.getCurrentUser()` on mount

### Backend (`../backend/backend/`)

| Module | Purpose |
|--------|---------|
| `__init__.py` | App factory. Registers CORS, Flask-Login, all blueprints |
| `config.py` | Config classes (`DevelopmentConfig`, `ProductionConfig`) |
| `models/` | SQLAlchemy models: `Usuario`, `Rol`, `Vehiculo`, `Marca`, `Modelo`, `Reserva`, `Venta`, `Resena` |
| `blueprints/auth.py` | `/api/auth/*` — login, logout, registro, me, Google OAuth |
| `blueprints/catalog.py` | `/api/catalogo/*` — public vehicle/brand listing |
| `blueprints/admin.py` | `/api/admin/*` — protected, requires `@admin_required` |
| `blueprints/reservas.py` | `/api/reservas/*` — protected, requires `@login_required_api` |
| `blueprints/borradores.py` | `/api/borradores/*` — Excel import/export, draft management |
| `decorators.py` | `@admin_required` and `@login_required_api` — both return JSON 401, not HTML redirect |

### Auth roles

Two roles: `ADMIN` (id=1) and `USUARIO_PUBLICO` (id=2).

Test credentials (seeded in DB):
- Admin: `admin@concesionaria.com` / `admin123`
- User: `maria@email.com` / `user1234`

### Key invariants

- `next.config.mjs` must NOT have `output: 'export'` (incompatible with rewrites)
- Flask's `@login_required` decorator on API routes must never redirect to an HTML page — the `unauthorized_handler` in `__init__.py` overrides this to return JSON 401
- Backend password minimum: **8 characters** (frontend shows 6 — discrepancy exists)
- `Vehicle.estado` values in frontend are lowercase (`disponible`, `reservado`, `vendido`, `pendiente_validacion`); backend uses UPPERCASE (`DISPONIBLE`, `RESERVADO`…) — `toVehicle()` in `lib/types.ts` handles the mapping
- `BORRADOR` and `PENDIENTE_VALIDACION` both map to `pendiente_validacion` in the frontend type

### Hydration

`app/layout.tsx` has `suppressHydrationWarning` on both `<html>` and `<body>` to suppress browser extension attribute injections (LanguageTool, ColorZilla). This is intentional.
