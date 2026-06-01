"""Sistema de reservas tipo carrito."""
import logging
from flask import Blueprint, jsonify, request
from flask_login import current_user

from sqlalchemy.orm import joinedload

from ..models import db, Vehiculo, Reserva, Cliente, Modelo, Marca
from ..decorators import login_required_api

bp  = Blueprint("reservas", __name__)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------
# POST /api/reservas
# Body: { "vehiculo_id", "notas"(opt) }
# ---------------------------------------------------------------
@bp.post("/")
@login_required_api
def crear_reserva():
    try:
        data = request.get_json(silent=True) or {}
        vid  = data.get("vehiculo_id")
        if not vid:
            return jsonify({"error": "vehiculo_id es obligatorio"}), 400

        vehiculo = db.get_or_404(Vehiculo, int(vid))
        if vehiculo.estado != "DISPONIBLE":
            return jsonify({"error": "Vehículo no disponible para reserva"}), 422

        cliente = Cliente.query.filter_by(usuario_id=current_user.id).first()
        if not cliente:
            partes  = current_user.nombre.strip().split(' ', 1)
            cliente = Cliente(
                usuario_id = current_user.id,
                nombre     = partes[0],
                apellido   = partes[1] if len(partes) > 1 else '-',
                email      = current_user.email,
            )
            db.session.add(cliente)
            db.session.flush()

        # Un cliente no puede tener dos reservas activas del mismo vehículo
        existente = Reserva.query.filter_by(
            vehiculo_id=vehiculo.id, cliente_id=cliente.id, estado="EN_PROCESO"
        ).first()
        if existente:
            return jsonify({"error": "Ya tienes una reserva activa para este vehículo"}), 409

        reserva = Reserva(
            vehiculo_id=vehiculo.id,
            cliente_id=cliente.id,
            notas=data.get("notas"),
        )
        vehiculo.estado = "RESERVADO"
        db.session.add(reserva)
        db.session.commit()

        log.info("Reserva creada: vehículo %d, cliente %d", vehiculo.id, cliente.id)
        return jsonify({"mensaje": "Reserva creada", "reserva": reserva.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("crear_reserva: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# DELETE /api/reservas/<id>   — cancelar reserva
# ---------------------------------------------------------------
@bp.delete("/<int:rid>")
@login_required_api
def cancelar_reserva(rid: int):
    try:
        reserva  = db.get_or_404(Reserva, rid)
        cliente  = Cliente.query.filter_by(usuario_id=current_user.id).first()

        # Solo el dueño de la reserva o un admin puede cancelar
        if not current_user.is_admin and (not cliente or reserva.cliente_id != cliente.id):
            return jsonify({"error": "Acceso denegado"}), 403

        if reserva.estado != "EN_PROCESO":
            return jsonify({"error": "Solo se pueden cancelar reservas EN_PROCESO"}), 422

        reserva.estado          = "CANCELADA"
        reserva.vehiculo.estado = "DISPONIBLE"
        db.session.commit()

        return jsonify({"mensaje": "Reserva cancelada"})
    except Exception as exc:
        db.session.rollback()
        log.error("cancelar_reserva %d: %s", rid, exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# GET /api/reservas/mis-reservas
# ---------------------------------------------------------------
@bp.get("/mis-reservas")
@login_required_api
def mis_reservas():
    try:
        cliente = Cliente.query.filter_by(usuario_id=current_user.id).first()
        if not cliente:
            return jsonify([])
        reservas = (
            Reserva.query
            .filter_by(cliente_id=cliente.id)
            .options(
                joinedload(Reserva.vehiculo)
                .joinedload(Vehiculo.modelo)
                .joinedload(Modelo.marca)
            )
            .order_by(Reserva.creado_en.desc())
            .all()
        )
        items = []
        for r in reservas:
            item = r.to_dict()
            if r.vehiculo and r.vehiculo.modelo:
                marca  = r.vehiculo.modelo.marca.nombre if r.vehiculo.modelo.marca else ""
                modelo = r.vehiculo.modelo.nombre
                item["vehiculo_nombre"] = f"{marca} {modelo}".strip()
            else:
                item["vehiculo_nombre"] = f"Vehículo #{r.vehiculo_id}"
            items.append(item)
        return jsonify(items)
    except Exception as exc:
        log.error("mis_reservas: %s", exc)
        return jsonify({"error": "Error interno"}), 500
