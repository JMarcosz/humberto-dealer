# Concesionaria de Alta Gama — App Web

Aplicación web full-stack para una concesionaria de vehículos premium.

> ## ⚡ ¿Vienes de la versión anterior? Aplica el parche en 1 paso
>
> Si ya tenías la app corriendo y solo necesitas estos arreglos (login funcional, imágenes visibles, filtro por marca), ejecuta esto en PowerShell desde la raíz del proyecto:
>
> ```powershell
> Get-Content database\fix-issues.sql | mysql -u root -p
> ```
>
> Eso corrige las URLs de imágenes y los hashes de password en la BD. **No necesitas re-cargar `schema.sql` ni `seed.sql`.** Después reinicia el backend (Ctrl+C → `python run.py`) y el frontend (Ctrl+C → `pnpm dev`).



**Stack:**
- **Frontend:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · shadcn/ui
- **Backend:** Python 3.12 · Flask 3 · SQLAlchemy · Flask-Login · Flask-CORS
- **Base de datos:** MySQL 8.x
- **Integraciones:** Google OAuth 2.0 · WhatsApp Business API · openpyxl (Excel)

---

## Estructura del proyecto

```
concesionaria-app/
├── frontend/         ← Next.js (corre en puerto 3000)
│   ├── app/          ← Páginas (App Router): /, /vehiculo/[id], /admin/...
│   ├── components/   ← Componentes React + shadcn/ui
│   ├── lib/          ← api.ts (cliente Flask), types.ts, data.ts (fallback mock)
│   ├── public/       ← Imágenes de vehículos
│   └── package.json
│
├── backend/          ← Python Flask (corre en puerto 5000)
│   ├── backend/      ← Paquete Python con la lógica de la app
│   │   ├── blueprints/   ← Endpoints: catalog, auth, admin, reservas, etc.
│   │   ├── models/       ← Modelos SQLAlchemy
│   │   ├── services/     ← Excel, WhatsApp, Google OAuth
│   │   └── tests/        ← pytest
│   ├── run.py
│   ├── requirements.txt
│   └── .env.example
│
└── database/         ← Scripts MySQL
    ├── schema.sql    ← Crea tablas (3FN, charset utf8mb4)
    └── seed.sql      ← Datos de prueba
```

**Importante:** son **dos servicios independientes** que se hablan por HTTP. Se necesitan **dos terminales** para correrlos en paralelo durante desarrollo.

---

## Prerrequisitos

Instala lo siguiente antes de empezar (ambos sistemas operativos):

| Herramienta | Versión mínima | Notas |
|---|---|---|
| **Python** | 3.12 | <https://www.python.org/downloads/> |
| **Node.js** | 20 LTS | <https://nodejs.org/> |
| **pnpm** | 9 | `npm install -g pnpm` (recomendado; o usa `npm`) |
| **MySQL** | 8.x | Servidor local o remoto |
| **Git** | cualquiera | Para clonar |

---

## 🐧 Guía paso a paso — Linux (Ubuntu/Debian)

### Paso 1 — Clonar y entrar al proyecto

```bash
git clone <url-del-repo> concesionaria-app
cd concesionaria-app
```

### Paso 2 — Levantar la base de datos MySQL

```bash
# Si no tienes MySQL instalado:
sudo apt update && sudo apt install -y mysql-server
sudo systemctl start mysql

# Crear la BD y cargar el schema + datos seed:
sudo mysql < database/schema.sql
sudo mysql concesionaria < database/seed.sql

# Verificar:
sudo mysql -e "USE concesionaria; SHOW TABLES;"
```

### Paso 3 — Backend (Flask)

```bash
cd backend

# Crear entorno virtual Python
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env   # ← editar DB_USER, DB_PASSWORD, SECRET_KEY y demás
```

Edita `.env` con tus credenciales reales. Los campos críticos:

```
SECRET_KEY=genera-uno-largo-y-aleatorio
DB_USER=root
DB_PASSWORD=tu_password_de_mysql
DB_NAME=concesionaria
```

Las variables de WhatsApp y Google OAuth puedes dejarlas con valores dummy si no las usarás aún.

Lanzar el backend:

```bash
python run.py
```

→ Backend corriendo en **http://localhost:5000**

Deja esa terminal abierta.

### Paso 4 — Frontend (Next.js) — abre OTRA terminal

```bash
cd concesionaria-app/frontend

# Instalar dependencias
pnpm install
# (o `npm install` si prefieres)

# Configurar URL del backend
cp .env.local.example .env.local
# (los valores por defecto apuntan a localhost:5000, no necesitas tocarlo)

# Lanzar
pnpm dev
```

→ Frontend corriendo en **http://localhost:3000**

### Paso 5 — Probar

Abre el navegador en <http://localhost:3000>. Deberías ver el catálogo de vehículos.

---

## 🪟 Guía paso a paso — Windows 10/11

> Usa **PowerShell** (no CMD). Pulsa `Win + X` → "Terminal" o "PowerShell".

### Paso 1 — Clonar y entrar al proyecto

```powershell
git clone <url-del-repo> concesionaria-app
cd concesionaria-app
```

### Paso 2 — Levantar MySQL

Instala MySQL desde <https://dev.mysql.com/downloads/installer/> (elige "MySQL Installer for Windows" → "Server only" o "Developer Default").

Durante la instalación define una contraseña para `root`. Anótala.

Abre **MySQL Command Line Client** (viene con la instalación) o usa PowerShell:

```powershell
# Crear la BD y cargar schema + seed
# (sustituye la ruta a mysql.exe por la tuya si no está en PATH)
mysql -u root -p < database\schema.sql
mysql -u root -p concesionaria < database\seed.sql
```

Si `mysql` no es reconocido, agrégalo al PATH o usa la ruta completa:
`"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"`.

### Paso 3 — Backend (Flask)

```powershell
cd backend

# Crear entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

> Si PowerShell se queja con "execution policy", ejecuta UNA vez:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> y vuelve a intentar el `Activate.ps1`.

```powershell
# Instalar dependencias
python -m pip install --upgrade pip
pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env
notepad .env   # ← editar valores
```

Mismos campos críticos que en Linux: `SECRET_KEY`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

Una cosita más en Windows — abre `.env` y reemplaza la línea:
```
UPLOAD_FOLDER=/tmp/concesionaria_uploads
```
por:
```
UPLOAD_FOLDER=C:\Temp\concesionaria_uploads
```
(Crea la carpeta `C:\Temp\concesionaria_uploads` si no existe.)

Lanzar:

```powershell
python run.py
```

→ Backend en **http://localhost:5000**. Deja esa ventana abierta.

### Paso 4 — Frontend (Next.js) — abre OTRA PowerShell

```powershell
cd concesionaria-app\frontend

# Instalar pnpm si no lo tienes
npm install -g pnpm

# Instalar dependencias
pnpm install

# Configurar entorno
copy .env.local.example .env.local

# Lanzar
pnpm dev
```

→ Frontend en **http://localhost:3000**

### Paso 5 — Probar

Abre <http://localhost:3000> en tu navegador.

---

## URLs y endpoints clave

Mientras la app corre:

| URL | Qué es |
|---|---|
| <http://localhost:3000> | Catálogo público (home del frontend) |
| <http://localhost:3000/vehiculo/1> | Ficha individual de un vehículo |
| <http://localhost:3000/admin> | Panel administrativo |
| <http://localhost:5000/api/catalogo/vehiculos> | API: lista de vehículos (JSON) |
| <http://localhost:5000/api/catalogo/marcas> | API: lista de marcas |
| <http://localhost:5000/api/auth/me> | API: usuario autenticado actual |

Documentación completa de endpoints: ver `backend/backend/README.md`.

---

## Credenciales de prueba (después de cargar `seed.sql`)

| Usuario | Email | Password | Rol |
|---|---|---|---|
| Admin | `admin@concesionaria.com` | `admin123` | ADMIN |
| Cliente | `maria@email.com` | `user1234` | USUARIO_PUBLICO |
| Cliente | `carlos@email.com` | `user1234` | USUARIO_PUBLICO |

> ⚠️ El `seed.sql` trae hashes placeholder. Para que el login funcione necesitas regenerar los hashes con `flask_bcrypt`. Hazlo desde un script o desde el endpoint `/api/auth/registro`.

---

## Troubleshooting común

**Error: `pymysql.err.OperationalError: (1045, "Access denied for user...")`**
→ Revisa `DB_USER` y `DB_PASSWORD` en `backend/.env`. Verifica que el usuario MySQL tenga permisos sobre la BD `concesionaria`.

**Error: `Failed to fetch` desde el frontend**
→ El backend no está corriendo, o el CORS está bloqueando. Confirma que `python run.py` está activo en :5000 y que `backend/__init__.py` tiene `localhost:3000` en los orígenes CORS permitidos.

**Error: `Module not found: '@/lib/api'` en frontend**
→ No corriste `pnpm install` (o no terminó). Repítelo desde `frontend/`.

**Windows: `python: command not found`**
→ Reinstala Python marcando "Add Python to PATH" durante la instalación, o usa `py` en vez de `python`.

**Linux: `permission denied` al iniciar MySQL**
→ Usa `sudo` o configura tu usuario MySQL con `mysql_secure_installation`.

---

## Comandos rápidos de referencia

| Acción | Linux/macOS | Windows (PowerShell) |
|---|---|---|
| Activar venv | `source backend/.venv/bin/activate` | `backend\.venv\Scripts\Activate.ps1` |
| Correr backend | `cd backend && python run.py` | `cd backend; python run.py` |
| Correr frontend | `cd frontend && pnpm dev` | `cd frontend; pnpm dev` |
| Tests backend | `cd backend && pytest backend/tests/` | `cd backend; pytest backend\tests\` |
| Build frontend | `cd frontend && pnpm build` | `cd frontend; pnpm build` |
| Reset DB | `sudo mysql < database/schema.sql && sudo mysql concesionaria < database/seed.sql` | `mysql -u root -p < database\schema.sql; mysql -u root -p concesionaria < database\seed.sql` |

---

## Notas de arquitectura

- **Frontend** y **backend** son procesos **separados** que se comunican por HTTP.
- El frontend usa `lib/api.ts` (cliente fetch tipado) para hablar con la API Flask.
- `lib/data.ts` se conserva como **fallback de datos mock** — útil para desarrollar componentes sin el backend levantado o como datos por defecto.
- El backend autentica con cookies de sesión (`flask-login`); por eso el cliente API usa `credentials: 'include'`.
- CORS está habilitado solo para `localhost:3000` y `127.0.0.1:3000`. Para producción, edita la lista en `backend/backend/__init__.py`.

Para detalles de normalización de la BD (1FN/2FN/3FN), endpoints disponibles y máquina de estados de vehículos, lee `backend/backend/README.md`.
