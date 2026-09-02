"""Blueprint para la plataforma de Renta de Autos: Disponibilidad, Catálogo, Tarifas, Checkout y Vouchers."""
import logging
import math
import random
import string
from datetime import datetime, date, timedelta
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload, selectinload

from ..models import (
    db, Vehiculo, Modelo, Marca, Cliente, Usuario,
    Sucursal, TarifaRenta, CoberturaSeguro, ExtraServicio,
    ReservaRenta, ReservaRentaExtra
)
from backend import cache

bp = Blueprint("renta", __name__)
log = logging.getLogger(__name__)


def calcular_dias_facturables(f_inicio: datetime, f_fin: datetime) -> int:
    """
    Regla estándar de la industria (Kayak / Rentcars):
    Duración mínima: 24 horas (1 día).
    Período de gracia: 59 minutos (3540 segundos).
    Si se excede el período de gracia, se factura 1 día adicional.
    """
    segundos_totales = (f_fin - f_inicio).total_seconds()
    if segundos_totales <= 0:
        return 1
    # Margen de gracia de 59 minutos
    dias = math.ceil((segundos_totales - 3540) / 86400.0)
    return max(1, dias)


def calcular_edad(fecha_nac: date) -> int:
    today = date.today()
    return today.year - fecha_nac.year - ((today.month, today.day) < (fecha_nac.month, fecha_nac.day))


