# EVALUACIÓN DEL SISTEMA: PLATAFORMA DE RENTA DE AUTOS

**Proyecto:** Humberto Car Rental (Concesionaria → Car Rental Engine)
**Alcance evaluado:** `US-RENT-01` … `US-RENT-05` — módulo de renta completo (backend + frontend)
**Rama:** `main` (working tree con cambios sin commitear)
**Fecha de evaluación:** 2 de septiembre de 2026
**Método:** revisión de código contra los tres documentos de `docs/reglas de negocio/`, más ejecución real de la suite de pruebas y del typecheck.

---

## 0. VEREDICTO EJECUTIVO

El módulo de renta está **entregado y es funcional de extremo a extremo**: se puede buscar por fechas, ver flota con tarifa diaria, elegir cobertura y extras, hacer checkout con PNR, ver el voucher y operar check-in/check-out desde el panel administrativo. La arquitectura es limpia y consistente con el resto del proyecto (`models/renta.py` + `blueprints/renta.py`, admin bajo `@admin_required`, tipado completo en el frontend).

Sin embargo, **la evaluación no confirma el nivel de terminación que declara el informe de implementación**. Hay tres categorías de brecha:

| Categoría | Estado |
| :--- | :--- |
| Alcance funcional (5 historias navegables) | ✅ Entregado |
| Cumplimiento del *Definition of Done* documentado | ⚠️ ~78% (14 / 18 criterios) |
| Reglas de negocio obligatorias RD (7 reglas) | ⚠️ 3 completas, 3 parciales, 1 no aplicada |
| Seguridad y privacidad de datos del conductor | ❌ Brecha crítica sin resolver |

**Recomendación:** apto para demo y defensa académica. **No apto para producción** hasta cerrar los cuatro hallazgos de severidad ALTA de la sección 4.

---

## 1. VERIFICACIÓN INDEPENDIENTE DE LAS AFIRMACIONES DEL INFORME

El documento `3_informe_de_lo_implementado_walkthrough.md` hace dos afirmaciones verificables. Se ejecutaron ambas.

### 1.1 Pruebas automatizadas

**Afirmado:** "8 tests pasando al 100%".
**Resultado real** (`python -m pytest backend/tests/ -q` desde `backend/`):

```
8 passed, 21 warnings, 11 errors in 30.20s
```

* Los **8 tests de `test_renta_endpoints.py` pasan**. La afirmación es correcta *para el módulo de renta*.
* Los **11 tests de `test_endpoints.py` (suite legacy) fallan en setup**: `ConnectionRefusedError` contra `mysql+pymysql://root:***@127.0.0.1:3306/concesionaria`.

**Matiz importante:** esto no es una regresión introducida por el trabajo de renta — la suite legacy siempre dependió de un MySQL vivo. Pero significa que la suite completa del proyecto **no es hermética** y que el titular "8/8 al 100%" describe el 42% de los tests existentes. La nueva suite de renta hizo lo correcto (SQLite in-memory); la legacy quedó atrás.

### 1.2 Typecheck de TypeScript

**Afirmado:** "0 errores encontrados en todo el frontend".
**Resultado real** (`npx tsc --noEmit` desde `frontend/`): **exit code 0, sin salida.** ✅ Confirmado.

### 1.3 Corrección del cálculo de días facturables

Se verificó manualmente la fórmula de `renta.py:calcular_dias_facturables` contra la Regla 1 de RD:

| Duración | Cálculo | Días | ¿Correcto? |
| :--- | :--- | :--- | :--- |
| 24 h 00 min | `ceil((86400−3540)/86400)` = `ceil(0.959)` | 1 | ✅ |
| 24 h 59 min | `ceil((89940−3540)/86400)` = `ceil(1.000)` | 1 | ✅ (gracia respetada) |
| 25 h 00 min | `ceil((90000−3540)/86400)` = `ceil(1.0007)` | 2 | ✅ (día adicional) |

