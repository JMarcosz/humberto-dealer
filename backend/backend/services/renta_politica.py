"""Política de negocio de Renta de Autos (mercado República Dominicana).

INVARIANTE DE DISEÑO: este módulo NO importa `db` ni `flask`.
Solo contiene constantes, coerción de entrada y funciones puras, de modo que
toda la lógica de negocio sea verificable con pytest sin `app_context` ni base
de datos. Todo lo que necesite consultar el calendario vive en
`renta_calendario.py`.

Es la ÚNICA fuente de verdad de la política: el frontend no reimplementa
ninguna de estas reglas, las consume vía `GET /api/renta/politica` y
`POST /api/renta/cotizar`.
"""
import hmac
import math
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from ..errors import ReglaNegocioError
from ..validators import validar_email

# ===========================================================================
# CONSTANTES DE POLITICA
# ===========================================================================

# -- Regla 1: duración mínima y fracción horaria ---------------------------
DURACION_MINIMA_HORAS     = 24
DURACION_MAXIMA_DIAS      = 90
LEAD_TIME_MINIMO_MINUTOS  = 120      # recogida >= ahora + 2 h
HORIZONTE_MAXIMO_DIAS     = 365
GRACIA_FACTURACION_SEG    = 3540     # 59 min antes de facturar un día extra

# -- Regla 2: edad mínima y tasa de conductor joven ------------------------
EDAD_MINIMA               = 21
EDAD_MAXIMA               = 85
YOUNG_DRIVER_EDAD_MAX     = 24       # 21-24 inclusive pagan recargo
YOUNG_DRIVER_CARGO_DIA    = Decimal("15.00")

# -- Regla 4: depósito de garantía -----------------------------------------
DEPOSITO_MINIMO           = Decimal("200.00")

# -- Regla 5: combustible lleno-a-lleno ------------------------------------
OCTAVOS_TANQUE               = 8
CARGO_COMBUSTIBLE_POR_OCTAVO = Decimal("18.00")
NIVELES_COMBUSTIBLE          = tuple(f"{i}/8" for i in range(OCTAVOS_TANQUE + 1))

# -- Penalidades por retraso ----------------------------------------------
RETRASO_GRACIA_MINUTOS    = 59
CARGO_RETRASO_POR_HORA    = Decimal("12.00")

# -- Límites anti-abuso ----------------------------------------------------
EXTRAS_CANTIDAD_MAXIMA    = 4        # por extra
EXTRAS_DISTINTOS_MAXIMO   = 10
RESERVAS_ACTIVAS_MAXIMAS  = 3        # por documento/email

# -- Operación de mostrador ------------------------------------------------
VENTANA_CHECKIN_ANTES_HORAS   = 24
VENTANA_CHECKIN_DESPUES_HORAS = 48
NO_SHOW_GRACIA_HORAS          = 48

# -- Contrato --------------------------------------------------------------
TERMINOS_VERSION          = "2026-01-v1"

# -- Máquina de estados de la reserva --------------------------------------
ESTADOS_BLOQUEAN_CALENDARIO = ("CONFIRMADA", "EN_CURSO")

TRANSICIONES = {
    "CONFIRMADA": {"EN_CURSO", "CANCELADA", "NO_SHOW", "EXPIRADA"},
    "EN_CURSO":   {"COMPLETADA"},
    "COMPLETADA": set(),
    "CANCELADA":  set(),
    "NO_SHOW":    set(),
    "EXPIRADA":   set(),
}

_CENTAVO = Decimal("0.01")


def _money(valor) -> Decimal:
    """Redondea a 2 decimales con redondeo comercial (nunca binario)."""
    if not isinstance(valor, Decimal):
        valor = Decimal(str(valor))
    return valor.quantize(_CENTAVO, rounding=ROUND_HALF_UP)


