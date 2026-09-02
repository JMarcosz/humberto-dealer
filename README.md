# Concesionaria de Alta Gama — Humberto Dealer

Aplicación web full-stack de alto rendimiento para una concesionaria de vehículos premium en el mercado de República Dominicana.

---

## ⚡ Despliegue Rápido con Docker (Recomendado)

Con el script de automatización DevOps puedes poner en marcha todo el stack (**Base de Datos + Backend + Frontend**) con **un solo comando**. El script verifica Docker, genera automáticamente el archivo `.env` con claves criptográficas seguras, construye las imágenes optimizadas y sincroniza los usuarios iniciales con contraseñas hasheadas en **bcrypt**.

### En Windows (PowerShell):
```powershell
# Producción optimizada (Next.js Standalone + Gunicorn + MySQL):
.\deploy.ps1

# O en modo desarrollo con Hot-Reloading en tiempo real:
.\deploy.ps1 -Mode dev
```

### En Linux / macOS / Servidores CI-CD:
```bash
chmod +x deploy.sh

# Modo Producción:
./deploy.sh

# Modo Desarrollo:
./deploy.sh --dev
```

### Comandos de Utilidad:
| Acción | PowerShell (Windows) | Bash (Linux/macOS) |
|---|---|---|
| **Ver logs en vivo** | `.\deploy.ps1 -Logs` | `./deploy.sh --logs` |
| **Detener stack** | `.\deploy.ps1 -Down` | `./deploy.sh --down` |
| **Estado de salud** | `.\deploy.ps1 -Status` | `./deploy.sh --status` |
| **Re-ejecutar seed** | `.\deploy.ps1 -Seed` | `./deploy.sh --seed` |

---

## 🛠️ Stack Tecnológico y Arquitectura Docker

| Componente | Tecnología | Optimización de Imagen Docker |
|---|---|---|
| **Frontend** | Next.js 16 · React 19 · Tailwind CSS · shadcn/ui · pnpm | **Multi-stage (`node:20-alpine`) + Standalone**: peso reducido de ~1.2 GB a **~160 MB**. Usuario no root `nextjs` (UID 1001). Proxy rewrite interno hacia el backend. |
| **Backend** | Python 3.12 · Flask 3 · SQLAlchemy · Gunicorn · PyMySQL | **Multi-stage (`python:3.12-slim`)**: aislamiento de dependencias de compilación en virtualenv. Peso final **~180 MB**. Servidor WSGI Gunicorn (3 workers, 2 threads). Usuario no root `appuser` (UID 10001). |
| **Base de Datos** | MySQL 8.0 (`utf8mb4_unicode_ci`) | Auto-inicialización ordenada mediante `/docker-entrypoint-initdb.d/` (`schema.sql` y `seed.sql`). Healthcheck nativo (`mysqladmin ping`) y volumen persistente. |

```
                           [ Navegador Web ]
                                   │
                                   ▼
                       :3000 (Next.js Standalone)
                                   │
                         Rewrite /api/* (SSR Proxy)
                                   │
                                   ▼
                       :5001 (Flask + Gunicorn)
                                   │
                           SQLAlchemy (PyMySQL)
                                   │
                                   ▼
                        :3306 (MySQL 8.0)
```

---

## 📁 Estructura del Proyecto

```
humberto-dealer/
├── docker-compose.yml          ← Orquestación de producción (db, backend, frontend)
├── docker-compose.dev.yml      ← Override para desarrollo local con hot-reload
├── deploy.ps1                  ← Script de automatización DevOps (Windows PowerShell)
├── deploy.sh                   ← Script de automatización DevOps (Linux/macOS)
├── .env.docker.example         ← Plantilla de variables para Docker
├── .dockerignore               ← Exclusiones globales de contexto Docker
│
├── frontend/                   ← Next.js 16 (puerto 3000)
│   ├── app/                    ← App Router: /, /vehiculo/[id], /admin/...
│   ├── components/             ← UI Components (shadcn/ui + Tailwind)
│   ├── Dockerfile              ← Multi-stage build optimizado Next.js Standalone
│   ├── next.config.mjs         ← Configuración de Next.js (output: 'standalone', rewrites)
│   └── package.json
│
├── backend/                    ← Flask 3 + Gunicorn (puerto 5001)
│   ├── backend/                ← Paquete Flask (blueprints, models, services)
│   │   ├── blueprints/         ← catalog, auth, admin, reservas, whatsapp, borradores
│   │   └── services/           ← WhatsApp Business API, Excel, Google OAuth
│   ├── Dockerfile              ← Multi-stage build optimizado Python slim
│   ├── run.py                  ← Entry point de la aplicación Flask
│   ├── seed.py                 ← Inicialización y actualización de credenciales bcrypt
│   └── requirements.txt
│
└── database/                   ← Scripts SQL
    ├── schema.sql              ← Definición de tablas relacionales (3FN)
    └── seed.sql                ← Catálogo y usuarios iniciales de prueba
```