La implementación del período de gracia de 59 minutos es **matemáticamente correcta**.

---

## 2. CUMPLIMIENTO POR HISTORIA DE USUARIO (vs. Definition of Done)

### `US-RENT-01` — Motor de búsqueda y disponibilidad — **3 / 4**

| # | Criterio DoD | Estado | Evidencia |
| :-- | :--- | :--- | :--- |
| 1 | Entidad `sucursales` (SDQ, Piantini, JBQ) | ✅ | `models/renta.py:Sucursal`, `seed.py:81-118` |
| 2 | Algoritmo de colisión temporal SQL | ✅ | `blueprints/renta.py:129-138`, con índice `ix_reservas_renta_fechas` |
| 3 | Días facturables con gracia de 59 min | ✅ | Verificado en §1.3 |
| 4 | Widget con validación ≥ ahora+2h y mínimo 24h | ⚠️ | `rental-search-widget.tsx:102` usa `diffHours < 23` (permite 23h) y **no valida el margen de 2 horas** |

**Brecha adicional no listada en el DoD pero sí en el contrato REST (doc 2 §3.1):** el endpoint declara `sucursal_recogida_id` y `sucursal_devolucion_id`, el widget los envía en la URL, pero `blueprints/renta.py` **nunca los usa como filtro**. No existe relación vehículo ↔ sucursal en el modelo de datos. Un auto estacionado en La Isabela (JBQ) aparece como disponible para retiro en Las Américas (SDQ).

---

### `US-RENT-02` — Catálogo de flota con tarificación diaria — **3.5 / 4**

| # | Criterio DoD | Estado | Evidencia |
| :-- | :--- | :--- | :--- |
| 1 | Tabla `tarifas_renta` (precio/día, depósito, moneda) | ✅ | `models/renta.py:TarifaRenta` |
| 2 | Atributos de capacidad en `vehiculos` | ✅ | `models/catalog.py:93-96` |
| 3 | API enriquecida (precio/día, días, total, depósito) | ✅ | `renta.py:181-188` |
| 4 | Filtros por categoría, transmisión y capacidad | ⚠️ | Filtrado **client-side** en `disponibilidad/page.tsx:81-88`; el backend soporta los parámetros (`renta.py:149-154`) pero el frontend no los envía |

**Desviación de diseño:** el plan pedía categorías de flota (*Económico, Compacto, Intermedio, SUV, Van*). Lo implementado reutiliza el enum de concesionaria `Modelo.categoria` (`SEDAN, SUV, COUPE, CONVERTIBLE, PICKUP, VAN, OTRO`), que es una taxonomía de venta, no de renta. Funciona, pero no es el estándar de la industria que el análisis exigía.

---

### `US-RENT-03` — Coberturas y servicios adicionales — **3 / 3** ✅

| # | Criterio DoD | Estado |
| :-- | :--- | :--- |
| 1 | Tablas `coberturas_seguro` y `extras_servicio` | ✅ |
| 2 | `GET /api/renta/coberturas` y `/extras` | ✅ |
| 3 | Vista comparativa con cálculo reactivo | ✅ `checkout/page.tsx:124-143` |

**La única historia con cumplimiento completo del DoD.** Los 3 niveles de cobertura y los 4 extras del mercado dominicano (silla de infante, Paso Rápido, conductor adicional, Wi-Fi) están sembrados y son funcionales.

---

### `US-RENT-04` — Checkout, conductor y voucher PNR — **2.5 / 4**

