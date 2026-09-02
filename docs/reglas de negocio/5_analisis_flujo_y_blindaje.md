# ANÁLISIS DE FLUJO Y BLINDAJE DE REGLAS DE NEGOCIO

**Proyecto:** Humberto Car Rental
**Alcance:** flujo de usuario extremo a extremo, lógica de negocio y refuerzo del backend
**Fecha:** 2 de septiembre de 2026
**Principio rector:** *las reglas de negocio viven en el backend y en ningún otro sitio.*

---

## 1. EL PROBLEMA: EL FLUJO NO ESTABA ATADO

Todo el estado de una reserva viajaba por la barra de direcciones, y nada lo verificaba del lado del servidor.

```
Home  → rental-search-widget.tsx   validaba SOLO en cliente (diffHours < 23)
      → /renta/disponibilidad?fecha_inicio=&fecha_fin=&sucursal_*
      → rental-vehicle-card.tsx:37 concatenaba esos mismos parámetros
      → /renta/checkout?vehiculo_id=&fecha_inicio=&fecha_fin=&sucursal_*
      → POST /api/renta/reservas          (anónimo, sin límite de tasa)
      → GET  /api/renta/reservas/<pnr>    (público: cédula, licencia, fecha de nacimiento)
```

Ningún parámetro se firmaba ni se derivaba de la sesión. Editando la URL —o llamando la API con `curl`— el usuario operaba fuera de lo propuesto.

A esto se sumaban dos problemas estructurales:

**Excepciones no capturadas.** Cada endpoint envolvía su cuerpo en un `except Exception` genérico y las coerciones (`int(vid)`, `float(precio)`, `str_inicio.replace(...)`) reventaban dentro de él. El servidor no distinguía *"el usuario mandó basura"* de *"el servidor falló"*, y además perdía el traceback (`log.error("%s", exc)` en los 12 sitios donde aparecía).

**Reglas duplicadas en React.** No solo faltaban reglas en el backend: había lógica de negocio reimplementada en TypeScript que ya existía en Python. Dos copias que nadie sincronizaba y que **ya divergían**.

| Regla | Copia en React | Copia en backend | ¿Divergían? |
| :--- | :--- | :--- | :--- |
| Días facturables (gracia 59 min) | `checkout/page.tsx:127` | `renta.py:23` | Misma fórmula escrita dos veces |
| Cálculo de edad | `checkout/page.tsx:152-166` | `renta.py:38` | — |
| Edad mínima 21 | `checkout/page.tsx:172` | `renta.py:246` | — |
| Subtotales y depósito | `checkout/page.tsx:124-143` | `renta.py:307-329` | **Sí** — el cliente replicaba el mismo `\|\|` roto |
| Duración mínima | `rental-search-widget.tsx:102` (**23 h**) | no existía | **Sí** — el cliente decía 23, la política 24 |

---

## 2. QUÉ PODÍA HACER EL USUARIO MÁS ALLÁ DE LO PROPUESTO

### 2.1 Contrato temporal
| Abuso | Causa |
| :--- | :--- |
| Reservar con fechas en el pasado | La única validación era `f_fin > f_inicio` |
| Reservar 1 hora y pagar 1 día | El backend no validaba duración mínima |
| Reservar 10 años | Sin duración máxima ni horizonte de anticipación |
| Recogida inmediata | El margen de 2 h del DoD no existía en ningún lado |

### 2.2 Carrito
| Abuso | Causa |
| :--- | :--- |
| `{"id":1,"cantidad":999999}` | Solo `max(1, …)`, sin tope superior |
| Repetir el mismo extra N veces | No se deduplicaba; se insertaban N filas |
| Pedir un extra inactivo | **Se ignoraba en silencio**: el cliente pagaba un total que no incluía lo que creyó comprar |
| Reservar en sucursal cerrada | Se validaba que existiera, no que estuviera activa |
| `extras_ids: "abc"` | `for item in "abc"` iteraba caracteres → 500 |

### 2.3 Reglas que solo vivían en el navegador
- **Aceptación de términos**: existía solo como estado de React, **precargada en `true`**, y nunca se enviaba ni se persistía. No había constancia de aceptación de un contrato con fianza.
- **Fecha de nacimiento**: precargada con `'1995-05-15'`, de modo que la validación de edad pasaba sin que el usuario declarara nada.

