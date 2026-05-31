# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Full-stack car dealership (concesionaria de alta gama) for the Dominican Republic market:

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + shadcn/ui — port 3000
- **Backend**: Flask 3 + SQLAlchemy + Flask-Login — port 5001
- **Database**: MySQL (`concesionaria` schema, charset `utf8mb4`)

All browser requests go to `localhost:3000/api/*` which Next.js rewrites server-side to `localhost:5001/api/*`. There is **no direct browser-to-Flask traffic**. Session cookies are scoped to port 3000.

## Dev setup

### Backend

```powershell
# Windows — from backend/
.venv\Scripts\activate
pip install -r requirements.txt    # first time / after pulling
flask run --port 5001
```

```bash
# macOS/Linux — from backend/
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
flask run --port 5001
```

Copy `backend/.env.example` → `backend/.env` and fill in real values before running. Required keys: `SECRET_KEY`, `DB_USER`, `DB_PASSWORD`.

### Frontend

```bash
# from frontend/
npm install        # first time / after pulling
npm run dev        # Next.js on :3000
npm run build      # production build (uses --webpack flag — required)
npm run lint       # eslint
```

Frontend env: `frontend/.env` must contain `NEXT_PUBLIC_API_URL=/api`.

### Tests

```bash
# from backend/
pytest backend/tests/ -v
pytest backend/tests/test_endpoints.py::TestName -v   # single test
```

## Architecture

### Request flow

```
Browser → :3000/api/* → [next.config.mjs rewrite] → :5001/api/*
                                                          │
                                              Flask-Login session cookie
                                              (set on :3000, same-origin)
```

The rewrite is in `frontend/next.config.mjs`. **Do not add `output: 'export'`** — it breaks rewrites.

### Backend (`backend/backend/`)

The Flask app uses the **app factory pattern** (`__init__.py:create_app`). All blueprints are registered there with their URL prefixes:

| Blueprint | Prefix | Auth |
|-----------|--------|------|
| `catalog.py` | `/api/catalogo` | public |
| `auth.py` | `/api/auth` | public (login/registro/me) |
| `admin.py` | `/api/admin` | `@admin_required` |
| `reservas.py` | `/api/reservas` | `@login_required_api` |
| `borradores.py` | `/api/borradores` | `@admin_required` |
| `location.py` | `/api/location` | public |
| `whatsapp.py` | `/api/whatsapp` | webhook (token verify) |

**Auth decorators** (`decorators.py`) always return JSON (`401`/`403`), never HTML redirects. Use `@admin_required` or `@login_required_api` — never Flask's built-in `@login_required` on API routes.

**Config** (`config.py`) reads from env vars. `DevelopmentConfig` sets `SESSION_COOKIE_SAMESITE=Lax`, `ProductionConfig` sets `None` + `Secure=True` for cross-origin cookies.

#### Data model hierarchy

```
Marca → Modelo → Vehiculo ←→ VehiculoImagen
                    │
              Reserva / Venta / Pago / Resena
```

**Vehicle state machine:**
```
BORRADOR → PENDIENTE_VALIDACION → DISPONIBLE → RESERVADO → VENDIDO
                                      ↑                │
                                      └────────────────┘ (cancelar reserva)
```

#### Validation rules

- `validators.py`: fields `marca`, `modelo`, `color`, `nombre`, `apellido`, `cargo` must be stored **UPPERCASE**. Use `forzar_mayusculas()` before persisting, `validar_mayusculas()` to check.
- VIN: exactly 17 alphanumeric chars, no I/O/Q.
- Password minimum on the backend is **8 characters** (frontend form shows 6 — known discrepancy).

#### Excel import

`borradores.py` runs the import in a background thread (no task queue). Progress is polled via `GET /api/borradores/progreso`. The in-process `_progreso` dict is not persistent — a server restart loses it.

### Frontend (`frontend/`)

See `frontend/CLAUDE.md` for detailed frontend architecture, component map, and key invariants (state casing, hydration suppression, data adapters).

## Seed credentials (dev DB)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@concesionaria.com` | `admin123` |
| USUARIO_PUBLICO | `maria@email.com` | `user1234` |

## Google OAuth

Only initialised when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in `.env`. Safe to leave empty for local dev without OAuth.
