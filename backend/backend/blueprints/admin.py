"""Panel admin: gestión de estados, histórico de ventas, validación de fichas."""
import logging
import os
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

from ..models import db, Vehiculo, Venta, Reserva, Cliente, Pago, VehiculoImagen, Marca, Modelo
from ..decorators import admin_required
from ..validators import forzar_mayusculas, validar_mayusculas

ALLOWED_EXT = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

def _ext_valida(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

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

        q = Vehiculo.query.join(Modelo).join(Marca)

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
            page=page, per_page=min(per_page, 500), error_out=False
        )
        return jsonify({
            "total": paginado.total,
            "page":  paginado.page,
            "pages": paginado.pages,
            "items": [v.to_dict() for v in paginado.items],
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

        vehiculo = db.get_or_404(Vehiculo, int(vid))
        cliente  = db.get_or_404(Cliente, int(cid))

        if vehiculo.estado not in ("DISPONIBLE", "RESERVADO"):
            return jsonify({"error": "Vehículo no disponible para venta"}), 422

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

        q = Reserva.query
        if estado:
            q = q.filter_by(estado=estado.upper())
        paginado = q.order_by(Reserva.creado_en.desc()).paginate(
            page=page, per_page=min(per_page, 100), error_out=False
        )

        items = []
        for r in paginado.items:
            item = r.to_dict()
            # Incluir nombre del vehículo
            if r.vehiculo and r.vehiculo.modelo:
                marca  = r.vehiculo.modelo.marca.nombre if r.vehiculo.modelo.marca else ""
                modelo = r.vehiculo.modelo.nombre
                item["vehiculo_nombre"] = f"{marca} {modelo}".strip()
            else:
                item["vehiculo_nombre"] = f"Vehículo #{r.vehiculo_id}"
            # Incluir nombre completo del cliente (nombre + apellido)
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