def politica_publica() -> dict:
    """Constantes que el frontend necesita para constreñir sus inputs.

    Se publican para que la UI NO tenga que codificar ningún umbral: si aquí
    cambia un valor, el widget se adapta sin tocar TypeScript.
    """
    return {
        "duracion_minima_horas":    DURACION_MINIMA_HORAS,
        "duracion_maxima_dias":     DURACION_MAXIMA_DIAS,
        "lead_time_minimo_minutos": LEAD_TIME_MINIMO_MINUTOS,
        "horizonte_maximo_dias":    HORIZONTE_MAXIMO_DIAS,
        "edad_minima":              EDAD_MINIMA,
        "edad_maxima":              EDAD_MAXIMA,
        "young_driver_edad_max":    YOUNG_DRIVER_EDAD_MAX,
        "young_driver_cargo_dia":   float(YOUNG_DRIVER_CARGO_DIA),
        "extras_cantidad_maxima":   EXTRAS_CANTIDAD_MAXIMA,
        "extras_distintos_maximo":  EXTRAS_DISTINTOS_MAXIMO,
        "reservas_activas_maximas": RESERVAS_ACTIVAS_MAXIMAS,
        "deposito_minimo":          float(DEPOSITO_MINIMO),
        "niveles_combustible":      list(NIVELES_COMBUSTIBLE),
        "terminos_version":         TERMINOS_VERSION,
    }


# ===========================================================================
# COERCION DE ENTRADA - toda entrada malformada produce 400, jamás un 500
# ===========================================================================

def parse_int(valor, campo: str, *, minimo: int | None = None,
              maximo: int | None = None, requerido: bool = True,
              defecto: int | None = None) -> int | None:
    if valor is None or valor == "":
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return defecto

    # bool es subclase de int en Python: True nunca es un id ni una cantidad.
    if isinstance(valor, bool):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser un número entero.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    try:
        if isinstance(valor, float):
            if not valor.is_integer():
                raise ValueError
            entero = int(valor)
        else:
            entero = int(str(valor).strip())
    except (TypeError, ValueError, OverflowError):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser un número entero.", 400,
                                "TIPO_INVALIDO", {"campo": campo})

    if minimo is not None and entero < minimo:
        raise ReglaNegocioError(f"El campo '{campo}' no puede ser menor que {minimo}.", 400,
                                "FUERA_DE_RANGO", {"campo": campo, "minimo": minimo})
    if maximo is not None and entero > maximo:
        raise ReglaNegocioError(f"El campo '{campo}' no puede ser mayor que {maximo}.", 400,
                                "FUERA_DE_RANGO", {"campo": campo, "maximo": maximo})
    return entero


def parse_decimal(valor, campo: str, *, minimo: Decimal | None = None,
                  maximo: Decimal | None = None, requerido: bool = True,
                  defecto: Decimal | None = None) -> Decimal | None:
    if valor is None or valor == "":
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return defecto
    if isinstance(valor, bool):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser un monto numérico.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    try:
        # str() intermedio: evita arrastrar el error binario del float a Numeric(10,2).
        numero = Decimal(str(valor).strip())
    except (TypeError, ValueError, InvalidOperation):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser un monto numérico.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    if not numero.is_finite():
        raise ReglaNegocioError(f"El campo '{campo}' debe ser un monto numérico finito.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    if minimo is not None and numero < minimo:
        raise ReglaNegocioError(f"El campo '{campo}' no puede ser menor que {minimo}.", 400,
                                "FUERA_DE_RANGO", {"campo": campo, "minimo": float(minimo)})
    if maximo is not None and numero > maximo:
        raise ReglaNegocioError(f"El campo '{campo}' no puede ser mayor que {maximo}.", 400,
                                "FUERA_DE_RANGO", {"campo": campo, "maximo": float(maximo)})
    return _money(numero)


def parse_datetime_iso(valor, campo: str) -> datetime:
    """ISO 8601 -> datetime naive. El guard de tipo evita el AttributeError
    que hoy produce un 500 cuando llega un número en lugar de una cadena."""
    if not isinstance(valor, str) or not valor.strip():
        raise ReglaNegocioError(
            f"El campo '{campo}' debe ser una fecha ISO 8601 (YYYY-MM-DDTHH:MM).", 400,
            "FECHA_INVALIDA", {"campo": campo})
    try:
        limpio = valor.strip().replace("Z", "+00:00")
        return datetime.fromisoformat(limpio).replace(tzinfo=None)
    except ValueError:
        raise ReglaNegocioError(
            f"El campo '{campo}' debe ser una fecha ISO 8601 (YYYY-MM-DDTHH:MM).", 400,
            "FECHA_INVALIDA", {"campo": campo})


def parse_date_iso(valor, campo: str) -> date:
    if not isinstance(valor, str) or not valor.strip():
        raise ReglaNegocioError(f"El campo '{campo}' debe tener formato YYYY-MM-DD.", 400,
                                "FECHA_INVALIDA", {"campo": campo})
    try:
        return date.fromisoformat(valor.strip())
    except ValueError:
        raise ReglaNegocioError(f"El campo '{campo}' debe tener formato YYYY-MM-DD.", 400,
                                "FECHA_INVALIDA", {"campo": campo})


def parse_bool(valor, campo: str, *, requerido: bool = False,
               defecto: bool = False) -> bool:
    if valor is None:
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return defecto
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, str):
        bajo = valor.strip().lower()
        if bajo in ("true", "1", "si", "on"):
            return True
        if bajo in ("false", "0", "no", "off", ""):
            return False
    if isinstance(valor, int):
        return bool(valor)
    raise ReglaNegocioError(f"El campo '{campo}' debe ser verdadero o falso.", 400,
                            "TIPO_INVALIDO", {"campo": campo})


