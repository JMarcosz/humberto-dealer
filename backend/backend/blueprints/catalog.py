"""Catálogo público de vehículos: listado, filtros, jerarquía Marca → Modelo → Vehículo."""
import logging
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import and_
from sqlalchemy.orm import joinedload, selectinload

from ..models import db, Marca, Modelo, Vehiculo, Resena, ResenaLike
from ..decorators import login_required_api
from backend import cache

bp = Blueprint("catalog", __name__)
log = logging.getLogger(__name__)

ESTADOS_PUBLICOS = ("DISPONIBLE", "RESERVADO")


# ---------------------------------------------------------------
# GET /api/catalogo/marcas
# ---------------------------------------------------------------
@bp.get("/marcas")
@cache.cached(timeout=300)
def listar_marcas():
    try:
        marcas = (
            Marca.query
            .join(Modelo, Modelo.marca_id == Marca.id)
            .join(Vehiculo, Vehiculo.modelo_id == Modelo.id)
            .filter(Vehiculo.estado.in_(ESTADOS_PUBLICOS))
            .distinct()
            .order_by(Marca.nombre)
            .all()
        )
        return jsonify([m.to_dict() for m in marcas])
    except Exception as exc:
        log.error("listar_marcas: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/catalogo/marcas/<marca_id>/modelos
# ---------------------------------------------------------------
@bp.get("/marcas/<int:marca_id>/modelos")
@cache.cached(timeout=300, query_string=True)
def listar_modelos_por_marca(marca_id: int):
    try:
        marca = db.get_or_404(Marca, marca_id)
        modelos = (
            Modelo.query
            .filter_by(marca_id=marca.id)
            .options(joinedload(Modelo.marca))
            .order_by(Modelo.nombre)
            .all()
        )
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
        if (tipo := request.args.get("tipo")):
            filtros.append(Vehiculo.modelo.has(Modelo.categoria == tipo.upper()))
        if (km_max := request.args.get("kilometraje_max", type=int)):
            filtros.append(Vehiculo.kilometraje <= km_max)

        busqueda = request.args.get("busqueda", "").strip()
        q = (
            Vehiculo.query
            .join(Modelo)
            .join(Marca)
            .options(
                joinedload(Vehiculo.modelo).joinedload(Modelo.marca),
                selectinload(Vehiculo.imagenes),
            )
            .filter(and_(*filtros))
        )
        if busqueda:
            like = f"%{busqueda}%"
            q = q.filter(db.or_(Marca.nombre.ilike(like), Modelo.nombre.ilike(like)))

        paginado = (
            q
            .order_by(Vehiculo.publicado_en.desc())
            .paginate(page=page, per_page=min(per_page, 200), error_out=False)
        )

        return jsonify({
            "total":   paginado.total,
            "page":    paginado.page,
            "pages":   paginado.pages,
            "items":   [v.to_dict_summary() for v in paginado.items],
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
            .options(joinedload(Resena.usuario), selectinload(Resena.likes))
            .order_by(Resena.creado_en.desc())
            .all()
        )
        usuario_id = current_user.id if current_user.is_authenticated else None

        # Una sola query para saber qué reseñas le gustaron al usuario
        if usuario_id and resenas:
            liked_ids = {
                lk.resena_id for lk in ResenaLike.query.filter(
                    ResenaLike.resena_id.in_([r.id for r in resenas]),
                    ResenaLike.usuario_id == usuario_id,
                ).all()
            }
        else:
            liked_ids = set()

        items = []
        for r in resenas:
            item = r.to_dict()
            item["calificacion"]   = r.estrellas
            item["usuario_nombre"] = r.usuario.nombre if r.usuario else "Usuario"
            item["liked_by_me"]    = r.id in liked_ids
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
        item["liked_by_me"]    = False
        return jsonify({"mensaje": "Reseña publicada", "resena": item}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("crear_resena %d: %s", vehiculo_id, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/catalogo/vehiculos/<vid>/resenas/<rid>/like  (toggle)
# ---------------------------------------------------------------
@bp.post("/vehiculos/<int:vehiculo_id>/resenas/<int:resena_id>/like")
@login_required_api
def toggle_like_resena(vehiculo_id: int, resena_id: int):
    try:
        resena = db.session.get(Resena, resena_id)
        if not resena or resena.vehiculo_id != vehiculo_id:
            return jsonify({"error": "Reseña no encontrada"}), 404

        like = ResenaLike.query.filter_by(
            resena_id=resena_id, usuario_id=current_user.id
        ).first()

        if like:
            db.session.delete(like)
            liked = False
        else:
            db.session.add(ResenaLike(resena_id=resena_id, usuario_id=current_user.id))
            liked = True

        db.session.commit()
        likes_count = ResenaLike.query.filter_by(resena_id=resena_id).count()
        return jsonify({"liked": liked, "likes_count": likes_count})
    except Exception as exc:
        db.session.rollback()
        log.error("toggle_like_resena %d: %s", resena_id, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# DELETE /api/catalogo/resenas/<id>  (solo el autor o admin)
# ---------------------------------------------------------------
@bp.delete("/resenas/<int:resena_id>")
@login_required_api
def eliminar_resena(resena_id: int):
    try:
        resena = db.session.get(Resena, resena_id)
        if not resena:
            return jsonify({"error": "Reseña no encontrada"}), 404

        es_autor = resena.usuario_id == current_user.id
        es_admin = current_user.rol and current_user.rol.nombre == "ADMIN"
        if not es_autor and not es_admin:
            return jsonify({"error": "Sin permiso"}), 403

        db.session.delete(resena)
        db.session.commit()
        return jsonify({"mensaje": "Reseña eliminada"})
    except Exception as exc:
        db.session.rollback()
        log.error("eliminar_resena %d: %s", resena_id, exc)
        return jsonify({"error": "Error interno"}), 500