| # | Criterio DoD | Estado | Evidencia |
| :-- | :--- | :--- | :--- |
| 1a | Edad ≥ 21 años | ✅ | `renta.py:246-250` (422 con mensaje explícito) |
| 1b | **Recargo Young Driver (21–24 años)** | ❌ | 0 coincidencias en todo el backend |
| 1c | **Licencia vigente posterior a la devolución** | ❌ | No existe campo de vencimiento en `ReservaRenta` |
| 2 | PNR único de 6–8 caracteres | ✅ | `HA-` + 5 alfanuméricos = 8 chars, con reintento y fallback |
| 3 | Endpoint transaccional atómico | ⚠️ | Bloqueo pesimista y re-chequeo de colisión ✅; **el "envía confirmación" del DoD no está implementado** (no hay correo ni WhatsApp saliente) |
| 4 | Voucher `/renta/confirmacion/[pnr]` | ✅ | 309 líneas, con itinerario, liquidación, checklist e impresión |

---

### `US-RENT-05` — Panel de operaciones (check-in / check-out) — **2 / 3**

| # | Criterio DoD | Estado | Evidencia |
| :-- | :--- | :--- | :--- |
| 1 | Tabla `inspecciones_renta` | ✅ | `models/renta.py:InspeccionRenta`. *Nota:* las fotos se guardan como CSV en un `TEXT`, no en los campos `foto_tablero_url` / `foto_vehiculo_url` que especificaba el plan |
| 2 | Check-in con búsqueda por PNR y transición a `EN_CURSO` | ✅ | `admin.py:510-556`. *Nota:* el plan decía que el vehículo pasa a estado operativo `EN_RENTA`; `vehiculo.estado` no se toca (decisión defendible en un modelo por calendario, pero conviene documentarla) |
| 3 | **Check-out con cálculo automático de penalidades** | ❌ | `admin.py:566-620` registra odómetro y combustible pero **no calcula cargo por combustible faltante ni por horas de retraso**. El mensaje de respuesta afirma "depósito en garantía liberado" sin liquidación previa |

La pantalla móvil de patio (`app/admin/renta/[id]/inspeccion/page.tsx`) se resolvió con modales dentro de `app/admin/renta/page.tsx`. Sustitución aceptable.

---

## 3. COBERTURA DE LAS 7 REGLAS DE NEGOCIO OBLIGATORIAS (RD)

| # | Regla | Estado | Observación |
| :-- | :--- | :--- | :--- |
| 1 | Duración mínima 24 h + gracia 59 min | ⚠️ | Backend correcto y verificado. Frontend acepta 23 h (`rental-search-widget.tsx:102`) |
| 2 | Edad mínima 21 + licencia ≥ 2 años + Young Driver Fee | ⚠️ | Solo se valida la edad. Faltan antigüedad de licencia y recargo |
| 3 | TPL obligatorio + CDW + Cero Deducible | ✅ | Tres niveles sembrados con depósito y deducible diferenciados |
| 4 | **Depósito de garantía variable por categoría** | ❌ | Sembrado (450 / 600 / 800 USD según categoría en `seed.py:213-222`) pero **nunca aplicado** — ver hallazgo H-04 |
| 5 | Combustible Lleno a Lleno + cargo por faltante | ⚠️ | La política se muestra y se registra el nivel en octavos; **el cargo por galón faltante no se calcula** |
| 6 | Kilometraje ilimitado | ✅ | `TarifaRenta.kilometraje_incluido = "ILIMITADO"`, expuesto como badge |
| 7 | Peajes Paso Rápido como extra | ✅ | Extra `PASO_RAPIDO` sembrado a US$ 5/día |

---

## 4. HALLAZGOS

Ordenados por severidad. Todos verificados en el código, no inferidos.

### 🔴 ALTA

#### H-01 — Fuga de datos personales del conductor por PNR público

`backend/backend/blueprints/renta.py:409`

`GET /api/renta/reservas/<pnr>` **no exige autenticación ni tiene límite de tasa**, y devuelve el bloque completo `conductor`: nombre, apellido, email, teléfono, **número de documento (cédula/pasaporte), número de licencia y fecha de nacimiento**.