def parse_str(valor, campo: str, *, max_largo: int, min_largo: int = 1,
              requerido: bool = True, mayusculas: bool = False) -> str | None:
    if valor is None:
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return None
    if not isinstance(valor, str):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser texto.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    texto = valor.strip()
    if not texto:
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return None
    if len(texto) < min_largo:
        raise ReglaNegocioError(
            f"El campo '{campo}' debe tener al menos {min_largo} caracteres.", 400,
            "LARGO_INVALIDO", {"campo": campo, "min": min_largo})
    if len(texto) > max_largo:
        raise ReglaNegocioError(
            f"El campo '{campo}' no puede exceder {max_largo} caracteres.", 400,
            "LARGO_INVALIDO", {"campo": campo, "max": max_largo})
    return texto.upper() if mayusculas else texto


def parse_enum(valor, campo: str, permitidos, *, requerido: bool = True,
               defecto: str | None = None) -> str | None:
    if valor is None or valor == "":
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return defecto
    if not isinstance(valor, str):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser texto.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    normalizado = valor.strip().upper()
    if normalizado not in permitidos:
        raise ReglaNegocioError(
            f"El valor de '{campo}' no es válido. Opciones: {', '.join(sorted(permitidos))}.",
            400, "VALOR_NO_PERMITIDO", {"campo": campo, "permitidos": sorted(permitidos)})
    return normalizado


def parse_lista(valor, campo: str, *, max_items: int,
                requerido: bool = False) -> list:
    """Rechaza str y dict explícitamente: iterar una cadena produciría
    caracteres sueltos y un 500 aguas abajo."""
    if valor is None:
        if requerido:
            raise ReglaNegocioError(f"El campo '{campo}' es obligatorio.", 400,
                                    "CAMPO_REQUERIDO", {"campo": campo})
        return []
    if isinstance(valor, (str, bytes, dict)):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser una lista.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    if not isinstance(valor, (list, tuple)):
        raise ReglaNegocioError(f"El campo '{campo}' debe ser una lista.", 400,
                                "TIPO_INVALIDO", {"campo": campo})
    if len(valor) > max_items:
        raise ReglaNegocioError(
            f"El campo '{campo}' admite como máximo {max_items} elementos.", 400,
            "DEMASIADOS_ELEMENTOS", {"campo": campo, "max": max_items})
    return list(valor)


# ===========================================================================
# CALCULO - funciones puras
# ===========================================================================

def calcular_dias_facturables(f_inicio: datetime, f_fin: datetime) -> int:
    """Regla 1: día = 24 h, con período de gracia de 59 minutos.

    24 h 00 m -> 1 día | 24 h 59 m -> 1 día | 25 h 00 m -> 2 días.
    """
    segundos = (f_fin - f_inicio).total_seconds()
    if segundos <= 0:
        return 1
    return max(1, math.ceil((segundos - GRACIA_FACTURACION_SEG) / 86400.0))


def calcular_edad(fecha_nac: date, referencia: date | None = None) -> int:
    ref = referencia or date.today()
    return ref.year - fecha_nac.year - (
        (ref.month, ref.day) < (fecha_nac.month, fecha_nac.day)
    )


def validar_ventana_busqueda(f_inicio: datetime, f_fin: datetime, *,
                             ahora: datetime | None = None) -> int:
    """Ventana para CONSULTAR disponibilidad. Más laxa que la de reserva:
    mirar precios para dentro de 30 minutos es legítimo."""
    if f_fin <= f_inicio:
        raise ReglaNegocioError(
            "La fecha de devolución debe ser posterior a la fecha de recogida.",
            422, "RANGO_INVERTIDO")

    ahora = ahora or datetime.utcnow()
    if f_inicio > ahora + timedelta(days=HORIZONTE_MAXIMO_DIAS):
        raise ReglaNegocioError(
            f"Solo aceptamos reservas con hasta {HORIZONTE_MAXIMO_DIAS} días de anticipación.",
            422, "HORIZONTE_EXCEDIDO")

    dias = calcular_dias_facturables(f_inicio, f_fin)
    if dias > DURACION_MAXIMA_DIAS:
        raise ReglaNegocioError(
            f"El alquiler no puede exceder {DURACION_MAXIMA_DIAS} días. Solicitaste {dias}.",
            422, "DURACION_EXCEDIDA", {"dias": dias, "maximo": DURACION_MAXIMA_DIAS})
    return dias


