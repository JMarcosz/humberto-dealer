"""Catálogo público de vehículos: listado, filtros, jerarquía Marca → Modelo → Vehículo."""
import logging
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import and_

from ..models import db, Marca, Modelo, Vehiculo, Resena
from ..decorators import login_required_api

bp = Blueprint("catalog", __name__)
log = logging.getLogger(__name__)

ESTADOS_PUBLICOS = ("DISPONIBLE", "RESERVADO")


# ---------------------------------------------------------------
# GET /api/catalogo/marcas
# ---------------------------------------------------------------
@bp.get("/marcas")
def listar_marcas():
    try:
        marcas = Marca.query.order_by(Marca.nombre).all()
        return jsonify([m.to_dict() for m in marcas])
    except Exception as exc:
        log.error("listar_marcas: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/catalogo/marcas/<marca_id>/modelos
# ---------------------------------------------------------------
@bp.get("/marcas/<int:marca_id>/modelos")
def listar_modelos_por_marca(marca_id: int):
    try:
        marca = db.get_or_404(Marca, marca_id)
        modelos = Modelo.query.filter_by(marca_id=marca.id).order_by(Modelo.nombre).all()
        return jsonify([m.to_dict() for m in modelos])
    except Exception as exc:
        log.error("listar_modelos_por_marca: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/catalogo/vehiculos
# Query params: marca_id, modelo_id, anio, combustible, transmision,
#               precio_min, precio_max, estado, page, per_page
# ---------------------------------------------------------------
@bp.get("/vehiculos")
def listar_vehiculos():
    try:
        page     = request.args.get("page",     1,  type=int)
        per_page = request.args.get("per_page", 20, type=int)

        filtros = [Vehiculo.estado.in_(ESTADOS_PUBLICOS)]

        if (marca_id := request.args.get("marca_id", type=int)):
            filtros.append(Vehiculo.modelo.has(marca_id=marca_id))
        if (modelo_id := request.args.get("modelo_id", type=int)):
            filtros.append(Vehiculo.modelo_id == modelo_id)
        if (anio := request.args.get("anio", type=int)):
            filtros.append(Vehiculo.anio == anio)
        if (combustible := request.args.get("combustible")):
            filtros.append(Vehiculo.combustible == combustible.upper())
        if (transmision := request.args.get("transmision")):
            filtros.append(Vehiculo.transmision == transmision.upper())
        if (precio_min := request.args.get("precio_min", type=float)):
            filtros.append(Vehiculo.precio >= precio_min)
        if (precio_max := request.args.get("precio_max", type=float)):
            filtros.append(Vehiculo.precio <= precio_max)

        paginado = (
            Vehiculo.query
            .filter(and_(*filtros))
            .order_by(Vehiculo.publicado_en.desc())
            .paginate(page=page, per_page=min(per_page, 100), error_out=False)
        )

        return jsonify({
            "total":   paginado.total,
            "page":    paginado.page,
            "pages":   paginado.pages,
            "items":   [v.to_dict(include_imagenes=True) for v in paginado.items],
        })
    except Exception as exc:
        log.error("listar_vehiculos: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/catalogo/vehiculos/<id>   — ficha individual
# ---------------------------------------------------------------
@bp.get("/vehiculos/<int:vehiculo_id>")
def ficha_vehiculo(vehiculo_id: int):
    try:
        v = db.get_or_404(Vehiculo, vehiculo_id)
        if v.estado not in ESTADOS_PUBLICOS:
            return jsonify({"error": "Vehículo no disponible"}), 404
        return jsonify(v.to_dict(include_imagenes=True))
    except Exception as exc:
        log.error("ficha_vehiculo %d: %s", vehiculo_id, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/catalogo/vehiculos/<id>/resenas
# ---------------------------------------------------------------
@bp.get("/vehiculos/<int:vehiculo_id>/resenas")
def listar_resenas(vehiculo_id: int):
    try:
        resenas = (
            Resena.query
            .filter_by(vehiculo_id=vehiculo_id)
            .order_by(Resena.creado_en.desc())
            .all()
        )
        items = []
        for r in resenas:
            item = r.to_dict()
            item["calificacion"]   = r.estrellas
            item["usuario_nombre"] = r.usuario.nombre if r.usuario else "Usuario"
            items.append(item)
        return jsonify(items)
    except Exception as exc:
        log.error("listar_resenas %d: %s", vehiculo_id, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/catalogo/vehiculos/<id>/resenas  (requiere sesión)
# Body: { "calificacion": 1-5, "comentario": "..." }
# ---------------------------------------------------------------
@bp.post("/vehiculos/<int:vehiculo_id>/resenas")
@login_required_api
def crear_resena(vehiculo_id: int):
    try:
        data         = request.get_json(silent=True) or {}
        calificacion = data.get("calificacion")
        comentario   = data.get("comentario", "").strip()

        if not calificacion or not (1 <= int(calificacion) <= 5):
            return jsonify({"error": "Calificación debe ser entre 1 y 5"}), 400

        resena = Resena(
            usuario_id  = current_user.id,
            vehiculo_id = vehiculo_id,
            estrellas   = int(calificacion),
            comentario  = comentario or None,
        )
        db.session.add(resena)
        db.session.commit()

        item = resena.to_dict()
        item["calificacion"]   = resena.estrellas
        item["usuario_nombre"] = current_user.nombre
        return jsonify({"mensaje": "Reseña publicada", "resena": item}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("crear_resena %d: %s", vehiculo_id, exc)
        return jsonify({"error": "Error interno"}), 500
