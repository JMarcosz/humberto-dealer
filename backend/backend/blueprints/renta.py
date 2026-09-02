"""Blueprint de Renta de Autos: politica, disponibilidad, cotizacion, checkout y voucher.

Ningun endpoint de este modulo contiene un `try`: la traduccion de errores la
hace `@maneja_errores_renta` y toda la politica vive en `services/renta_politica.py`.
El cliente no puede pedir nada que la politica no autorice.
"""
import logging
import random
import string
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy.orm import joinedload, selectinload

from ..decorators import maneja_errores_renta
from ..errors import ReglaNegocioError
from ..models import (
    db, Vehiculo, Modelo, Marca, Cliente,
    TarifaRenta, CoberturaSeguro, ExtraServicio,
    ReservaRenta, ReservaRentaExtra,
)
from ..services import renta_calendario as cal
from ..services import renta_politica as pol
from backend import cache, limiter

bp = Blueprint("renta", __name__)
log = logging.getLogger(__name__)

# El barrido de no-shows es perezoso: se ejecuta al consultar disponibilidad,
# que es justo donde una reserva fantasma hace dano. Este guard evita repetirlo
# en cada request.
_ULTIMA_EXPIRACION = {"ts": None}
_INTERVALO_EXPIRACION_SEG = 300


def _barrer_no_shows_si_toca():
    ahora = datetime.utcnow()
    previo = _ULTIMA_EXPIRACION["ts"]
    if previo and (ahora - previo).total_seconds() < _INTERVALO_EXPIRACION_SEG:
        return
    _ULTIMA_EXPIRACION["ts"] = ahora
    cal.expirar_reservas_vencidas(ahora=ahora)