def validar_ventana_reserva(f_inicio: datetime, f_fin: datetime, *,
                            ahora: datetime | None = None) -> int:
    """Ventana para CREAR una reserva: exige lead time y duración mínima."""
    ahora = ahora or datetime.utcnow()
    dias = validar_ventana_busqueda(f_inicio, f_fin, ahora=ahora)

    if f_inicio < ahora:
        raise ReglaNegocioError(
            "La fecha de recogida no puede estar en el pasado.",
            422, "FECHA_PASADA")

    minimo_recogida = ahora + timedelta(minutes=LEAD_TIME_MINIMO_MINUTOS)
    if f_inicio < minimo_recogida:
        horas = LEAD_TIME_MINIMO_MINUTOS // 60
        raise ReglaNegocioError(
            f"La recogida debe programarse con al menos {horas} horas de anticipación.",
            422, "LEAD_TIME_INSUFICIENTE",
            {"minimo_minutos": LEAD_TIME_MINIMO_MINUTOS})

    horas_totales = (f_fin - f_inicio).total_seconds() / 3600.0
    if horas_totales < DURACION_MINIMA_HORAS:
        raise ReglaNegocioError(
            f"El período mínimo de alquiler es de {DURACION_MINIMA_HORAS} horas.",
            422, "DURACION_INSUFICIENTE",
            {"minimo_horas": DURACION_MINIMA_HORAS})
    return dias


def validar_edad_conductor(fecha_nac: date, f_inicio: datetime) -> tuple[int, bool]:
    """Regla 2. La edad relevante es la del día de la RECOGIDA, no la de hoy:
    quien cumple 21 antes de retirar el auto es elegible.

    Devuelve (edad, es_young_driver).
    """
    edad = calcular_edad(fecha_nac, f_inicio.date())
    if edad < EDAD_MINIMA:
        raise ReglaNegocioError(
            f"El conductor principal debe tener al menos {EDAD_MINIMA} años cumplidos "
            f"a la fecha de recogida para rentar un auto. Edad calculada: {edad} años.",
            422, "EDAD_INSUFICIENTE", {"edad": edad, "minima": EDAD_MINIMA})
    if edad > EDAD_MAXIMA:
        raise ReglaNegocioError(
            f"La edad máxima para conducir nuestra flota es de {EDAD_MAXIMA} años.",
            422, "EDAD_EXCEDIDA", {"edad": edad, "maxima": EDAD_MAXIMA})
    return edad, edad <= YOUNG_DRIVER_EDAD_MAX


def validar_conductor(bloque) -> dict:
    """Normaliza y valida el bloque `conductor` del checkout.

    `nombre` y `apellido` se persisten en MAYUSCULAS conforme a la regla
    transversal del proyecto (validators.CAMPOS_MAYUSCULAS).
    """
    if not isinstance(bloque, dict):
        raise ReglaNegocioError(
            "Los datos del conductor son obligatorios.", 400,
            "CAMPO_REQUERIDO", {"campo": "conductor"})

    datos = {
        "nombre":    parse_str(bloque.get("nombre"),    "conductor.nombre",
                               max_largo=150, mayusculas=True),
        "apellido":  parse_str(bloque.get("apellido"),  "conductor.apellido",
                               max_largo=150, mayusculas=True),
        "email":     parse_str(bloque.get("email"),     "conductor.email", max_largo=254),
        "telefono":  parse_str(bloque.get("telefono"),  "conductor.telefono",
                               max_largo=30, min_largo=7),
        "documento": parse_str(bloque.get("documento"), "conductor.documento",
                               max_largo=50, min_largo=5),
        "licencia":  parse_str(bloque.get("licencia"),  "conductor.licencia",
                               max_largo=50, min_largo=4),
    }
    if not validar_email(datos["email"]):
        raise ReglaNegocioError(
            "El correo electrónico del conductor no tiene un formato válido.", 400,
            "EMAIL_INVALIDO", {"campo": "conductor.email"})

    datos["fecha_nacimiento"] = parse_date_iso(
        bloque.get("fecha_nacimiento"), "conductor.fecha_nacimiento")
    return datos