El espacio de PNR es `HA-` + 5 caracteres alfanuméricos (~60 M combinaciones), pero `limiter` solo está aplicado en `auth.py:43` y `auth.py:81` — ningún endpoint de renta está limitado. Un script puede enumerar reservas y cosechar identidades completas.

**Corrección mínima:** exigir un segundo factor en la consulta (apellido o últimos 4 del documento), aplicar `@limiter.limit("10 per minute")` y recortar el documento y la licencia de la respuesta pública.

#### H-02 — Creación de reservas sin autenticación ni límite de tasa

`backend/backend/blueprints/renta.py:213`

`POST /api/renta/reservas` es completamente anónimo y sin rate limit. Cada llamada exitosa bloquea el calendario de un vehículo. Un actor puede inmovilizar la flota completa con un bucle, sin dejar cliente asociado (`cliente_id` queda `NULL` cuando no hay sesión).

**Corrección mínima:** `@limiter.limit("5 per hour")` por IP, más expiración automática de reservas sin cliente asociado.

#### H-03 — Colisión entre el flujo de venta y el de renta

`backend/backend/blueprints/reservas.py:38` y `reservas.py:65`

`seed.py:225` marca **todos** los vehículos como `disponible_para = "AMBOS"`. Con eso, los dos módulos se pisan en ambas direcciones:

* **Venta → renta:** reservar un auto para venta ejecuta `vehiculo.estado = "RESERVADO"`, y `renta.py:143` filtra por `estado == "DISPONIBLE"`. El auto desaparece de la renta **para todas las fechas futuras**, incluso las que no tienen conflicto.
* **Renta → venta:** `reservas.py:38` solo comprueba `vehiculo.estado != "DISPONIBLE"`. **No consulta el calendario de `reservas_renta`.** Un auto con renta CONFIRMADA para la próxima semana puede reservarse y venderse hoy.

**Corrección mínima:** en `reservas.py` rechazar si existe una `ReservaRenta` activa; en `renta.py` distinguir el bloqueo por venta del bloqueo por calendario.

#### H-04 — El depósito de garantía por categoría nunca se aplica (Regla 4)

`backend/backend/blueprints/renta.py:329`

```python
deposito_garantia = float(cobertura.deposito_requerido or vehiculo.tarifa_renta.deposito_garantia)
```

`CoberturaSeguro.deposito_requerido` es `nullable=False` con `default=800.00`, así que **el operando derecho jamás se evalúa**. Los depósitos por categoría que `seed.py:213-222` asigna cuidadosamente (450 USD económico, 600 SUV/pickup, 800 van/convertible) son código muerto: toda reserva usa el depósito de la cobertura.

Efecto secundario del `or`: si alguna vez una cobertura tuviera depósito `0.00`, Python lo trataría como falsy y saltaría silenciosamente al depósito del vehículo.

**Corrección:** combinar ambos —el depósito real es el del vehículo reducido por la cobertura— y usar comprobación explícita `is not None`.

---

### 🟠 MEDIA

#### H-05 — El checkout puede reservar un vehículo distinto al elegido

`frontend/app/renta/checkout/page.tsx:98`

```tsx
setVehicle(found || (disp.vehiculos.length > 0 ? disp.vehiculos[0] : null))
```

Si el vehículo que el usuario seleccionó ya no está disponible al abrir el checkout, la aplicación lo **sustituye silenciosamente por el primer auto de la lista** y `handleSubmit` envía `vehicle!.id`. El usuario puede terminar con una reserva confirmada de un auto que nunca eligió.

**Corrección:** cuando `found` sea `undefined`, mostrar el estado "Vehículo no disponible" que ya existe en `page.tsx:227-236`, en lugar de sustituir.

#### H-06 — Formulario de checkout precargado con valores de demostración

`frontend/app/renta/checkout/page.tsx:73` y `:75`

```tsx
const [fechaNacimiento, setFechaNacimiento] = useState('1995-05-15')
const [aceptaTerminos,  setAceptaTerminos]  = useState(true)
```

