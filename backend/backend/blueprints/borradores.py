"""Importación/Exportación Excel + gestión de borradores."""
import logging
import os
import threading
from flask import Blueprint, jsonify, request, send_file, current_app
from flask_login import login_required

from ..models import db, Vehiculo, Modelo
from ..decorators import admin_required
from ..services.excel import ExcelService
from ..validators import forzar_mayusculas

bp  = Blueprint("borradores", __name__)
log = logging.getLogger(__name__)

# Estado global de progreso de importación (simple; en prod usar Redis/Celery)
_progreso: dict = {"total": 0, "procesado": 0, "errores": [], "terminado": True}
_lock = threading.Lock()


# ---------------------------------------------------------------
# POST /api/borradores/importar
# Multipart: file = archivo .xlsx
# ---------------------------------------------------------------
@bp.post("/importar")
@login_required
@admin_required
def importar_excel():
    global _progreso
    archivo = request.files.get("file")
    if not archivo or not archivo.filename.endswith(".xlsx"):
        return jsonify({"error": "Se requiere un archivo .xlsx"}), 400

    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)
    ruta = os.path.join(upload_dir, "importacion_temp.xlsx")
    archivo.save(ruta)

    with _lock:
        _progreso = {"total": 0, "procesado": 0, "errores": [], "terminado": False}

    # Procesamiento en hilo separado para no bloquear la request
    hilo = threading.Thread(target=_procesar_importacion, args=(ruta, current_app._get_current_object()))
    hilo.daemon = True
    hilo.start()

    return jsonify({"mensaje": "Importación iniciada. Consulta /progreso para el avance."}), 202


def _procesar_importacion(ruta: str, app):
    global _progreso
    with app.app_context():
        try:
            filas, errores_parse = ExcelService.leer_vehiculos(ruta)
            with _lock:
                _progreso["total"]  = len(filas)
                _progreso["errores"] = errores_parse

            for i, fila in enumerate(filas, 1):
                try:
                    modelo = Modelo.query.filter_by(nombre=fila["modelo"]).first()
                    if not modelo:
                        with _lock:
                            _progreso["errores"].append(
                                f"Fila {i}: modelo '{fila['modelo']}' no encontrado"
                            )
                        continue

                    v = Vehiculo(
                        modelo_id      = modelo.id,
                        anio           = fila["anio"],
                        vin            = fila["vin"],
                        color          = fila["color"].upper(),
                        precio         = fila["precio"],
                        kilometraje    = fila.get("kilometraje", 0),
                        combustible    = fila["combustible"].upper(),
                        transmision    = fila["transmision"].upper(),
                        descripcion    = fila.get("descripcion"),
                        estado         = "BORRADOR",
                        importado_excel = True,
                    )
                    db.session.add(v)
                    db.session.commit()
                except Exception as row_exc:
                    db.session.rollback()
                    with _lock:
                        _progreso["errores"].append(f"Fila {i}: {row_exc}")
                finally:
                    with _lock:
                        _progreso["procesado"] = i
        finally:
            with _lock:
                _progreso["terminado"] = True
            log.info("Importación Excel completada. Errores: %d", len(_progreso["errores"]))


# ---------------------------------------------------------------
# GET /api/borradores/progreso
# ---------------------------------------------------------------
@bp.get("/progreso")
@login_required
@admin_required
def progreso_importacion():
    with _lock:
        return jsonify(dict(_progreso))


# ---------------------------------------------------------------
# GET /api/borradores/exportar
# Exporta todos los vehículos a .xlsx
# ---------------------------------------------------------------
@bp.get("/exportar")
@login_required
@admin_required
def exportar_excel():
    try:
        vehiculos = Vehiculo.query.order_by(Vehiculo.creado_en.desc()).all()
        ruta = ExcelService.exportar_vehiculos(vehiculos)
        return send_file(ruta, as_attachment=True, download_name="inventario.xlsx")
    except Exception as exc:
        log.error("exportar_excel: %s", exc)
        return jsonify({"error": "Error al generar Excel"}), 500