def generar_pnr_unico() -> str:
    """Codigo PNR unico en formato HA-XXXXX (8 caracteres)."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        pnr = "HA-" + "".join(random.choices(chars, k=5))
        if not ReservaRenta.query.filter_by(pnr=pnr).first():
            return pnr
    return f"HA-{int(datetime.utcnow().timestamp()) % 100000:05d}"


def _clave_limite():
    """Los usuarios autenticados salen del pool compartido por IP, para que un
    NAT de hotel o aeropuerto no penalice a huespedes legitimos entre si."""
    if current_user.is_authenticated:
        return f"u:{current_user.id}"
    return request.access_route[0] if request.access_route else request.remote_addr


# ===========================================================================
# GET /api/renta/politica  -- el backend publica sus propias reglas
# ===========================================================================
@bp.get("/politica")
@cache.cached(timeout=600)
@maneja_errores_renta
def obtener_politica():
    """Constantes de negocio para que el frontend constrina sus inputs.

    Existe para que la UI no tenga que codificar ningun umbral: las reglas
    viven aqui y el cliente las consume.
    """
    return jsonify(pol.politica_publica())


# ===========================================================================
# Catalogos de opciones
# ===========================================================================
@bp.get("/sucursales")
@cache.cached(timeout=600)
@maneja_errores_renta
def listar_sucursales():
    from ..models import Sucursal
    sucursales = Sucursal.query.filter_by(activo=True).order_by(Sucursal.nombre).all()
    return jsonify([s.to_dict() for s in sucursales])


@bp.get("/coberturas")
@cache.cached(timeout=600)
@maneja_errores_renta
def listar_coberturas():
    coberturas = (CoberturaSeguro.query
                  .filter_by(activo=True)
                  .order_by(CoberturaSeguro.costo_dia.asc())
                  .all())
    return jsonify([c.to_dict() for c in coberturas])


@bp.get("/extras")
@cache.cached(timeout=600)
@maneja_errores_renta
def listar_extras():
    extras = (ExtraServicio.query
              .filter_by(activo=True)
              .order_by(ExtraServicio.id.asc())
              .all())
    return jsonify([e.to_dict() for e in extras])


# ===========================================================================
# GET /api/renta/disponibilidad
# ===========================================================================
@bp.get("/disponibilidad")
@limiter.limit("30 per minute; 300 per hour", key_func=_clave_limite)
@maneja_errores_renta
def consultar_disponibilidad():
    f_inicio = pol.parse_datetime_iso(request.args.get("fecha_inicio"), "fecha_inicio")
    f_fin    = pol.parse_datetime_iso(request.args.get("fecha_fin"), "fecha_fin")
    dias     = pol.validar_ventana_busqueda(f_inicio, f_fin)

    # Libera unidades atrapadas por reservas que nunca se retiraron.
    _barrer_no_shows_si_toca()

    ocupados = cal.vehiculos_ocupados_subquery(f_inicio, f_fin)

    q = (
        Vehiculo.query
        .join(TarifaRenta, TarifaRenta.vehiculo_id == Vehiculo.id)
        .join(Modelo, Modelo.id == Vehiculo.modelo_id)
        .join(Marca, Marca.id == Modelo.marca_id)
        .options(
            joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
            joinedload(Vehiculo.tarifa_renta),
            selectinload(Vehiculo.imagenes),
        )
        .filter(
            Vehiculo.estado.in_(cal.ESTADOS_VEHICULO_RENTABLE),
            Vehiculo.disponible_para.in_(["RENTA", "AMBOS"]),
            TarifaRenta.activo.is_(True),
            Vehiculo.id.notin_(ocupados),
        )
    )

    # Filtros opcionales -- validados, no interpolados a ciegas.
    categorias_validas = {"SEDAN", "SUV", "COUPE", "CONVERTIBLE", "PICKUP", "VAN", "OTRO"}
    if request.args.get("categoria"):
        cat = pol.parse_enum(request.args.get("categoria"), "categoria", categorias_validas)
        q = q.filter(Modelo.categoria == cat)
    if request.args.get("transmision"):
        tr = pol.parse_enum(request.args.get("transmision"), "transmision",
                            {"AUTOMATICA", "MANUAL", "CVT"})
        q = q.filter(Vehiculo.transmision == tr)
    if request.args.get("pasajeros"):
        pax = pol.parse_int(request.args.get("pasajeros"), "pasajeros", minimo=1, maximo=20)
        q = q.filter(Vehiculo.pasajeros >= pax)

    vehiculos = q.order_by(TarifaRenta.precio_dia_base.asc()).all()

    items = []
    for v in vehiculos:
        t      = v.tarifa_renta
        modelo = v.modelo
        marca  = modelo.marca if modelo else None
        imgs   = [img.to_dict() for img in v.imagenes]
        totales = pol.calcular_totales(
            tarifa_dia=t.precio_dia_base, dias=dias,
            costo_cobertura_dia=0, extras_resueltos=[],
        )
        items.append({
            "id": v.id,
            "marca": marca.nombre if marca else "",
            "modelo": modelo.nombre if modelo else "",
            "categoria": modelo.categoria if modelo else "OTRO",
            "anio": v.anio,
            "color": v.color,
            "combustible": v.combustible,
            "transmision": v.transmision,
            "pasajeros": v.pasajeros,
            "maletas_grandes": v.maletas_grandes,
            "maletas_pequenas": v.maletas_pequenas,
            "tiene_aire_acondicionado": v.tiene_aire_acondicionado,
            "kilometraje_incluido": t.kilometraje_incluido,
            "politica_combustible": t.politica_combustible,
            "tarifa": {
                "precio_por_dia": float(totales["tarifa_diaria"]),
                "dias": dias,
                "total_estimado": float(totales["total_alquiler"]),
                "deposito_garantia": float(t.deposito_garantia),
                "moneda": t.moneda,
            },
            "imagenes": imgs,
            "imagen_principal": imgs[0]["url"] if imgs else None,
        })

    return jsonify({
        "dias_facturables": dias,
        "fecha_inicio": f_inicio.isoformat(),
        "fecha_fin": f_fin.isoformat(),
        "total_disponibles": len(items),
        "vehiculos": items,
    })


# ===========================================================================
# Nucleo compartido por /cotizar y /reservas
# ===========================================================================
def _liquidar(data, *, bloquear_vehiculo: bool, ahora: datetime | None = None) -> dict:
    """Valida el payload y calcula la liquidacion completa.

    Lo usan por igual la cotizacion y el checkout, con las mismas funciones de
    `renta_politica`: por construccion, la cifra que el usuario ve es la que se
    va a cobrar.
    """
    vid      = pol.parse_int(data.get("vehiculo_id"), "vehiculo_id", minimo=1)
    f_inicio = pol.parse_datetime_iso(data.get("fecha_inicio"), "fecha_inicio")
    f_fin    = pol.parse_datetime_iso(data.get("fecha_fin"), "fecha_fin")
    dias     = pol.validar_ventana_reserva(f_inicio, f_fin, ahora=ahora)

    rec_id = pol.parse_int(data.get("sucursal_recogida_id"), "sucursal_recogida_id", minimo=1)
    dev_id = pol.parse_int(data.get("sucursal_devolucion_id"), "sucursal_devolucion_id",
                           minimo=1, requerido=False, defecto=rec_id)
    cob_id = pol.parse_int(data.get("cobertura_id"), "cobertura_id", minimo=1)

    vehiculo   = cal.cargar_vehiculo_rentable(vid, bloquear=bloquear_vehiculo)
    suc_rec, suc_dev = cal.validar_sucursales(rec_id, dev_id)
    cobertura  = cal.cargar_cobertura(cob_id)
    extras     = cal.resolver_extras(pol.normalizar_extras(data.get("extras_ids")))

    # La edad se evalua a la fecha de recogida, no a la de hoy.
    edad, es_young = None, False
    if data.get("conductor", {}).get("fecha_nacimiento") or data.get("fecha_nacimiento"):
        crudo = (data.get("conductor") or {}).get("fecha_nacimiento") \
            or data.get("fecha_nacimiento")
        f_nac = pol.parse_date_iso(crudo, "conductor.fecha_nacimiento")
        edad, es_young = pol.validar_edad_conductor(f_nac, f_inicio)

    recargo = pol.calcular_recargo_young_driver(es_young, dias)
    totales = pol.calcular_totales(
        tarifa_dia=vehiculo.tarifa_renta.precio_dia_base,
        dias=dias,
        costo_cobertura_dia=cobertura.costo_dia,
        extras_resueltos=extras,
        recargo_young=recargo,
    )
    deposito = pol.calcular_deposito(
        vehiculo.tarifa_renta.deposito_garantia,
        cobertura.reduccion_deposito_pct,
    )

    return {
        "vehiculo": vehiculo, "cobertura": cobertura,
        "sucursal_recogida": suc_rec, "sucursal_devolucion": suc_dev,
        "f_inicio": f_inicio, "f_fin": f_fin, "dias": dias,
        "edad": edad, "es_young": es_young,
        "totales": totales, "deposito": deposito,
    }


def _serializar_cotizacion(liq: dict) -> dict:
    t = liq["totales"]
    return {
        "vehiculo_id":          liq["vehiculo"].id,
        "cobertura_id":         liq["cobertura"].id,
        "dias_facturables":     liq["dias"],
        "tarifa_diaria":        float(t["tarifa_diaria"]),
        "subtotal_vehiculo":    float(t["subtotal_vehiculo"]),
        "subtotal_cobertura":   float(t["subtotal_cobertura"]),
        "subtotal_extras":      float(t["subtotal_extras"]),
        "recargo_young_driver": float(t["recargo_young_driver"]),
        "total_alquiler":       float(t["total_alquiler"]),
        "deposito_garantia":    float(liq["deposito"]),
        "moneda":               liq["vehiculo"].tarifa_renta.moneda,
        "edad_conductor":       liq["edad"],
        "es_young_driver":      liq["es_young"],
        "extras": [
            {"extra_id": e["extra_id"], "nombre": e["nombre"],
             "cantidad": e["cantidad"], "precio_unitario": float(e["costo_dia"]),
             "subtotal": float(e["subtotal"])}
            for e in t["extras"]
        ],
    }


# ===========================================================================
# POST /api/renta/cotizar  -- desglose sin persistir
# ===========================================================================
@bp.post("/cotizar")
@limiter.limit("30 per minute", key_func=_clave_limite)
@maneja_errores_renta
def cotizar_renta():
    data = request.get_json(silent=True) or {}
    liq  = _liquidar(data, bloquear_vehiculo=False)

    # Depositos de todas las coberturas activas para ESTE vehiculo, para que la
    # UI muestre el impacto real de cambiar de cobertura sin calcular nada.
    base = liq["vehiculo"].tarifa_renta.deposito_garantia
    opciones = [
        {"cobertura_id": c.id, "codigo": c.codigo, "nombre": c.nombre,
         "costo_dia": float(c.costo_dia),
         "deposito_garantia": float(pol.calcular_deposito(base, c.reduccion_deposito_pct)),
         "subtotal": float(pol.calcular_totales(
             tarifa_dia=0, dias=liq["dias"], costo_cobertura_dia=c.costo_dia,
             extras_resueltos=[])["subtotal_cobertura"])}
        for c in CoberturaSeguro.query.filter_by(activo=True)
                                      .order_by(CoberturaSeguro.costo_dia.asc()).all()
    ]

    cotizacion = _serializar_cotizacion(liq)
    cotizacion["coberturas_disponibles"] = opciones
    return jsonify(cotizacion)


# ===========================================================================
# POST /api/renta/reservas  -- checkout anonimo, blindado
# ===========================================================================
@bp.post("/reservas")
@limiter.limit("5 per hour; 20 per day", key_func=_clave_limite)
@maneja_errores_renta
def crear_reserva_renta():
    data = request.get_json(silent=True) or {}

    # Prueba de aceptacion del contrato: sin esto no hay reserva.
    if not pol.parse_bool(data.get("acepta_terminos"), "acepta_terminos"):
        raise ReglaNegocioError(
            "Debes aceptar las condiciones del alquiler y la politica de deposito "
            "en garantia para confirmar la reserva.",
            422, "TERMINOS_NO_ACEPTADOS")

    conductor = pol.validar_conductor(data.get("conductor"))

    ahora = datetime.utcnow()
    liq   = _liquidar(data, bloquear_vehiculo=True, ahora=ahora)
    vehiculo = liq["vehiculo"]

    # El control anti-abuso que de verdad importa: es inmune al NAT compartido.
    activas = cal.contar_reservas_activas(
        conductor["documento"], conductor["email"], ahora=ahora)
    if activas >= pol.RESERVAS_ACTIVAS_MAXIMAS:
        raise ReglaNegocioError(
            f"Ya tienes {activas} reservas activas. El maximo permitido por conductor "
            f"es {pol.RESERVAS_ACTIVAS_MAXIMAS}. Cancela una para continuar.",
            409, "DEMASIADAS_RESERVAS_ACTIVAS")

    # Re-chequeo de colision DENTRO de la transaccion que ya sostiene el
    # bloqueo pesimista sobre la fila del vehiculo.
    colision = cal.buscar_colision(vehiculo.id, liq["f_inicio"], liq["f_fin"])
    if colision:
        raise ReglaNegocioError(
            "El vehiculo seleccionado ya no esta disponible para las fechas indicadas.",
            409, "VEHICULO_OCUPADO")

    cliente_id = None
    if current_user.is_authenticated:
        cli = Cliente.query.filter_by(usuario_id=current_user.id).first()
        if not cli:
            cli = Cliente(
                usuario_id=current_user.id,
                nombre=conductor["nombre"], apellido=conductor["apellido"],
                email=conductor["email"], telefono=conductor["telefono"],
                cedula=conductor["documento"],
            )
            db.session.add(cli)
            db.session.flush()
        cliente_id = cli.id

    t = liq["totales"]
    reserva = ReservaRenta(
        pnr                     = generar_pnr_unico(),
        vehiculo_id             = vehiculo.id,
        cliente_id              = cliente_id,
        sucursal_recogida_id    = liq["sucursal_recogida"].id,
        sucursal_devolucion_id  = liq["sucursal_devolucion"].id,
        fecha_inicio            = liq["f_inicio"],
        fecha_fin               = liq["f_fin"],
        total_dias              = liq["dias"],
        cobertura_id            = liq["cobertura"].id,
        tarifa_diaria_aplicada  = t["tarifa_diaria"],
        subtotal_vehiculo       = t["subtotal_vehiculo"],
        subtotal_cobertura      = t["subtotal_cobertura"],
        subtotal_extras         = t["subtotal_extras"],
        recargo_young_driver    = t["recargo_young_driver"],
        total_alquiler          = t["total_alquiler"],
        deposito_garantia_monto = liq["deposito"],
        moneda                  = vehiculo.tarifa_renta.moneda,
        estado                  = "CONFIRMADA",
        conductor_nombre        = conductor["nombre"],
        conductor_apellido      = conductor["apellido"],
        conductor_email         = conductor["email"],
        conductor_telefono      = conductor["telefono"],
        conductor_documento     = conductor["documento"],
        conductor_licencia      = conductor["licencia"],
        conductor_fecha_nac     = conductor["fecha_nacimiento"],
        edad_conductor          = liq["edad"],
        notas_vuelo             = pol.parse_str(data.get("notas_vuelo"), "notas_vuelo",
                                                max_largo=100, requerido=False),
        terminos_aceptados      = True,
        terminos_aceptados_en   = ahora,
        terminos_version        = pol.TERMINOS_VERSION,
        terminos_ip             = (request.access_route[0] if request.access_route
                                   else request.remote_addr),
    )
    db.session.add(reserva)
    db.session.flush()

    for ex in t["extras"]:
        db.session.add(ReservaRentaExtra(
            reserva_id      = reserva.id,
            extra_id        = ex["extra_id"],
            cantidad        = ex["cantidad"],
            precio_unitario = ex["costo_dia"],
            subtotal        = ex["subtotal"],
        ))

    db.session.commit()
    log.info("Reserva de renta creada: PNR=%s vehiculo=%d total=%s %s",
             reserva.pnr, vehiculo.id, t["total_alquiler"], reserva.moneda)

    return jsonify({
        "mensaje": "Reserva confirmada con exito",
        "pnr": reserva.pnr,
        "reserva": reserva.to_dict(include_detalle=True),
    }), 201


# ===========================================================================
# GET /api/renta/reservas/<pnr>  -- voucher con segundo factor
# ===========================================================================
def _fallo_voucher(resp):
    """Solo los intentos fallidos consumen cuota: un turista que teclea bien su
    apellido nunca vera un 429, aunque recargue el voucher cincuenta veces."""
    return resp.status_code in (403, 404)


@bp.get("/reservas/<pnr>")
@limiter.limit("60 per hour", key_func=_clave_limite)
@limiter.limit("5 per minute", key_func=_clave_limite, deduct_when=_fallo_voucher)
@maneja_errores_renta
def consultar_voucher(pnr: str):
    codigo   = pol.parse_str(pnr, "pnr", max_largo=12, min_largo=4)
    apellido = pol.parse_str(request.args.get("apellido"), "apellido",
                             max_largo=150, requerido=False)
    doc4     = pol.parse_str(request.args.get("doc4"), "doc4",
                             max_largo=10, requerido=False)

    if not apellido and not doc4:
        raise ReglaNegocioError(
            "Para ver esta reserva indica el apellido del conductor o los ultimos "
            "4 digitos de su documento.",
            403, "FACTOR_REQUERIDO")

    # Un PNR inexistente y un factor incorrecto devuelven exactamente la misma
    # respuesta, para no confirmar que el codigo existe.
    generico = ReglaNegocioError(
        "No encontramos una reserva que coincida con los datos proporcionados.",
        403, "VOUCHER_NO_ACCESIBLE")

    reserva = ReservaRenta.query.filter_by(pnr=codigo.upper()).first()
    if not reserva:
        raise generico
    if not pol.verificar_segundo_factor(reserva, apellido=apellido, doc4=doc4):
        log.warning("Segundo factor incorrecto para voucher %s", codigo.upper())
        raise generico

    es_staff = current_user.is_authenticated and current_user.is_admin
    return jsonify(reserva.to_dict(include_detalle=True, publico=not es_staff))


# ===========================================================================
# POST /api/renta/reservas/<pnr>/cancelar
# ===========================================================================
@bp.post("/reservas/<pnr>/cancelar")
@limiter.limit("5 per hour", key_func=_clave_limite)
@maneja_errores_renta
def cancelar_reserva_renta(pnr: str):
    """Cancelacion por el propio cliente, protegida con el mismo segundo factor.

    Sin este endpoint el estado CANCELADA no tenia ningun productor y toda
    reserva bloqueaba el calendario para siempre.
    """
    data     = request.get_json(silent=True) or {}
    codigo   = pol.parse_str(pnr, "pnr", max_largo=12, min_largo=4)
    apellido = pol.parse_str(data.get("apellido"), "apellido",
                             max_largo=150, requerido=False)
    doc4     = pol.parse_str(data.get("doc4"), "doc4", max_largo=10, requerido=False)

    generico = ReglaNegocioError(
        "No encontramos una reserva que coincida con los datos proporcionados.",
        403, "VOUCHER_NO_ACCESIBLE")

    reserva = cal.obtener_reserva(pnr=codigo, bloquear=True)
    if not pol.verificar_segundo_factor(reserva, apellido=apellido, doc4=doc4):
        raise generico

    pol.validar_transicion(reserva.estado, "CANCELADA")

    reserva.estado             = "CANCELADA"
    reserva.cancelada_en       = datetime.utcnow()
    reserva.cancelado_por      = "CLIENTE"
    reserva.cancelacion_motivo = pol.parse_str(
        data.get("motivo"), "motivo", max_largo=255, requerido=False
    ) or "Cancelada por el cliente desde la web."
    db.session.commit()

    log.info("Reserva %s cancelada por el cliente", reserva.pnr)
    return jsonify({
        "mensaje": "Reserva cancelada. El vehiculo vuelve a estar disponible para esas fechas.",
        "reserva": reserva.to_dict(include_detalle=True, publico=True),
    })