---

## 🌐 URLs y Servicios

Una vez levantados los contenedores:

| Servicio | URL Local | Descripción |
|---|---|---|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | Catálogo público, ficha de vehículos y panel admin |
| **API Health** | [http://localhost:5001/api/health](http://localhost:5001/api/health) | Healthcheck de proceso y conectividad a base de datos |
| **API Catálogo** | [http://localhost:3000/api/catalogo/vehiculos](http://localhost:3000/api/catalogo/vehiculos) | API pública servida a través del proxy Next.js |
| **Base de Datos** | `localhost:3306` | MySQL 8 (Base: `concesionaria`, Usuario: `dealer_user`) |

---

## 🔑 Credenciales Semilla (Seed)

El sistema incluye usuarios preconfigurados para pruebas:

| Rol | Email | Contraseña | Permisos |
|---|---|---|---|
| **ADMIN** | `admin@concesionaria.com` | `admin123` | Acceso total a `/admin`, inventario, importación Excel y gestión de reservas |
| **USUARIO_PUBLICO** | `maria@email.com` | `user1234` | Cliente registrado, creación de reservas y citas de prueba |
| **USUARIO_PUBLICO** | `carlos@email.com` | `user1234` | Cliente registrado de prueba |

> ℹ️ El script `deploy.ps1` / `deploy.sh` ejecuta automáticamente `python seed.py` tras levantar la base de datos para asegurar que estos usuarios cuenten con hashes válidos de `flask_bcrypt`.

---

## 💻 Desarrollo Manual (Sin Docker)

Si prefieres ejecutar los servicios directamente en tu entorno local sin contenedores:

### Prerrequisitos
- **Python**: 3.11 o 3.12
- **Node.js**: 20 LTS o superior
- **pnpm**: `npm install -g pnpm`
- **MySQL**: Servidor MySQL 8.x en ejecución

### 1. Base de Datos
```bash
# Crear base de datos y cargar esquema + datos iniciales
mysql -u root -p < database/schema.sql
mysql -u root -p concesionaria < database/seed.sql
```

### 2. Backend (Terminal 1)
```powershell
# En Windows:
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Configura DB_USER, DB_PASSWORD y SECRET_KEY en .env
python seed.py
flask run --port 5001
```

```bash
# En Linux/macOS:
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py
flask run --port 5001
```

### 3. Frontend (Terminal 2)
```bash
cd frontend
pnpm install
# Asegúrate de que .env tenga:
# NEXT_PUBLIC_API_URL=/api
# BACKEND_URL=http://localhost:5001/api
pnpm dev
```

---

## 🔒 Seguridad y Buenas Prácticas

- **Contenedores Non-Root**: Los procesos no se ejecutan como `root` dentro de Docker para prevenir escapes de contenedor.
- **Validación de Carga de Archivos**: Validación estricta de Magic Bytes en subida de imágenes (JPEG, PNG, WEBP, GIF).
- **Protección contra Inyección en Excel**: Sanitización automática de fórmulas maliciosas en importaciones/exportaciones de inventario (CWE-1236).
- **Concurrencia en Reservas**: Bloqueo pesimista a nivel de fila (`with_for_update()`) para evitar condiciones de carrera (TOCTOU).
- **Firmas Criptográficas**: Verificación de firmas HMAC-SHA256 en webhooks de Meta WhatsApp Business API.
- **Headers de Seguridad**: Políticas HTTP estrictas aplicadas (`X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `Permissions-Policy`).