def normalizar_extras(extras_in) -> list[tuple[int, int]]:
    """Acepta [1, 2] o [{"id": 1, "cantidad": 2}] y devuelve pares (id, cantidad)
    AGREGADOS por id, para que repetir el mismo extra no inserte filas duplicadas.
    """
    crudos = parse_lista(extras_in, "extras_ids", max_items=EXTRAS_DISTINTOS_MAXIMO * 4)

    acumulado: dict[int, int] = {}
    for item in crudos:
        if isinstance(item, dict):
            eid  = parse_int(item.get("id"), "extras_ids[].id", minimo=1)
            cant = parse_int(item.get("cantidad"), "extras_ids[].cantidad",
                             minimo=1, maximo=EXTRAS_CANTIDAD_MAXIMA,
                             requerido=False, defecto=1)
        else:
            eid, cant = parse_int(item, "extras_ids[]", minimo=1), 1
        acumulado[eid] = acumulado.get(eid, 0) + cant

    if len(acumulado) > EXTRAS_DISTINTOS_MAXIMO:
        raise ReglaNegocioError(
            f"Puedes agregar como máximo {EXTRAS_DISTINTOS_MAXIMO} servicios "
            f"adicionales distintos.",
            422, "DEMASIADOS_EXTRAS", {"maximo": EXTRAS_DISTINTOS_MAXIMO})

    for eid, cant in acumulado.items():
        if cant > EXTRAS_CANTIDAD_MAXIMA:
            raise ReglaNegocioError(
                f"La cantidad máxima por servicio adicional es {EXTRAS_CANTIDAD_MAXIMA}.",
                422, "CANTIDAD_EXCEDIDA",
                {"extra_id": eid, "maximo": EXTRAS_CANTIDAD_MAXIMA})
    return sorted(acumulado.items())


def parse_nivel_combustible(valor, campo: str = "combustible") -> int:
    """'5/8' -> 5. Rechaza cualquier nivel fuera de la escala de octavos."""
    nivel = parse_enum(valor, campo, set(NIVELES_COMBUSTIBLE))
    return int(nivel.split("/")[0])


def validar_transicion(actual: str, nuevo: str) -> None:
    permitidas = TRANSICIONES.get(actual)
    if permitidas is None:
        raise ReglaNegocioError(
            f"Estado de reserva desconocido: {actual}.", 409, "ESTADO_DESCONOCIDO")
    if nuevo not in permitidas:
        raise ReglaNegocioError(
            f"No se puede pasar de {actual} a {nuevo}.", 422,
            "TRANSICION_INVALIDA", {"actual": actual, "solicitado": nuevo})


def calcular_deposito(deposito_base, reduccion_pct) -> Decimal:
    """Regla 4: el riesgo escala con el vehículo; la cobertura lo mitiga.

    El depósito base vive en TarifaRenta (por vehículo/categoría) y la
    cobertura aplica un porcentaje de reducción. `DEPOSITO_MINIMO` es el piso:
    ni con 100 % de reducción la fianza baja a cero, porque sigue habiendo
    riesgo operativo (combustible, peajes, multas).
    """
    base      = _money(deposito_base)
    reduccion = _money(reduccion_pct)
    if reduccion < 0:
        reduccion = Decimal("0.00")
    if reduccion > 100:
        reduccion = Decimal("100.00")
    calculado = _money(base * (Decimal("100.00") - reduccion) / Decimal("100.00"))
    return max(DEPOSITO_MINIMO, calculado)


def calcular_recargo_young_driver(es_young: bool, dias: int) -> Decimal:
    return _money(YOUNG_DRIVER_CARGO_DIA * dias) if es_young else Decimal("0.00")


