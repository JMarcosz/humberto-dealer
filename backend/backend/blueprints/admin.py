"""Panel admin: gestión de estados, histórico de ventas, validación de fichas."""
import logging
import os
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

from sqlalchemy.orm import joinedload, selectinload

from ..models import (
    db, Vehiculo, Venta, Reserva, Cliente, Pago, VehiculoImagen, Marca, Modelo,
    ReservaRenta, TarifaRenta, InspeccionRenta
)
from ..decorators import admin_required, maneja_errores_renta
from ..errors import ReglaNegocioError
from ..validators import forzar_mayusculas, validar_mayusculas
from ..services import renta_calendario as cal
from ..services import renta_politica as pol
from backend import limiter

ALLOWED_EXT = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

def _ext_valida(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

def _validar_magic_bytes(header: bytes) -> bool:
    """Valida los bytes de cabecera (Magic Numbers) de formatos de imagen permitidos."""
    if header.startswith(b'\xff\xd8\xff'):
        return True  # JPEG
    if header.startswith(b'\x89PNG\r\n\x1a\n'):
        return True  # PNG
    if header.startswith(b'GIF87a') or header.startswith(b'GIF89a'):
        return True  # GIF
    if header.startswith(b'RIFF') and len(header) >= 12 and header[8:12] == b'WEBP':
        return True  # WEBP
    return False

bp  = Blueprint("admin", __name__)
log = logging.getLogger(__name__)

TRANSICIONES_VALIDAS = {
    "DISPONIBLE": {"RESERVADO", "PENDIENTE_VALIDACION"},
    "RESERVADO":  {"DISPONIBLE", "VENDIDO"},
    "BORRADOR":   {"PENDIENTE_VALIDACION", "DISPONIBLE"},
    "PENDIENTE_VALIDACION": {"DISPONIBLE", "BORRADOR"},
}


# ---------------------------------------------------------------
# GET /api/admin/vehiculos  — lista completa incluyendo borradores
# ---------------------------------------------------------------
@bp.get("/vehiculos")
@admin_required
def listar_vehiculos_admin():
    try:
        page     = request.args.get("page", 1, type=int)
        estado   = request.args.get("estado")
        per_page = request.args.get("per_page", 20, type=int)
        buscar   = request.args.get("buscar", "").strip()

        q = (
            Vehiculo.query
            .join(Modelo)
            .join(Marca)
            .options(
                joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
                selectinload(Vehiculo.imagenes),
            )
        )

        if estado:
            estado_upper = estado.upper()
            if estado_upper == "PENDIENTE_VALIDACION":
                q = q.filter(Vehiculo.estado.in_(["PENDIENTE_VALIDACION", "BORRADOR"]))
            else:
                q = q.filter(Vehiculo.estado == estado_upper)

        if buscar:
            like = f"%{buscar}%"
            q = q.filter(
                db.or_(
                    Marca.nombre.ilike(like),
                    Modelo.nombre.ilike(like),
                )
            )

        paginado = q.order_by(Vehiculo.creado_en.desc()).paginate(
            page=page, per_page=min(per_page, 100), error_out=False
        )
        return jsonify({
            "total": paginado.total,
            "page":  paginado.page,
            "pages": paginado.pages,
            "items": [v.to_dict_summary() for v in paginado.items],
        })
    except Exception as exc:
        log.error("listar_vehiculos_admin: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/admin/vehiculos/ids  — solo IDs que coinciden con filtros
# ---------------------------------------------------------------
@bp.get("/vehiculos/ids")
@admin_required
def listar_ids_vehiculos():
    try:
        estado = request.args.get("estado")
        buscar = request.args.get("buscar", "").strip()

        q = db.session.query(Vehiculo.id).join(Modelo).join(Marca)

        if estado:
            estado_upper = estado.upper()
            if estado_upper == "PENDIENTE_VALIDACION":
                q = q.filter(Vehiculo.estado.in_(["PENDIENTE_VALIDACION", "BORRADOR"]))
            else:
                q = q.filter(Vehiculo.estado == estado_upper)

        if buscar:
            like = f"%{buscar}%"
            q = q.filter(db.or_(Marca.nombre.ilike(like), Modelo.nombre.ilike(like)))

        ids = [row[0] for row in q.all()]
        return jsonify({"ids": ids, "total": len(ids)})
    except Exception as exc:
        log.error("listar_ids_vehiculos: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/admin/vehiculos/<id>  — ficha individual (incluye borradores)
# ---------------------------------------------------------------
@bp.get("/vehiculos/<int:vid>")
@admin_required
def get_vehiculo_admin(vid: int):
    try:
        v = db.get_or_404(Vehiculo, vid)
        return jsonify(v.to_dict(include_imagenes=True))
    except Exception as exc:
        log.error("get_vehiculo_admin %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# PATCH /api/admin/vehiculos/<id>/estado
# Body: { "estado": "VENDIDO" | "DISPONIBLE" | ... }
# ---------------------------------------------------------------
@bp.patch("/vehiculos/<int:vid>/estado")
@admin_required
def cambiar_estado(vid: int):
    try:
        data         = request.get_json(silent=True) or {}
        nuevo_estado = (data.get("estado") or "").upper()

        v = db.get_or_404(Vehiculo, vid)
        estados_permitidos = TRANSICIONES_VALIDAS.get(v.estado, set())

        if nuevo_estado not in estados_permitidos:
            return jsonify({
                "error": f"Transición inválida: {v.estado} → {nuevo_estado}"
            }), 422

        v.estado = nuevo_estado
        if nuevo_estado == "DISPONIBLE" and not v.publicado_en:
            v.publicado_en = datetime.utcnow()

        db.session.commit()
        log.info("Vehículo %d: estado → %s", vid, nuevo_estado)
        return jsonify({"mensaje": "Estado actualizado", "estado": v.estado})
    except Exception as exc:
        db.session.rollback()
        log.error("cambiar_estado %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/admin/ventas   — confirmar venta, marcar VENDIDO
# Body: { "vehiculo_id", "cliente_id", "precio_final",
#         "metodo_pago", "reserva_id"(opt),
#         "ubicacion_lat", "ubicacion_lng", "ubicacion_desc" }
# ---------------------------------------------------------------
@bp.post("/ventas")
@admin_required
def confirmar_venta():
    try:
        data = request.get_json(silent=True) or {}
        vid  = data.get("vehiculo_id")
        cid  = data.get("cliente_id")
        if not vid or not cid:
            return jsonify({"error": "vehiculo_id y cliente_id son obligatorios"}), 400

        # Bloqueo pesimista para evitar condición de carrera (TOCTOU)
        vehiculo = (
            Vehiculo.query
            .filter_by(id=int(vid))
            .with_for_update()
            .first()
        )
        if not vehiculo:
            return jsonify({"error": "Vehículo no encontrado"}), 404

        cliente = db.get_or_404(Cliente, int(cid))

        if vehiculo.estado not in ("DISPONIBLE", "RESERVADO"):
            return jsonify({"error": "Vehículo no disponible para venta"}), 422

        if vehiculo.disponible_para not in ("VENTA", "AMBOS"):
            return jsonify({
                "error": "Este vehículo está dedicado exclusivamente a renta.",
                "codigo": "VEHICULO_NO_VENDIBLE",
            }), 422

        renta_futura = cal.tiene_rentas_futuras(vehiculo.id)
        if renta_futura:
            return jsonify({
                "error": (
                    f"No se puede vender: el vehículo tiene la renta "
                    f"{renta_futura.pnr} vigente hasta "
                    f"{renta_futura.fecha_fin.strftime('%d/%m/%Y')}."
                ),
                "codigo": "TIENE_RENTAS_FUTURAS",
            }), 409

        venta = Venta(
            vehiculo_id    = vehiculo.id,
            cliente_id     = cliente.id,
            reserva_id     = data.get("reserva_id"),
            precio_final   = data.get("precio_final", vehiculo.precio),
            ubicacion_lat  = data.get("ubicacion_lat"),
            ubicacion_lng  = data.get("ubicacion_lng"),
            ubicacion_desc = data.get("ubicacion_desc"),
            notas          = data.get("notas"),
        )
        vehiculo.estado = "VENDIDO"
        db.session.add(venta)
        db.session.flush()  # obtener venta.id antes del commit

        # Registrar el pago asociado
        metodo_pago = (data.get("metodo_pago") or "EFECTIVO").upper()
        pago = Pago(
            venta_id  = venta.id,
            metodo    = metodo_pago if metodo_pago in ("EFECTIVO", "TRANSFERENCIA", "TARJETA", "FINANCIAMIENTO", "OTRO") else "OTRO",
            monto     = data.get("precio_final", vehiculo.precio),
        )
        db.session.add(pago)

        # Si había reserva activa → CONFIRMADA
        if data.get("reserva_id"):
            res = db.session.get(Reserva, int(data["reserva_id"]))
            if res:
                res.estado = "CONFIRMADA"

        db.session.commit()
        log.info("Venta confirmada: vehículo %d → cliente %d", vehiculo.id, cliente.id)
        return jsonify({"mensaje": "Venta registrada", "venta": venta.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("confirmar_venta: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/admin/reservas   — todas las reservas con nombres
# ---------------------------------------------------------------
@bp.get("/reservas")
@admin_required
def listar_reservas_admin():
    try:
        page     = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 30, type=int)
        estado   = request.args.get("estado")

        q = Reserva.query.options(
            joinedload(Reserva.vehiculo).joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
            joinedload(Reserva.cliente),
        )
        if estado:
            q = q.filter_by(estado=estado.upper())
        paginado = q.order_by(Reserva.creado_en.desc()).paginate(
            page=page, per_page=min(per_page, 100), error_out=False
        )

        items = []
        for r in paginado.items:
            item = r.to_dict()
            if r.vehiculo and r.vehiculo.modelo:
                marca  = r.vehiculo.modelo.marca.nombre if r.vehiculo.modelo.marca else ""
                modelo = r.vehiculo.modelo.nombre
                item["vehiculo_nombre"] = f"{marca} {modelo}".strip()
            else:
                item["vehiculo_nombre"] = f"Vehículo #{r.vehiculo_id}"
            if r.cliente:
                item["cliente_nombre"] = f"{r.cliente.nombre} {r.cliente.apellido}".strip()
            else:
                item["cliente_nombre"] = f"Cliente #{r.cliente_id}"
            items.append(item)

        return jsonify({"total": paginado.total, "page": paginado.page, "items": items})
    except Exception as exc:
        log.error("listar_reservas_admin: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/admin/historico   — histórico de ventas
# ---------------------------------------------------------------
@bp.get("/historico")
@admin_required
def historico_ventas():
    try:
        page     = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 30, type=int)
        paginado = (
            Venta.query
            .options(
                joinedload(Venta.vehiculo).joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
                joinedload(Venta.cliente),
                selectinload(Venta.pagos),
            )
            .order_by(Venta.fecha_hora.desc())
            .paginate(page=page, per_page=min(per_page, 100), error_out=False)
        )
        items = []
        for v in paginado.items:
            item = v.to_dict()
            if v.vehiculo and v.vehiculo.modelo:
                marca  = v.vehiculo.modelo.marca.nombre if v.vehiculo.modelo.marca else ""
                modelo = v.vehiculo.modelo.nombre
                item["vehiculo_nombre"] = f"{marca} {modelo}".strip()
            else:
                item["vehiculo_nombre"] = f"Vehículo #{v.vehiculo_id}"
            if v.cliente:
                item["cliente_nombre"] = f"{v.cliente.nombre} {v.cliente.apellido}".strip()
            else:
                item["cliente_nombre"] = f"Cliente #{v.cliente_id}"
            item["metodo_pago"] = v.pagos[0].metodo if v.pagos else None
            items.append(item)
        return jsonify({
            "total": paginado.total,
            "page":  paginado.page,
            "items": items,
        })
    except Exception as exc:
        log.error("historico_ventas: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# PATCH /api/admin/vehiculos/<id>  — editar ficha
# ---------------------------------------------------------------
@bp.patch("/vehiculos/<int:vid>")
@admin_required
def editar_vehiculo(vid: int):
    try:
        data = request.get_json(silent=True) or {}
        forzar_mayusculas(data, ["color"])
        errores = validar_mayusculas(data, ["color"])
        if errores:
            return jsonify({"error": errores[0]}), 422

        v = db.get_or_404(Vehiculo, vid)

        if "precio" in data:
            try:
                precio_val = float(data["precio"])
                if precio_val <= 0:
                    return jsonify({"error": "El precio debe ser un número positivo"}), 422
                data["precio"] = precio_val
            except (TypeError, ValueError):
                return jsonify({"error": "Precio inválido"}), 422

        if "kilometraje" in data:
            try:
                km_val = int(data["kilometraje"])
                if km_val < 0:
                    return jsonify({"error": "El kilometraje no puede ser negativo"}), 422
                data["kilometraje"] = km_val
            except (TypeError, ValueError):
                return jsonify({"error": "Kilometraje inválido"}), 422

        if "combustible" in data:
            comb = str(data["combustible"]).upper().strip()
            if comb not in {"GASOLINA", "DIESEL", "HIBRIDO", "ELECTRICO"}:
                return jsonify({"error": "Tipo de combustible no válido"}), 422
            data["combustible"] = comb

        if "transmision" in data:
            trans = str(data["transmision"]).upper().strip()
            if trans not in {"AUTOMATICA", "MANUAL", "CVT"}:
                return jsonify({"error": "Tipo de transmisión no válido"}), 422
            data["transmision"] = trans

        if "descripcion" in data and data["descripcion"]:
            if len(str(data["descripcion"])) > 5000:
                return jsonify({"error": "La descripción no puede exceder 5,000 caracteres"}), 422

        CAMPOS_EDITABLES = {
            "precio", "color", "kilometraje", "descripcion",
            "combustible", "transmision",
        }
        for campo in CAMPOS_EDITABLES:
            if campo in data:
                setattr(v, campo, data[campo])

        db.session.commit()
        return jsonify({"mensaje": "Vehículo actualizado", "vehiculo": v.to_dict()})
    except Exception as exc:
        db.session.rollback()
        log.error("editar_vehiculo %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/admin/vehiculos/<id>/imagenes
# Acepta: multipart con 'file'  OR  JSON con { "url": "..." }
# ---------------------------------------------------------------
@bp.post("/vehiculos/<int:vid>/imagenes")
@admin_required
def agregar_imagen(vid: int):
    try:
        v = db.get_or_404(Vehiculo, vid)
        url = None

        if 'file' in request.files:
            archivo = request.files['file']
            if not archivo or not _ext_valida(archivo.filename):
                return jsonify({"error": "Formato no válido. Use jpg, png, webp o gif"}), 400

            header = archivo.read(16)
            archivo.seek(0)
            if not _validar_magic_bytes(header):
                return jsonify({"error": "El contenido del archivo no corresponde a una imagen válida"}), 400

            ext      = archivo.filename.rsplit('.', 1)[1].lower()
            nombre   = f"{uuid.uuid4().hex}.{ext}"
            img_dir  = os.path.join(current_app.config['UPLOAD_FOLDER'], 'images')
            os.makedirs(img_dir, exist_ok=True)
            archivo.save(os.path.join(img_dir, nombre))
            url = f"/api/uploads/images/{nombre}"
        else:
            data = request.get_json(silent=True) or {}
            url  = (data.get('url') or '').strip()
            if not url:
                return jsonify({"error": "Se requiere 'file' o 'url'"}), 400

        total = VehiculoImagen.query.filter_by(vehiculo_id=vid).count()
        imagen = VehiculoImagen(
            vehiculo_id  = vid,
            url          = url,
            es_principal = total == 0,
            orden        = total,
        )
        db.session.add(imagen)
        db.session.commit()
        log.info("Imagen agregada al vehículo %d: %s", vid, url)
        return jsonify({"mensaje": "Imagen agregada", "imagen": imagen.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("agregar_imagen %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# DELETE /api/admin/imagenes/<id>
# ---------------------------------------------------------------
@bp.delete("/imagenes/<int:iid>")
@admin_required
def eliminar_imagen(iid: int):
    try:
        img = db.get_or_404(VehiculoImagen, iid)
        era_principal = img.es_principal
        vid = img.vehiculo_id

        # Eliminar archivo físico si fue subido al servidor
        if img.url.startswith('/api/uploads/'):
            nombre  = img.url.split('/')[-1]
            ruta    = os.path.join(current_app.config['UPLOAD_FOLDER'], 'images', nombre)
            if os.path.exists(ruta):
                os.remove(ruta)

        db.session.delete(img)
        db.session.flush()

        if era_principal:
            primera = VehiculoImagen.query.filter_by(vehiculo_id=vid).order_by(VehiculoImagen.orden).first()
            if primera:
                primera.es_principal = True

        db.session.commit()
        return jsonify({"mensaje": "Imagen eliminada"})
    except Exception as exc:
        db.session.rollback()
        log.error("eliminar_imagen %d: %s", iid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# PATCH /api/admin/imagenes/<id>/principal
# ---------------------------------------------------------------
@bp.patch("/imagenes/<int:iid>/principal")
@admin_required
def set_imagen_principal(iid: int):
    try:
        img = db.get_or_404(VehiculoImagen, iid)
        VehiculoImagen.query.filter_by(vehiculo_id=img.vehiculo_id).update({"es_principal": False})
        img.es_principal = True
        db.session.commit()
        return jsonify({"mensaje": "Imagen principal actualizada"})
    except Exception as exc:
        db.session.rollback()
        log.error("set_imagen_principal %d: %s", iid, exc)
        return jsonify({"error": "Error interno"}), 500


# ===============================================================
# OPERACIONES DE RENTA DE AUTOS (US-RENT-05)
# ===============================================================
# Toda la politica vive en services/renta_politica.py: aqui no se decide,
# se orquesta. Ningun endpoint contiene un `try` propio.

_ESTADOS_RESERVA_RENTA = {"CONFIRMADA", "EN_CURSO", "COMPLETADA",
                          "CANCELADA", "NO_SHOW", "EXPIRADA"}


# ---------------------------------------------------------------
# GET /api/admin/renta/reservas
# ---------------------------------------------------------------
@bp.get("/renta/reservas")
@admin_required
@maneja_errores_renta
def listar_reservas_renta_admin():
    page     = pol.parse_int(request.args.get("page"), "page",
                             minimo=1, requerido=False, defecto=1)
    per_page = pol.parse_int(request.args.get("per_page"), "per_page",
                             minimo=1, maximo=100, requerido=False, defecto=20)
    buscar   = pol.parse_str(request.args.get("buscar"), "buscar",
                             max_largo=100, requerido=False)

    q = ReservaRenta.query.options(
        joinedload(ReservaRenta.vehiculo).joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
        joinedload(ReservaRenta.sucursal_recogida),
        joinedload(ReservaRenta.sucursal_devolucion),
        joinedload(ReservaRenta.cobertura),
    )

    estado_raw = request.args.get("estado")
    if estado_raw and estado_raw.upper() != "ALL":
        estado = pol.parse_enum(estado_raw, "estado", _ESTADOS_RESERVA_RENTA)
        q = q.filter(ReservaRenta.estado == estado)

    if buscar:
        like = f"%{buscar}%"
        q = q.filter(db.or_(
            ReservaRenta.pnr.ilike(like),
            ReservaRenta.conductor_nombre.ilike(like),
            ReservaRenta.conductor_apellido.ilike(like),
            ReservaRenta.conductor_documento.ilike(like),
            ReservaRenta.conductor_email.ilike(like),
        ))

    paginado = q.order_by(ReservaRenta.fecha_inicio.desc()).paginate(
        page=page, per_page=per_page, error_out=False)

    return jsonify({
        "total": paginado.total,
        "page": paginado.page,
        "pages": paginado.pages,
        "items": [r.to_dict(include_detalle=True) for r in paginado.items],
    })


def _reserva_desde_payload(data, *, bloquear=True):
    """Localiza la reserva por pnr o reserva_id, con coercion segura."""
    pnr = pol.parse_str(data.get("pnr"), "pnr", max_largo=12, requerido=False)
    rid = pol.parse_int(data.get("reserva_id"), "reserva_id",
                        minimo=1, requerido=False)
    return cal.obtener_reserva(pnr=pnr, reserva_id=rid, bloquear=bloquear)


# ---------------------------------------------------------------
# POST /api/admin/renta/check-in   (entrega del vehiculo)
# ---------------------------------------------------------------
@bp.post("/renta/check-in")
@admin_required
@limiter.limit("60 per minute")
@maneja_errores_renta
def registrar_check_in():
    data    = request.get_json(silent=True) or {}
    reserva = _reserva_desde_payload(data)

    # minimo=0: un auto nuevo con 0 km debe poder entregarse. El `if not odometro`
    # anterior lo rechazaba como si el campo faltara.
    odometro    = pol.parse_int(data.get("odometro"), "odometro", minimo=0, maximo=9999999)
    combustible = pol.parse_enum(data.get("combustible"), "combustible",
                                 set(pol.NIVELES_COMBUSTIBLE),
                                 requerido=False, defecto="8/8")
    observaciones = pol.parse_str(data.get("observaciones_danos"), "observaciones_danos",
                                  max_largo=2000, requerido=False) or ""

    pol.validar_transicion(reserva.estado, "EN_CURSO")

    # El auto no se entrega con meses de antelacion respecto a lo pactado.
    ahora = datetime.utcnow()
    inicio_ventana = reserva.fecha_inicio - timedelta(hours=pol.VENTANA_CHECKIN_ANTES_HORAS)
    fin_ventana    = reserva.fecha_inicio + timedelta(hours=pol.VENTANA_CHECKIN_DESPUES_HORAS)
    if ahora < inicio_ventana:
        raise ReglaNegocioError(
            f"El check-in solo puede registrarse desde "
            f"{pol.VENTANA_CHECKIN_ANTES_HORAS} horas antes de la recogida pactada "
            f"({reserva.fecha_inicio.isoformat()}).",
            422, "CHECKIN_FUERA_DE_VENTANA")
    if ahora > fin_ventana:
        raise ReglaNegocioError(
            "La ventana de retiro de esta reserva ya vencio. Registrala como no-show "
            "o crea una reserva nueva.",
            422, "CHECKIN_VENTANA_VENCIDA")

    fotos = data.get("fotos_urls", "")
    db.session.add(InspeccionRenta(
        reserva_id          = reserva.id,
        tipo                = "ENTREGA",
        odometro            = odometro,
        combustible         = combustible,
        observaciones_danos = observaciones,
        fotos_urls          = fotos if isinstance(fotos, str) else ",".join(map(str, fotos)),
    ))

    reserva.estado              = "EN_CURSO"
    reserva.fecha_recogida_real = ahora

    # El vehiculo pasa a RENTADO: mientras rueda no puede entrar al embudo de venta.
    if reserva.vehiculo:
        reserva.vehiculo.estado = "RENTADO"

    db.session.commit()
    log.info("Check-in PNR %s: odometro=%d combustible=%s", reserva.pnr, odometro, combustible)
    return jsonify({
        "mensaje": "Check-in registrado exitosamente. Vehiculo entregado.",
        "reserva": reserva.to_dict(include_detalle=True),
    })


# ---------------------------------------------------------------
# POST /api/admin/renta/check-out   (devolucion y liquidacion)
# ---------------------------------------------------------------
@bp.post("/renta/check-out")
@admin_required
@limiter.limit("60 per minute")
@maneja_errores_renta
def registrar_check_out():
    data    = request.get_json(silent=True) or {}
    reserva = _reserva_desde_payload(data)

    odometro    = pol.parse_int(data.get("odometro"), "odometro", minimo=0, maximo=9999999)
    combustible = pol.parse_enum(data.get("combustible"), "combustible",
                                 set(pol.NIVELES_COMBUSTIBLE),
                                 requerido=False, defecto="8/8")
    observaciones = pol.parse_str(data.get("observaciones_danos"), "observaciones_danos",
                                  max_largo=2000, requerido=False) or ""
    cargo_danos = pol.parse_decimal(data.get("cargo_danos"), "cargo_danos",
                                    minimo=Decimal("0"), maximo=Decimal("99999999"),
                                    requerido=False, defecto=Decimal("0.00"))

    pol.validar_transicion(reserva.estado, "COMPLETADA")

    entrega = next((i for i in reserva.inspecciones if i.tipo == "ENTREGA"), None)
    if entrega and odometro < entrega.odometro:
        raise ReglaNegocioError(
            f"El odometro de devolucion ({odometro} km) no puede ser menor que el "
            f"de entrega ({entrega.odometro} km).",
            422, "ODOMETRO_REGRESIVO")

    db.session.add(InspeccionRenta(
        reserva_id          = reserva.id,
        tipo                = "DEVOLUCION",
        odometro            = odometro,
        combustible         = combustible,
        observaciones_danos = observaciones,
        fotos_urls          = "",
    ))

    # Reglas 1 y 5 al cierre: retraso y combustible faltante.
    ahora       = datetime.utcnow()
    penalidades = pol.calcular_penalidades(
        fecha_fin_prevista = reserva.fecha_fin,
        devuelto_en        = ahora,
        octavos_entrega    = pol.parse_nivel_combustible(
            entrega.combustible if entrega else "8/8"),
        octavos_devolucion = pol.parse_nivel_combustible(combustible),
        tarifa_dia         = reserva.tarifa_diaria_aplicada,
    )
    total_penalidades = penalidades["total_penalidades"] + cargo_danos

    reserva.horas_retraso         = penalidades["horas_retraso"]
    reserva.cargo_retraso         = penalidades["cargo_retraso"]
    reserva.cargo_combustible     = penalidades["cargo_combustible"]
    reserva.cargo_danos           = cargo_danos
    reserva.total_penalidades     = total_penalidades
    reserva.total_final           = reserva.total_alquiler + total_penalidades
    reserva.fecha_devolucion_real = ahora
    reserva.estado                = "COMPLETADA"

    if reserva.vehiculo:
        if odometro > (reserva.vehiculo.kilometraje or 0):
            reserva.vehiculo.kilometraje = odometro
        if reserva.vehiculo.estado == "RENTADO":
            reserva.vehiculo.estado = "DISPONIBLE"

    db.session.commit()

    deposito  = reserva.deposito_garantia_monto
    retencion = min(deposito, total_penalidades)
    mensaje = ("Check-out registrado. Renta finalizada sin cargos: procede liberar "
               "el deposito completo.") if total_penalidades <= 0 else (
        f"Check-out registrado con cargos por {total_penalidades} {reserva.moneda}. "
        f"Retener {retencion} del deposito y liberar el resto.")

    log.info("Check-out PNR %s: odometro=%d penalidades=%s",
             reserva.pnr, odometro, total_penalidades)
    return jsonify({
        "mensaje": mensaje,
        "liquidacion": {
            "horas_retraso":      float(penalidades["horas_retraso"]),
            "cargo_retraso":      float(penalidades["cargo_retraso"]),
            "octavos_faltantes":  penalidades["octavos_faltantes"],
            "cargo_combustible":  float(penalidades["cargo_combustible"]),
            "cargo_danos":        float(cargo_danos),
            "total_penalidades":  float(total_penalidades),
            "total_final":        float(reserva.total_final),
            "deposito_a_retener": float(retencion),
            "deposito_a_liberar": float(deposito - retencion),
        },
        "reserva": reserva.to_dict(include_detalle=True),
    })


# ---------------------------------------------------------------
# POST /api/admin/renta/cancelar   (cancelacion por mostrador)
# ---------------------------------------------------------------
@bp.post("/renta/cancelar")
@admin_required
@maneja_errores_renta
def cancelar_reserva_renta_admin():
    data    = request.get_json(silent=True) or {}
    reserva = _reserva_desde_payload(data)
    motivo  = pol.parse_str(data.get("motivo"), "motivo", max_largo=255, min_largo=5)
    destino = pol.parse_enum(data.get("estado"), "estado", {"CANCELADA", "NO_SHOW"},
                             requerido=False, defecto="CANCELADA")

    pol.validar_transicion(reserva.estado, destino)

    reserva.estado             = destino
    reserva.cancelada_en       = datetime.utcnow()
    reserva.cancelado_por      = "ADMIN"
    reserva.cancelacion_motivo = motivo
    db.session.commit()

    log.info("Reserva %s marcada como %s por admin", reserva.pnr, destino)
    return jsonify({
        "mensaje": f"Reserva marcada como {destino}. El vehiculo vuelve a estar disponible.",
        "reserva": reserva.to_dict(include_detalle=True),
    })


# ---------------------------------------------------------------
# POST /api/admin/renta/tarifas
# ---------------------------------------------------------------
@bp.post("/renta/tarifas")
@admin_required
@limiter.limit("30 per minute")
@maneja_errores_renta
def guardar_tarifa_renta():
    data = request.get_json(silent=True) or {}

    vid    = pol.parse_int(data.get("vehiculo_id"), "vehiculo_id", minimo=1)
    precio = pol.parse_decimal(data.get("precio_dia_base"), "precio_dia_base",
                               minimo=Decimal("0.01"), maximo=Decimal("99999999"))
    deposito = pol.parse_decimal(data.get("deposito_garantia"), "deposito_garantia",
                                 minimo=Decimal("0"), maximo=Decimal("99999999"),
                                 requerido=False, defecto=Decimal("500.00"))
    moneda = pol.parse_enum(data.get("moneda"), "moneda", {"USD", "DOP"},
                            requerido=False, defecto="USD")
    km_inc = pol.parse_str(data.get("kilometraje_incluido"), "kilometraje_incluido",
                           max_largo=50, requerido=False) or "ILIMITADO"

    vehiculo = db.session.get(Vehiculo, vid)
    if not vehiculo:
        raise ReglaNegocioError("Vehiculo no encontrado.", 404, "VEHICULO_NO_ENCONTRADO")

    # Solo se toca `disponible_para` si viene explicito: antes se sobrescribia a
    # AMBOS en toda llamada, asi que cambiar un precio reconvertia el vehiculo.
    if "disponible_para" in data:
        destino = pol.parse_enum(data.get("disponible_para"), "disponible_para",
                                 {"VENTA", "RENTA", "AMBOS"})
        if destino == "VENTA":
            futura = cal.tiene_rentas_futuras(vehiculo.id)
            if futura:
                raise ReglaNegocioError(
                    f"No se puede dedicar este vehiculo solo a venta: tiene la "
                    f"renta {futura.pnr} vigente hasta {futura.fecha_fin.isoformat()}.",
                    409, "TIENE_RENTAS_FUTURAS")
        if destino == "RENTA":
            venta_activa = Reserva.query.filter_by(
                vehiculo_id=vehiculo.id, estado="EN_PROCESO").first()
            if venta_activa:
                raise ReglaNegocioError(
                    "No se puede dedicar a renta: el vehiculo tiene una reserva de "
                    "venta en proceso.",
                    409, "TIENE_RESERVA_VENTA")
        vehiculo.disponible_para = destino

    if "pasajeros" in data:
        vehiculo.pasajeros = pol.parse_int(data["pasajeros"], "pasajeros",
                                           minimo=1, maximo=20)
    if "maletas_grandes" in data:
        vehiculo.maletas_grandes = pol.parse_int(data["maletas_grandes"],
                                                 "maletas_grandes", minimo=0, maximo=20)
    if "maletas_pequenas" in data:
        vehiculo.maletas_pequenas = pol.parse_int(data["maletas_pequenas"],
                                                  "maletas_pequenas", minimo=0, maximo=20)

    tarifa = TarifaRenta.query.filter_by(vehiculo_id=vehiculo.id).first()
    if not tarifa:
        tarifa = TarifaRenta(vehiculo_id=vehiculo.id)
        db.session.add(tarifa)

    tarifa.precio_dia_base      = precio
    tarifa.deposito_garantia    = deposito
    tarifa.moneda               = moneda
    tarifa.kilometraje_incluido = km_inc
    tarifa.activo               = pol.parse_bool(data.get("activo"), "activo",
                                                 requerido=False, defecto=True)

    db.session.commit()
    return jsonify({
        "mensaje": "Tarifa de renta actualizada exitosamente",
        "tarifa": tarifa.to_dict(),
    })