def generar_pnr_unico() -> str:
    """Genera un código PNR único en formato HA-XXXXX (ej. HA-82910)."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        sufijo = "".join(random.choices(chars, k=5))
        pnr = f"HA-{sufijo}"
        if not ReservaRenta.query.filter_by(pnr=pnr).first():
            return pnr
    # Fallback timestamp
    return f"HA-{int(datetime.utcnow().timestamp()) % 100000:05d}"


# ---------------------------------------------------------------
# GET /api/renta/sucursales
# ---------------------------------------------------------------
@bp.get("/sucursales")
@cache.cached(timeout=600)
def listar_sucursales():
    try:
        sucursales = Sucursal.query.filter_by(activo=True).order_by(Sucursal.nombre).all()
        return jsonify([s.to_dict() for s in sucursales])
    except Exception as exc:
        log.error("listar_sucursales: %s", exc)
        return jsonify({"error": "Error al consultar sucursales"}), 500


# ---------------------------------------------------------------
# GET /api/renta/coberturas
# ---------------------------------------------------------------
@bp.get("/coberturas")
@cache.cached(timeout=600)
def listar_coberturas():
    try:
        coberturas = CoberturaSeguro.query.filter_by(activo=True).order_by(CoberturaSeguro.costo_dia.asc()).all()
        return jsonify([c.to_dict() for c in coberturas])
    except Exception as exc:
        log.error("listar_coberturas: %s", exc)
        return jsonify({"error": "Error al consultar coberturas"}), 500


# ---------------------------------------------------------------
# GET /api/renta/extras
# ---------------------------------------------------------------
@bp.get("/extras")
@cache.cached(timeout=600)
def listar_extras():
    try:
        extras = ExtraServicio.query.filter_by(activo=True).order_by(ExtraServicio.id.asc()).all()
        return jsonify([e.to_dict() for e in extras])
    except Exception as exc:
        log.error("listar_extras: %s", exc)
        return jsonify({"error": "Error al consultar adicionales"}), 500


# ---------------------------------------------------------------
# GET /api/renta/disponibilidad
# Parámetros query: fecha_inicio, fecha_fin, sucursal_recogida_id,
#                   sucursal_devolucion_id, categoria, transmision, pasajeros
# ---------------------------------------------------------------
@bp.get("/disponibilidad")
def consultar_disponibilidad():
    try:
        str_inicio = request.args.get("fecha_inicio")
        str_fin    = request.args.get("fecha_fin")

        if not str_inicio or not str_fin:
            return jsonify({"error": "fecha_inicio y fecha_fin son requeridos"}), 400

        try:
            f_inicio = datetime.fromisoformat(str_inicio.replace("Z", "+00:00")).replace(tzinfo=None)
            f_fin    = datetime.fromisoformat(str_fin.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido. Utilice formato ISO 8601 (YYYY-MM-DDTHH:MM)"}), 400

        if f_fin <= f_inicio:
            return jsonify({"error": "La fecha de devolución debe ser posterior a la fecha de recogida"}), 422

        dias_facturables = calcular_dias_facturables(f_inicio, f_fin)

        # 1. Identificar vehículos ocupados por reservas confirmadas o en curso en ese intervalo
        reservas_solapadas = (
            db.session.query(ReservaRenta.vehiculo_id)
            .filter(
                ReservaRenta.estado.in_(["CONFIRMADA", "EN_CURSO"]),
                ReservaRenta.fecha_inicio < f_fin,
                ReservaRenta.fecha_fin > f_inicio,
            )
            .subquery()
        )

        # 2. Consultar vehículos libres habilitados para renta
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
                Vehiculo.estado == "DISPONIBLE",
                Vehiculo.disponible_para.in_(["RENTA", "AMBOS"]),
                TarifaRenta.activo == True,
                Vehiculo.id.notin_(reservas_solapadas),
            )
        )

        # Filtros opcionales
        if (cat := request.args.get("categoria")):
            q = q.filter(Modelo.categoria == cat.upper())
        if (trans := request.args.get("transmision")):
            q = q.filter(Vehiculo.transmision == trans.upper())
        if (pasajeros := request.args.get("pasajeros", type=int)):
            q = q.filter(Vehiculo.pasajeros >= pasajeros)

        vehiculos_disponibles = q.order_by(TarifaRenta.precio_dia_base.asc()).all()

        items = []
        for v in vehiculos_disponibles:
            t = v.tarifa_renta
            tarifa_dia = float(t.precio_dia_base)
            total_estimado = round(tarifa_dia * dias_facturables, 2)
            
            modelo = v.modelo
            marca  = modelo.marca if modelo else None
            imgs   = [img.to_dict() for img in v.imagenes]

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
                    "precio_por_dia": tarifa_dia,
                    "dias": dias_facturables,
                    "total_estimado": total_estimado,
                    "deposito_garantia": float(t.deposito_garantia),
                    "moneda": t.moneda,
                },
                "imagenes": imgs,
                "imagen_principal": imgs[0]["url"] if imgs else None,
            })

        return jsonify({
            "dias_facturables": dias_facturables,
            "fecha_inicio": f_inicio.isoformat(),
            "fecha_fin": f_fin.isoformat(),
            "total_disponibles": len(items),
            "vehiculos": items,
        })
    except Exception as exc:
        log.error("consultar_disponibilidad: %s", exc)
        return jsonify({"error": "Error al consultar disponibilidad"}), 500


# ---------------------------------------------------------------
# POST /api/renta/reservas   (Checkout de Renta Web)
# ---------------------------------------------------------------
@bp.post("/reservas")
def crear_reserva_renta():
    try:
        data = request.get_json(silent=True) or {}
        
        vid       = data.get("vehiculo_id")
        recogida  = data.get("sucursal_recogida_id")
        entrega   = data.get("sucursal_devolucion_id", recogida)
        str_ini   = data.get("fecha_inicio")
        str_fin   = data.get("fecha_fin")
        cob_id    = data.get("cobertura_id")
        extras_in = data.get("extras_ids", [])  # lista de ints o dicts {id, cantidad}
        conductor = data.get("conductor", {})

        # 1. Validaciones básicas de payload
        if not vid or not str_ini or not str_fin or not recogida or not cob_id:
            return jsonify({"error": "Faltan campos obligatorios de la reserva"}), 400

        # Validaciones de conductor
        c_nombre    = (conductor.get("nombre") or "").strip()
        c_apellido  = (conductor.get("apellido") or "").strip()
        c_email     = (conductor.get("email") or "").strip()
        c_telefono  = (conductor.get("telefono") or "").strip()
        c_doc       = (conductor.get("documento") or "").strip()
        c_licencia  = (conductor.get("licencia") or "").strip()
        str_nac     = conductor.get("fecha_nacimiento")

        if not all([c_nombre, c_apellido, c_email, c_telefono, c_doc, c_licencia, str_nac]):
            return jsonify({"error": "Todos los datos del conductor son obligatorios (nombre, apellido, email, teléfono, documento, licencia, fecha de nacimiento)"}), 400

        try:
            f_nac = date.fromisoformat(str_nac)
        except ValueError:
            return jsonify({"error": "Fecha de nacimiento inválida (formato YYYY-MM-DD)"}), 400

        # 2. Regla de Negocio: Edad mínima 21 años
        edad = calcular_edad(f_nac)
        if edad < 21:
            return jsonify({
                "error": f"El conductor principal debe tener al menos 21 años cumplidos para rentar un auto. Edad calculada: {edad} años."
            }), 422

        # 3. Fechas
        try:
            f_inicio = datetime.fromisoformat(str_ini.replace("Z", "+00:00")).replace(tzinfo=None)
            f_fin    = datetime.fromisoformat(str_fin.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return jsonify({"error": "Formato de fechas de reserva inválido"}), 400

        if f_fin <= f_inicio:
            return jsonify({"error": "La fecha de devolución debe ser posterior a la de recogida"}), 422

        total_dias = calcular_dias_facturables(f_inicio, f_fin)

        # 4. Bloqueo pesimista del vehículo para garantizar atomicidad
        vehiculo = (
            Vehiculo.query
            .filter_by(id=int(vid))
            .with_for_update()
            .first()
        )
        if not vehiculo:
            return jsonify({"error": "Vehículo no encontrado"}), 404

        if vehiculo.estado != "DISPONIBLE" or vehiculo.disponible_para not in ("RENTA", "AMBOS"):
            return jsonify({"error": "Vehículo no habilitado para renta"}), 422

        if not vehiculo.tarifa_renta or not vehiculo.tarifa_renta.activo:
            return jsonify({"error": "El vehículo no tiene una tarifa de renta configurada"}), 422

        # 5. Verificar que no exista colisión de calendario
        colision = ReservaRenta.query.filter(
            ReservaRenta.vehiculo_id == vehiculo.id,
            ReservaRenta.estado.in_(["CONFIRMADA", "EN_CURSO"]),
            ReservaRenta.fecha_inicio < f_fin,
            ReservaRenta.fecha_fin > f_inicio,
        ).first()

        if colision:
            return jsonify({"error": "El vehículo seleccionado ya no está disponible para las fechas indicadas"}), 409

        # 6. Validar sucursales y cobertura
        suc_rec = db.session.get(Sucursal, int(recogida))
        suc_dev = db.session.get(Sucursal, int(entrega))
        if not suc_rec or not suc_dev:
            return jsonify({"error": "Sucursal de recogida o devolución no válida"}), 400

        cobertura = db.session.get(CoberturaSeguro, int(cob_id))
        if not cobertura or not cobertura.activo:
            return jsonify({"error": "Cobertura de seguro no válida"}), 400

        # 7. Cálculo de costos
        tarifa_base        = float(vehiculo.tarifa_renta.precio_dia_base)
        subtotal_vehiculo  = round(tarifa_base * total_dias, 2)
        subtotal_cobertura = round(float(cobertura.costo_dia) * total_dias, 2)
        
        # Procesar extras
        subtotal_extras = 0.0
        extras_a_insertar = []
        
        for item in extras_in:
            if isinstance(item, dict):
                eid = item.get("id")
                cant = max(1, int(item.get("cantidad", 1)))
            else:
                eid = int(item)
                cant = 1
                
            ex = db.session.get(ExtraServicio, eid)
            if ex and ex.activo:
                costo_ex = float(ex.costo_dia)
                sub_ex = round(costo_ex if ex.es_pago_unico else (costo_ex * total_dias * cant), 2)
                subtotal_extras += sub_ex
                extras_a_insertar.append((ex.id, cant, costo_ex, sub_ex))

        total_alquiler = round(subtotal_vehiculo + subtotal_cobertura + subtotal_extras, 2)
        deposito_garantia = float(cobertura.deposito_requerido or vehiculo.tarifa_renta.deposito_garantia)

        # 8. Identificar o registrar cliente
        cliente_id = None
        if current_user.is_authenticated:
            cli = Cliente.query.filter_by(usuario_id=current_user.id).first()
            if not cli:
                cli = Cliente(
                    usuario_id=current_user.id,
                    nombre=c_nombre,
                    apellido=c_apellido,
                    email=c_email,
                    telefono=c_telefono,
                    cedula=c_doc,
                )
                db.session.add(cli)
                db.session.flush()
            cliente_id = cli.id

        # 9. Crear la reserva con PNR
        pnr = generar_pnr_unico()
        reserva = ReservaRenta(
            pnr                     = pnr,
            vehiculo_id             = vehiculo.id,
            cliente_id              = cliente_id,
            sucursal_recogida_id    = suc_rec.id,
            sucursal_devolucion_id  = suc_dev.id,
            fecha_inicio            = f_inicio,
            fecha_fin               = f_fin,
            total_dias              = total_dias,
            cobertura_id            = cobertura.id,
            tarifa_diaria_aplicada  = tarifa_base,
            subtotal_vehiculo       = subtotal_vehiculo,
            subtotal_cobertura      = subtotal_cobertura,
            subtotal_extras         = subtotal_extras,
            total_alquiler          = total_alquiler,
            deposito_garantia_monto = deposito_garantia,
            moneda                  = vehiculo.tarifa_renta.moneda,
            estado                  = "CONFIRMADA",
            conductor_nombre        = c_nombre,
            conductor_apellido      = c_apellido,
            conductor_email         = c_email,
            conductor_telefono      = c_telefono,
            conductor_documento     = c_doc,
            conductor_licencia      = c_licencia,
            conductor_fecha_nac     = f_nac,
            notas_vuelo             = data.get("notas_vuelo"),
        )
        db.session.add(reserva)
        db.session.flush()

        # Insertar extras asociados
        for eid, cant, precio_u, sub in extras_a_insertar:
            re = ReservaRentaExtra(
                reserva_id      = reserva.id,
                extra_id        = eid,
                cantidad        = cant,
                precio_unitario = precio_u,
                subtotal        = sub,
            )
            db.session.add(re)

        db.session.commit()
        log.info("Reserva de renta creada exitosamente: PNR=%s, Vehículo=%d, Total=%.2f %s", pnr, vehiculo.id, total_alquiler, reserva.moneda)

        return jsonify({
            "mensaje": "Reserva confirmada con éxito",
            "pnr": pnr,
            "reserva": reserva.to_dict(include_detalle=True),
        }), 201

    except Exception as exc:
        db.session.rollback()
        log.error("crear_reserva_renta: %s", exc)
        return jsonify({"error": "Error interno al procesar la reserva"}), 500


# ---------------------------------------------------------------
# GET /api/renta/reservas/<pnr>   (Consulta de Voucher)
# ---------------------------------------------------------------
@bp.get("/reservas/<pnr>")
def consultar_voucher(pnr: str):
    try:
        pnr_clean = pnr.strip().upper()
        reserva = ReservaRenta.query.filter_by(pnr=pnr_clean).first()
        if not reserva:
            return jsonify({"error": "Reserva no encontrada con el código PNR proporcionado"}), 404

        return jsonify(reserva.to_dict(include_detalle=True))
    except Exception as exc:
        log.error("consultar_voucher %s: %s", pnr, exc)
        return jsonify({"error": "Error al consultar voucher"}), 500