def calcular_totales(*, tarifa_dia, dias: int, costo_cobertura_dia,
                     extras_resueltos: list, recargo_young=Decimal("0.00")) -> dict:
    """Liquidación completa del alquiler.

    `extras_resueltos` son dicts con costo_dia / es_pago_unico / cantidad, tal
    como los devuelve `renta_calendario.resolver_extras`. Esta función es la
    UNICA que calcula dinero: la usan por igual `/cotizar` y `/reservas`, de
    modo que la cifra mostrada y la cobrada no pueden divergir.
    """
    tarifa    = _money(tarifa_dia)
    cobertura = _money(costo_cobertura_dia)

    subtotal_vehiculo  = _money(tarifa * dias)
    subtotal_cobertura = _money(cobertura * dias)

    detalle_extras, subtotal_extras = [], Decimal("0.00")
    for ex in extras_resueltos:
        costo    = _money(ex["costo_dia"])
        cantidad = int(ex.get("cantidad", 1))
        sub = _money(costo * cantidad) if ex.get("es_pago_unico") \
            else _money(costo * dias * cantidad)
        subtotal_extras += sub
        detalle_extras.append({**ex, "costo_dia": costo, "cantidad": cantidad,
                               "subtotal": sub})

    recargo = _money(recargo_young)
    total   = _money(subtotal_vehiculo + subtotal_cobertura +
                     subtotal_extras + recargo)
    return {
        "tarifa_diaria":        tarifa,
        "dias":                 dias,
        "subtotal_vehiculo":    subtotal_vehiculo,
        "subtotal_cobertura":   subtotal_cobertura,
        "subtotal_extras":      _money(subtotal_extras),
        "recargo_young_driver": recargo,
        "total_alquiler":       total,
        "extras":               detalle_extras,
    }


def calcular_penalidades(*, fecha_fin_prevista: datetime, devuelto_en: datetime,
                         octavos_entrega: int, octavos_devolucion: int,
                         tarifa_dia) -> dict:
    """Reglas 1 y 5 al cierre: retraso y combustible faltante.

    El cargo por retraso se topa en una tarifa diaria por cada bloque de 24 h,
    estándar de la industria: la demora nunca cuesta más que alquilar ese día.
    """
    tarifa = _money(tarifa_dia)

    segundos_retraso = (devuelto_en - fecha_fin_prevista).total_seconds() \
        - RETRASO_GRACIA_MINUTOS * 60
    if segundos_retraso <= 0:
        horas_retraso, cargo_retraso = Decimal("0.00"), Decimal("0.00")
    else:
        horas_retraso   = _money(segundos_retraso / 3600.0)
        horas_cobrables = math.ceil(segundos_retraso / 3600.0)
        bruto = _money(CARGO_RETRASO_POR_HORA * horas_cobrables)
        techo = _money(tarifa * math.ceil(horas_cobrables / 24.0))
        cargo_retraso = min(bruto, techo)

    octavos_faltantes = max(0, int(octavos_entrega) - int(octavos_devolucion))
    cargo_combustible = _money(CARGO_COMBUSTIBLE_POR_OCTAVO * octavos_faltantes)

    return {
        "horas_retraso":     horas_retraso,
        "cargo_retraso":     cargo_retraso,
        "octavos_faltantes": octavos_faltantes,
        "cargo_combustible": cargo_combustible,
        "total_penalidades": _money(cargo_retraso + cargo_combustible),
    }


# ===========================================================================
# PRIVACIDAD - enmascarado y segundo factor del voucher
# ===========================================================================

def enmascarar_documento(valor):
    if not valor:
        return valor
    limpio = valor.strip()
    return "*" * len(limpio) if len(limpio) <= 4 else "*" * (len(limpio) - 4) + limpio[-4:]


def enmascarar_licencia(valor):
    if not valor:
        return valor
    limpio = valor.strip()
    return "*" * len(limpio) if len(limpio) <= 3 else "*" * (len(limpio) - 3) + limpio[-3:]


def _normalizar_comparacion(texto: str) -> str:
    """Mayúsculas y sin tildes: el turista no debe recordar el acento exacto."""
    sin_tildes = unicodedata.normalize("NFKD", texto.strip())
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    return " ".join(sin_tildes.upper().split())


def verificar_segundo_factor(reserva, *, apellido: str | None = None,
                             doc4: str | None = None) -> bool:
    """Segundo factor del voucher público: apellido o últimos 4 del documento.

    Usa comparación en tiempo constante para no filtrar el valor correcto.
    """
    if apellido:
        esperado = _normalizar_comparacion(reserva.conductor_apellido or "")
        recibido = _normalizar_comparacion(apellido)
        if esperado and hmac.compare_digest(esperado, recibido):
            return True
    if doc4:
        documento = (reserva.conductor_documento or "").strip()
        recibido  = doc4.strip()
        if len(documento) >= 4 and len(recibido) >= 4 and hmac.compare_digest(
                documento[-4:], recibido[-4:]):
            return True
    return False