La aceptación de términos y política de depósito viene **pre-marcada**, y la fecha de nacimiento viene precargada con un valor que satisface la validación de edad. Un usuario puede reservar sin haber declarado su fecha real ni haber aceptado activamente nada. En un contrato de alquiler con fianza esto es un problema legal, no cosmético.

**Corrección:** ambos deben iniciar vacíos / `false`.

#### H-07 — Sin validación de fechas en el pasado ni del margen de 2 horas

`backend/backend/blueprints/renta.py:117` y `:262`

La única validación temporal es `f_fin > f_inicio`. Es posible crear una reserva **con fechas pasadas**. El DoD de `US-RENT-01` exigía "fecha de recogida ≥ fecha actual + 2 horas" y esa regla no está ni en el backend ni en el widget.

#### H-08 — Las tablas nuevas dependen de `db.create_all()`, sin migración

`backend/migrations/` contiene únicamente `add_performance_indexes.sql`.

Las 6 tablas nuevas y las 5 columnas añadidas a `vehiculos` (`disponible_para`, `pasajeros`, `maletas_grandes`, `maletas_pequenas`, `tiene_aire_acondicionado`) se crean vía `db.create_all()` en `run.py:10` y `seed.py:20`. **`create_all()` crea tablas ausentes pero no altera tablas existentes**: sobre una base MySQL ya poblada, las tablas de renta aparecerán pero las columnas nuevas de `vehiculos` **no**, y el módulo fallará en tiempo de ejecución.

**Corrección:** añadir un `ALTER TABLE` en `migrations/` o incorporar Alembic.

#### H-09 — Check-out sin liquidación financiera

`backend/backend/blueprints/admin.py:566-620`

Ver DoD `US-RENT-05` §3. El endpoint responde *"Renta finalizada y depósito en garantía liberado"* sin haber comparado el combustible de entrega contra el de devolución, ni la hora real contra la pactada. Para un negocio cuyo margen está justamente en esos cargos, es la brecha funcional más costosa.

---

### 🟡 BAJA

| ID | Hallazgo | Ubicación |
| :-- | :--- | :--- |
| H-10 | Los extras de pago único ignoran la cantidad: `costo_ex if es_pago_unico else costo_ex * dias * cant` | `renta.py:324` |
| H-11 | Todo el cálculo monetario pasa por `float()` pese a que los modelos son `Numeric(10,2)`; riesgo de centavos en importes largos | `renta.py:307-328` |
| H-12 | `@cache.cached(timeout=600)` en sucursales, coberturas y extras sin invalidación desde el panel admin: un cambio de tarifa tarda hasta 10 min en verse | `renta.py:58, 71, 84` |
| H-13 | `with_for_update()` es un no-op en SQLite, que es justamente el motor de los tests. La atomicidad frente a doble reserva **no está cubierta por ninguna prueba**; funciona en MySQL/InnoDB pero no está demostrada | `renta.py:266` |
| H-14 | `except (ImportError, Exception)` — `Exception` ya cubre `ImportError`; captura todo fallo de importación de OAuth en silencio | `auth.py:5-9` |
| H-15 | Los filtros de flota no aprovechan el backend: se descarga la lista completa y se filtra en el navegador | `disponibilidad/page.tsx:81-88` |

---

## 5. FORTALEZAS RECONOCIDAS

No todo son brechas. Lo siguiente está bien resuelto y merece constar:

1. **Cálculo de días facturables correcto.** Verificado en los tres bordes (24 h, 24 h 59 m, 25 h). La regla más característica del negocio está bien implementada.
2. **Algoritmo de solapamiento correcto y con soporte de índices.** El predicado `inicio < nuevo_fin AND fin > nuevo_inicio` es el estándar, y `ix_reservas_renta_fechas` + `ix_reservas_renta_estado` lo respaldan.
3. **Patrón de concurrencia correcto.** Bloqueo pesimista sobre la fila del vehículo **seguido de** re-verificación de colisión dentro de la misma transacción. Es el orden correcto; muchos sistemas comerciales lo hacen mal.
4. **Testabilidad desbloqueada.** `create_app(config_override)` y el guardado `if not app.config.get("TESTING")` sobre el hilo de seguimiento de WhatsApp (`__init__.py:85`) fueron cambios pequeños y bien dirigidos que hicieron posible una suite hermética.
5. **Sin N+1.** `joinedload` / `selectinload` aplicados consistentemente en disponibilidad y en el listado admin.
6. **Frontend con tipado íntegro.** 2.166 líneas nuevas, `tsc --noEmit` en verde, tipos de dominio propios (`RentalVehicle`, `CoberturaSeguro`, `ReservaRentaPayload`) en lugar de `any`.
7. **Estrategia híbrida respetada.** No se destruyó el modelo de concesionaria; las entidades de renta conviven. La decisión documentada se cumplió.

---

## 6. PLAN DE CORRECCIÓN PRIORIZADO

### Bloque 1 — Antes de exponer a internet (bloqueante)

1. `H-01` Proteger `GET /reservas/<pnr>`: segundo factor + rate limit + recorte de PII.
2. `H-02` Rate limit en `POST /reservas`.
3. `H-03` Reconciliar venta ↔ renta en ambos sentidos.
4. `H-06` Quitar los valores precargados de fecha de nacimiento y aceptación de términos.

### Bloque 2 — Antes de dar el módulo por cerrado (funcional)

5. `H-04` Aplicar el depósito por categoría (Regla 4).
6. `H-09` Calcular penalidades de combustible y retraso en el check-out (Regla 5).
7. Implementar el recargo Young Driver 21–24 y el vencimiento de licencia (Regla 2, DoD `US-RENT-04`).
8. `H-05` No sustituir el vehículo silenciosamente en el checkout.
9. `H-08` Migración `ALTER TABLE` para bases existentes.

### Bloque 3 — Deuda técnica

10. `H-07` Validación de fechas pasadas y margen de 2 horas (backend y widget; corregir el `< 23` a `< 24`).
11. Filtrar por sucursal de verdad: relación vehículo ↔ sucursal y uso real de los parámetros del contrato.
12. `H-15` Mover los filtros de flota al backend.
13. Hacer hermética `test_endpoints.py` (SQLite in-memory, igual que la suite de renta) para recuperar 19/19 tests verdes.
14. `H-13` Añadir una prueba de doble reserva concurrente sobre MySQL.
15. `H-10` a `H-14`.

---

## 7. RESUMEN DE PUNTUACIÓN

| Dimensión | Puntuación | Nota |
| :--- | :---: | :--- |
| Alcance funcional entregado | **5 / 5** | Las 5 historias son navegables de punta a punta |
| Cumplimiento del Definition of Done | **14 / 18** | 78% — brechas concentradas en `US-RENT-04` y `05` |
| Reglas de negocio RD | **4.5 / 7** | 3 completas, 3 parciales, 1 no aplicada |
| Calidad de arquitectura y código | **4 / 5** | Patrones correctos; deuda en dinero-como-float y caché |
| Cobertura de pruebas | **2.5 / 5** | 8 tests nuevos sólidos; suite global no hermética; sin prueba de concurrencia |
| Seguridad y privacidad | **1.5 / 5** | PII expuesta sin autenticación ni rate limit |

**Calificación global: 3.4 / 5 — Sólido como entrega de sprint, no listo para operar.**

El trabajo de ingeniería es competente y el diseño de datos es correcto. Lo que falta no son refactorizaciones: son **reglas de negocio con impacto en ingresos** (depósito por categoría, penalidades de combustible, recargo por conductor joven) y **una brecha de privacidad** que expone cédulas y licencias de conducir a internet abierto. Ambas cosas son cerrables en un sprint corto sobre la base que ya existe.