### 2.4 Sustitución silenciosa de vehículo
`checkout/page.tsx:98` — `setVehicle(found || disp.vehiculos[0])`. Si el auto elegido dejaba de estar disponible, la aplicación lo reemplazaba por el primero de la lista y reservaba ese. **El usuario podía pagar por un auto que nunca eligió.**

### 2.5 Privacidad
- `GET /api/renta/reservas/<pnr>`: público, sin límite de tasa, devolvía cédula, licencia y fecha de nacimiento.
- `POST /api/renta/reservas`: anónimo y sin límite. Un bucle inmovilizaba la flota.
- **Ningún endpoint de renta tenía `@limiter.limit`.**

### 2.6 Máquina de estados
- `CANCELADA` existía en el enum **sin ningún productor**: nadie podía cancelar y toda reserva bloqueaba el calendario para siempre.
- Sin no-show ni expiración: una reserva vencida seguía bloqueando y seguía siendo elegible para check-in.
- Check-in sin ventana temporal: se podía entregar hoy un auto reservado para dentro de seis meses.
- Check-out sin validar el odómetro, y `if not odometro` rechazaba el `0` (un auto nuevo no podía entregarse).
- **Venta y renta desconectadas**: `reservas.py:38` nunca consultaba el calendario, así que un auto con renta confirmada podía venderse.

### 2.7 Regla de ingreso no aplicada
`renta.py:329` — `cobertura.deposito_requerido or tarifa.deposito_garantia`. El campo era `NOT NULL DEFAULT 800`, así que el operando derecho **jamás se evaluaba**: los depósitos por categoría sembrados (450/600/800) eran código muerto y una VAN de $75/día pedía la misma fianza que un Spark de $38/día.

### 2.8 Hallazgos adicionales
- `admin.py:641` sobrescribía `disponible_para` a `AMBOS` en **toda** llamada a `/renta/tarifas`: cambiar un precio reconvertía el vehículo en silencio.
- `migrations/add_performance_indexes.sql` usaba `CREATE INDEX IF NOT EXISTS`, sintaxis **MariaDB**, sobre un MySQL 8.0 (`docker-compose.yml`). El archivo fallaba en su primera sentencia.
- `next.config.mjs:15` tiene `typescript: { ignoreBuildErrors: true }`: el build de producción no falla ante errores de tipos.

---

## 3. LA SOLUCIÓN: UNA CAPA DE POLÍTICA EN EL SERVIDOR

### 3.1 Arquitectura

| Archivo | Importa | Rol |
| :--- | :--- | :--- |
| `backend/errors.py` | nada | `ReglaNegocioError(mensaje, status, codigo, detalles)` |
| `backend/decorators.py` | flask, db, errors | `maneja_errores_renta` |
| `backend/services/renta_politica.py` | errors, validators | constantes + coerción + funciones puras |
| `backend/services/renta_calendario.py` | models, política | todo lo que toca la base de datos |

**Invariante:** `renta_politica.py` **no importa `db` ni `flask`**. Toda la lógica de negocio se verifica con pytest sin `app_context` ni base de datos.

### 3.2 El backend publica sus propias reglas

Dos endpoints nuevos son la pieza que permite borrar la lógica duplicada del frontend:

- **`GET /api/renta/politica`** — devuelve las constantes (duración mínima/máxima, lead time, horizonte, edad, topes). La UI las usa como `min`/`max` de los selectores. Si mañana la duración mínima pasa a 12 h, se cambia una constante en Python y el widget se adapta solo.
- **`POST /api/renta/cotizar`** — mismo payload que la reserva, no persiste nada, y por dentro ejecuta **exactamente** `calcular_totales` y `calcular_deposito`, las mismas funciones que el checkout. Por construcción, la cifra que el usuario ve es la que se cobra.

### 3.3 Manejo de errores

El decorador `maneja_errores_renta` traduce a dos niveles: `ReglaNegocioError` → status tipado con `codigo` estable; cualquier otra excepción → 500 con `log.exception` (que preserva el traceback que antes se perdía). **Los blueprints de renta no contienen ni un solo `try`.**

### 3.4 Reglas ahora aplicadas en el servidor

