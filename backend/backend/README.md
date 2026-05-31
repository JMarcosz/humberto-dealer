# Backend — Concesionaria de Alta Gama
**Flask · SQLAlchemy · MySQL · Python 3.12**

---

## Instalación

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # completar valores
```

## Crear BD

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p concesionaria < database/seed.sql
```

## Ejecutar

```bash
export FLASK_APP=backend
flask run
# o
python run.py
```

## Tests

```bash
pytest backend/tests/ -v
```

---

## Endpoints

### Catálogo público (`/api/catalogo`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/marcas` | Lista todas las marcas |
| GET | `/marcas/<id>/modelos` | Modelos de una marca |
| GET | `/vehiculos` | Catálogo paginado con filtros opcionales |
| GET | `/vehiculos/<id>` | Ficha individual de vehículo |

**Filtros disponibles para `/vehiculos`:**
`marca_id`, `modelo_id`, `anio`, `combustible`, `transmision`, `precio_min`, `precio_max`, `page`, `per_page`

---

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/registro` | Registro de usuario | — |
| POST | `/login` | Login con email/password | — |
| POST | `/logout` | Cerrar sesión | Session |
| GET | `/me` | Perfil del usuario actual | Session |
| GET | `/google` | Iniciar OAuth Google | — |
| GET | `/google/callback` | Callback OAuth Google | — |

---

### Admin (`/api/admin`) — Requiere rol ADMIN

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/vehiculos` | Lista completa (incluye borradores) |
| PATCH | `/vehiculos/<id>` | Editar campos del vehículo |
| PATCH | `/vehiculos/<id>/estado` | Cambiar estado (`DISPONIBLE`→`RESERVADO`→`VENDIDO`) |
| POST | `/ventas` | Confirmar venta (marca vehículo como VENDIDO) |
| GET | `/historico` | Histórico de ventas paginado |

---

### Reservas (`/api/reservas`) — Requiere login

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear reserva (pone vehículo en RESERVADO) |
| DELETE | `/<id>` | Cancelar reserva |
| GET | `/mis-reservas` | Reservas del usuario autenticado |

---

### Borradores/Excel (`/api/borradores`) — Requiere ADMIN

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/importar` | Subir `.xlsx` — inicia importación asíncrona |
| GET | `/progreso` | Estado de la importación activa |
| GET | `/exportar` | Descargar inventario completo como `.xlsx` |
| PATCH | `/<id>/aprobar` | BORRADOR → DISPONIBLE |
| PATCH | `/<id>/pendiente` | BORRADOR → PENDIENTE_VALIDACION |

---

### Ubicación (`/api/location`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dealer` | Lat/lng + URLs de Google Maps y Waze |

---

### WhatsApp (`/api/whatsapp`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/webhook` | Verificación de webhook por Meta |
| POST | `/webhook` | Recepción de mensajes — BOT de inventario |

---

## Estructura de archivos

```
backend/
├── __init__.py          # App factory
├── config.py            # Configuración desde .env
├── decorators.py        # @admin_required, @login_required_api
├── validators.py        # Validación MAYÚSCULAS y formatos
├── blueprints/
│   ├── catalog.py       # Catálogo público
│   ├── auth.py          # Autenticación + Google OAuth
│   ├── admin.py         # Panel admin
│   ├── reservas.py      # Sistema de reservas
│   ├── borradores.py    # Importación/exportación Excel
│   ├── location.py      # Ubicación del dealer
│   └── whatsapp.py      # Webhook WhatsApp
├── models/
│   ├── base.py          # Instancia SQLAlchemy
│   ├── geo.py           # Geografía
│   ├── catalog.py       # Marca, Modelo, Vehículo, Imagen
│   ├── users.py         # Usuario, Rol, Cliente, Empleado, Proveedor
│   └── transactions.py  # Reserva, Cita, Venta, Pago, Reseña
├── services/
│   ├── whatsapp.py      # Meta Cloud API
│   ├── google_oauth.py  # Authlib OAuth2
│   └── excel.py         # openpyxl import/export
└── tests/
    └── test_endpoints.py
```

---

## Estados del vehículo

```
BORRADOR ──► PENDIENTE_VALIDACION ──► DISPONIBLE ──► RESERVADO ──► VENDIDO
                                          ▲                │
                                          └────────────────┘ (cancelar reserva)
```