# ---------------------------------------------------------------
# PATCH /api/borradores/<id>/aprobar   — BORRADOR/PENDIENTE → DISPONIBLE
# ---------------------------------------------------------------
@bp.patch("/<int:vid>/aprobar")
@login_required
@admin_required
def aprobar_borrador(vid: int):
    try:
        v = db.get_or_404(Vehiculo, vid)
        if v.estado not in ("BORRADOR", "PENDIENTE_VALIDACION"):
            return jsonify({"error": "Solo se pueden aprobar BORRADORES o PENDIENTE_VALIDACION"}), 422

        from datetime import datetime
        v.estado       = "DISPONIBLE"
        v.publicado_en = datetime.utcnow()
        db.session.commit()
        return jsonify({"mensaje": "Vehículo publicado", "estado": v.estado})
    except Exception as exc:
        db.session.rollback()
        log.error("aprobar_borrador %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# PATCH /api/borradores/<id>/pendiente  — marcar como PENDIENTE_VALIDACION
# ---------------------------------------------------------------
@bp.patch("/<int:vid>/pendiente")
@login_required
@admin_required
def marcar_pendiente(vid: int):
    try:
        v = db.get_or_404(Vehiculo, vid)
        if v.estado != "BORRADOR":
            return jsonify({"error": "Solo BORRADORES pueden marcarse como pendientes"}), 422
        v.estado = "PENDIENTE_VALIDACION"
        db.session.commit()
        return jsonify({"mensaje": "Marcado como PENDIENTE_VALIDACION"})
    except Exception as exc:
        db.session.rollback()
        log.error("marcar_pendiente %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/borradores/crear   — crear vehículo como borrador
# Body: { modelo_id, anio, vin, color, precio, kilometraje,
#         combustible, transmision, descripcion(opt) }
# ---------------------------------------------------------------
@bp.post("/crear")
@login_required
@admin_required
def crear_borrador():
    try:
        data = request.get_json(silent=True) or {}
        forzar_mayusculas(data, ["color", "combustible", "transmision"])

        campos_req = ["modelo_id", "anio", "vin", "color", "precio", "combustible", "transmision"]
        for campo in campos_req:
            if not data.get(campo):
                return jsonify({"error": f"{campo} es obligatorio"}), 400

        modelo = db.session.get(Modelo, int(data["modelo_id"]))
        if not modelo:
            return jsonify({"error": "Modelo no encontrado"}), 404

        vin = data["vin"].strip().upper()
        if len(vin) != 17:
            return jsonify({"error": "El VIN debe tener exactamente 17 caracteres"}), 422
        if Vehiculo.query.filter_by(vin=vin).first():
            return jsonify({"error": f"El VIN {vin} ya está registrado en el sistema"}), 409

        v = Vehiculo(
            modelo_id   = modelo.id,
            anio        = int(data["anio"]),
            vin         = vin,
            color       = data["color"],
            precio      = float(data["precio"]),
            kilometraje = int(data.get("kilometraje", 0)),
            combustible = data["combustible"],
            transmision = data["transmision"],
            descripcion = data.get("descripcion"),
            estado      = "BORRADOR",
        )
        db.session.add(v)
        db.session.commit()
        log.info("Borrador creado: vehículo %d", v.id)
        return jsonify({"mensaje": "Borrador creado", "vehiculo": v.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("crear_borrador: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# PUT /api/borradores/<id>  — actualizar borrador
# ---------------------------------------------------------------
@bp.put("/<int:vid>")
@login_required
@admin_required
def actualizar_borrador(vid: int):
    try:
        data = request.get_json(silent=True) or {}
        forzar_mayusculas(data, ["color", "combustible", "transmision"])

        v = db.get_or_404(Vehiculo, vid)
        if v.estado not in ("BORRADOR", "PENDIENTE_VALIDACION"):
            return jsonify({"error": "Solo se pueden editar BORRADORES o PENDIENTE_VALIDACION"}), 422

        CAMPOS = {"anio", "vin", "color", "precio", "kilometraje",
                  "combustible", "transmision", "descripcion", "modelo_id"}
        for campo in CAMPOS:
            if campo in data:
                setattr(v, campo, data[campo])

        db.session.commit()
        return jsonify({"mensaje": "Borrador actualizado", "vehiculo": v.to_dict()})
    except Exception as exc:
        db.session.rollback()
        log.error("actualizar_borrador %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# DELETE /api/borradores/<id>  — eliminar borrador
# ---------------------------------------------------------------
@bp.delete("/<int:vid>")
@login_required
@admin_required
def eliminar_borrador(vid: int):
    try:
        v = db.get_or_404(Vehiculo, vid)
        if v.estado not in ("BORRADOR", "PENDIENTE_VALIDACION"):
            return jsonify({"error": "Solo se pueden eliminar BORRADORES o PENDIENTE_VALIDACION"}), 422
        db.session.delete(v)
        db.session.commit()
        log.info("Borrador eliminado: vehículo %d", vid)
        return jsonify({"mensaje": "Borrador eliminado"})
    except Exception as exc:
        db.session.rollback()
        log.error("eliminar_borrador %d: %s", vid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/borradores/plantilla  — descargar plantilla Excel vacía
# ---------------------------------------------------------------
@bp.get("/plantilla")
@login_required
@admin_required
def descargar_plantilla():
    try:
        ruta = ExcelService.generar_plantilla()
        return send_file(ruta, as_attachment=True, download_name="plantilla_vehiculos.xlsx")
    except Exception as exc:
        log.error("descargar_plantilla: %s", exc)
        return jsonify({"error": "Error al generar plantilla"}), 500