| Regla RD | Estado anterior | Ahora |
| :--- | :--- | :--- |
| 1 · Duración mínima 24 h + gracia 59 min | Solo cliente (mal: 23 h) | `validar_ventana_reserva` |
| 1 · Cargo por retraso | No existía | `calcular_penalidades`, topado a una tarifa diaria por bloque de 24 h |
| 2 · Edad mínima 21 | Sí, pero contra `date.today()` | Contra la **fecha de recogida** |
| 2 · Recargo conductor joven 21-24 | No existía | `calcular_recargo_young_driver` |
| 4 · Depósito por categoría | Código muerto | `max(DEPOSITO_MINIMO, base × (1 − reducción%))` |
| 5 · Cargo por combustible faltante | No existía | `calcular_penalidades`, por octavos |
| 6 · Kilometraje ilimitado | Sí | Sin cambios |
| 7 · Paso Rápido | Sí | Sin cambios |

### 3.5 Depósito: porcentaje, no absoluto

```
deposito = max(DEPOSITO_MINIMO, base_del_vehiculo × (1 − reduccion_pct / 100))
```

`TarifaRenta.deposito_garantia` es el único sitio donde vive el riesgo por auto; `CoberturaSeguro.reduccion_deposito_pct` el único donde vive la mitigación. Cada eje se edita por separado. `deposito_requerido` se conserva huérfano para que revertir sea trivial; su `DROP` va en un PR posterior.

| Vehículo | Base | TPL 0 % | CDW 50 % | Total 100 % |
| :--- | ---: | ---: | ---: | ---: |
| SEDAN | 450 | 450 | 225 | 200 (piso) |
| VAN | 800 | 800 | 400 | 200 (piso) |

### 3.6 Reconciliación venta ↔ renta

Hay dos máquinas de estado sobre el mismo activo. El contrato quedó así:

| | `Vehiculo.estado` | `disponible_para` | Calendario |
| :--- | :--- | :--- | :--- |
| **Reservar VENTA** | `== DISPONIBLE` | `in (VENTA, AMBOS)` | **sin** rentas activas con `fecha_fin > ahora` |
| **Reservar RENTA** | `in (DISPONIBLE, RENTADO)` | `in (RENTA, AMBOS)` | sin colisión en la ventana pedida |

La asimetría es deliberada: **una venta es un evento terminal** (el auto sale de la flota) y mira todo el futuro; **una renta es un intervalo** y solo mira su ventana. El estado `RENTADO` es nuevo: el check-in lo aplica y el check-out lo revierte, de modo que un auto en manos de un turista queda fuera del embudo de venta.

### 3.7 Límites de tasa

| Endpoint | Límite |
| :--- | :--- |
| `GET /renta/disponibilidad` | 30/min; 300/h |
| `POST /renta/reservas` | 5/h; 20/día **+ tope de 3 reservas activas por documento** |
| `GET /renta/reservas/<pnr>` | 60/h, más 5/min **que solo consumen los intentos fallidos** |
| `POST /renta/cotizar` | 30/min |
| Admin check-in / check-out | 60/min |

El control anti-abuso que de verdad importa es **el tope por documento**, no la IP: es inmune al NAT compartido de un hotel o un aeropuerto. Y el `deduct_when` del voucher hace que un turista que teclea bien su apellido nunca vea un 429, aunque recargue cincuenta veces.

### 3.8 Voucher con segundo factor

`GET /api/renta/reservas/<pnr>?apellido=` o `?doc4=`. Sin factor → 403. Con factor incorrecto → **exactamente la misma respuesta que un PNR inexistente**, para no confirmar que el código existe. La respuesta pública enmascara documento y licencia, y **omite la fecha de nacimiento** (una fecha no se enmascara de forma útil, se quita).

En el frontend el turista casi nunca ve el formulario: el checkout guarda la reserva en `sessionStorage` antes de redirigir, así que el camino feliz no hace ni un GET. El formulario aparece solo en carga en frío (link de correo, otro dispositivo). **El apellido nunca viaja en la URL de la página**: quedaría en el historial, en el `Referer` y en los logs de acceso.

---

## 4. EL FRONTEND CONSUME, NO DECIDE

El trabajo en el cliente fue mayoritariamente de **resta**:

| Se eliminó | Lo sustituye |
| :--- | :--- |
| `checkout/page.tsx:124-143` — subtotales, extras, depósito | respuesta de `POST /renta/cotizar` |
| `checkout/page.tsx:127` — días recalculados en TS | `cotizacion.dias_facturables` |
| `checkout/page.tsx:152-166` — `calcularEdad` | `cotizacion.edad_conductor` |
| `checkout/page.tsx:172` — `edadConductor < 21` | el 422 tipado del backend, mostrado literal |
| `rental-search-widget.tsx:102` — `diffHours < 23` | `min`/`max` derivados de `GET /renta/politica` |
| `disponibilidad/page.tsx:81-88` — filtrado en el navegador | filtros del servidor |

Lo que se añadió es fontanería, no reglas: `ApiError` con `status` y `codigo` (antes se lanzaba `new Error("422: mensaje")` y esa cadena se pintaba cruda), el recargo por conductor joven visible **antes** de reservar, y el depósito real de cada cobertura para *ese* vehículo.

También se corrigieron dos defectos que no eran reglas: la sustitución silenciosa de vehículo y los campos precargados.

---

## 5. VERIFICACIÓN

**Suite nueva `test_renta_abuso.py` — 61 pruebas.** Intenta explícitamente romper cada regla: coerción basura, fechas en el pasado, duraciones absurdas, `cantidad: 999999`, extras duplicados e inactivos, sucursales cerradas, transiciones inválidas, odómetro regresivo, enumeración de PNR, tope por conductor y colisión venta↔renta.

**Aserción transversal mecanizada:** un `after_request` registra toda respuesta ≥ 500 y una fixture `autouse` falla el test que la haya provocado. **Ninguna entrada de usuario produce un error de servidor.**

```
69 passed          (61 de abuso + 8 de regresión)
npx tsc --noEmit   exit 0
```

**Paridad cotización ↔ reserva:** para una matriz de vehículo × cobertura × extras × edad, ambos endpoints devuelven cifras idénticas en los seis campos del desglose. Si divergen, hay lógica duplicada en algún sitio.

**Sin reglas en el frontend:** `grep` sobre `frontend/` no encuentra ningún literal de negocio (`3540`, `86400`, `< 21`, `deposito_requerido`, `calcularEdad`) fuera de `lib/types.ts`.

---

## 6. MIGRACIÓN

`backend/backend/migrations/2026_01_renta_hardening.sql` — **idempotente sobre MySQL 8** mediante procedimientos que consultan `information_schema` (MySQL 8 no admite `ADD COLUMN IF NOT EXISTS`; eso es MariaDB). Añade 17 columnas a `reservas_renta`, los estados `NO_SHOW` y `EXPIRADA`, el estado `RENTADO` del vehículo, `reduccion_deposito_pct` con backfill, y el índice compuesto `(vehiculo_id, estado, fecha_inicio, fecha_fin)` que cubre el predicado de colisión.

En el mismo PR se corrigió `add_performance_indexes.sql`, que estaba roto sobre MySQL.

> **Importante:** `db.create_all()` no altera tablas existentes. Sobre una base ya poblada, las columnas nuevas solo aparecen ejecutando el `.sql`.

---

## 7. PENDIENTE

**Verificación de infraestructura del rate limiting (Fase 0 del plan, no ejecutable sin el entorno desplegado).** `next.config.mjs` enruta `/api/*` por un rewrite de Next, que no propaga `X-Forwarded-For`, y no existe `frontend/middleware.ts`. Si `get_remote_address()` resuelve a la IP del servidor Next en lugar de la del turista, **los límites por IP se vuelven globales** y el primer bot deja fuera a todos. Los controles que no dependen de la IP (tope por documento, segundo factor, `deduct_when`) funcionan igualmente.

Comprobación: registrar `request.remote_addr` / `X-Forwarded-For` / `request.access_route` y golpear desde dos redes distintas. Si colapsan a una sola IP, hace falta un `middleware.ts` que inyecte la IP real antes del rewrite, con una `key_func` restringida a la red del proxy para que no se pueda falsificar. Además conviene fijar `RATELIMIT_STORAGE_URI`: sin él, flask-limiter usa memoria por proceso y con N workers el límite efectivo es N×.
