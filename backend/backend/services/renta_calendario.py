"""Consultas de calendario y carga validada de entidades de Renta.

Complemento de `renta_politica.py`: aquí vive todo lo que necesita tocar la
base de datos. Cada función devuelve entidades ya validadas contra la política
o lanza `ReglaNegocioError`, de modo que los blueprints queden como una
secuencia lineal de llamadas sin un solo `try`.
"""
import logging
from datetime import datetime, timedelta

from ..errors import ReglaNegocioError
from ..models import (
    db, Vehiculo, Modelo, Marca, Sucursal, TarifaRenta,
    CoberturaSeguro, ExtraServicio, ReservaRenta,
)
from . import renta_politica as pol

log = logging.getLogger(__name__)

# Un vehículo puede reservarse para renta estando alquilado hoy: la colisión de
# calendario decide la ventana concreta. Exigir DISPONIBLE rompería toda
# reserva anticipada en cuanto el auto saliera a la calle.
ESTADOS_VEHICULO_RENTABLE = ("DISPONIBLE", "RENTADO")


# ---------------------------------------------------------------------------
# Calendario
# ---------------------------------------------------------------------------

def vehiculos_ocupados_subquery(f_inicio: datetime, f_fin: datetime):
    """Subconsulta de vehículos con reserva solapada en la ventana pedida."""
    return (
        db.session.query(ReservaRenta.vehiculo_id)
        .filter(
            ReservaRenta.estado.in_(pol.ESTADOS_BLOQUEAN_CALENDARIO),
            ReservaRenta.fecha_inicio < f_fin,
            ReservaRenta.fecha_fin    > f_inicio,
        )
        .scalar_subquery()
    )


def buscar_colision(vehiculo_id: int, f_inicio: datetime, f_fin: datetime,
                    *, excluir_id: int | None = None):
    q = ReservaRenta.query.filter(
        ReservaRenta.vehiculo_id == vehiculo_id,
        ReservaRenta.estado.in_(pol.ESTADOS_BLOQUEAN_CALENDARIO),
        ReservaRenta.fecha_inicio < f_fin,
        ReservaRenta.fecha_fin    > f_inicio,
    )
    if excluir_id:
        q = q.filter(ReservaRenta.id != excluir_id)
    return q.first()


def tiene_rentas_futuras(vehiculo_id: int, *, ahora: datetime | None = None):
    """Reserva de renta viva que aún no ha terminado.

    Es la guardia que impide vender un auto comprometido: una venta es un
    evento terminal, así que mira todo el futuro, no solo una ventana.
    """
    ahora = ahora or datetime.utcnow()
    return (
        ReservaRenta.query
        .filter(
            ReservaRenta.vehiculo_id == vehiculo_id,
            ReservaRenta.estado.in_(pol.ESTADOS_BLOQUEAN_CALENDARIO),
            ReservaRenta.fecha_fin > ahora,
        )
        .order_by(ReservaRenta.fecha_inicio.asc())
        .first()
    )


def expirar_reservas_vencidas(*, ahora: datetime | None = None,
                              commit: bool = True) -> int:
    """Libera el calendario de reservas que nunca se retiraron.

    Sin esto una CONFIRMADA vencida bloquea la unidad para siempre. Se invoca
    de forma perezosa al consultar disponibilidad, que es justo donde una
    reserva fantasma hace daño.
    """
    ahora  = ahora or datetime.utcnow()
    limite = ahora - timedelta(hours=pol.NO_SHOW_GRACIA_HORAS)

    vencidas = ReservaRenta.query.filter(
        ReservaRenta.estado == "CONFIRMADA",
        ReservaRenta.fecha_inicio < limite,
    ).all()

    for reserva in vencidas:
        reserva.estado             = "NO_SHOW"
        reserva.cancelada_en       = ahora
        reserva.cancelado_por      = "SISTEMA"
        reserva.cancelacion_motivo = (
            f"No-show automático: el vehículo no fue retirado dentro de las "
            f"{pol.NO_SHOW_GRACIA_HORAS} horas posteriores a la recogida pactada."
        )

    if vencidas and commit:
        db.session.commit()
        log.info("Expiradas %d reservas de renta por no-show", len(vencidas))
    return len(vencidas)


# ---------------------------------------------------------------------------
# Carga validada de entidades
# ---------------------------------------------------------------------------

def cargar_vehiculo_rentable(vehiculo_id: int, *, bloquear: bool = True) -> Vehiculo:
    """Vehículo habilitado para renta, con tarifa activa.

    Con `bloquear=True` toma un bloqueo pesimista de la fila para que dos
    checkouts simultáneos sobre la misma unidad se serialicen.
    """
    q = Vehiculo.query.filter_by(id=vehiculo_id)
    if bloquear:
        q = q.with_for_update()
    vehiculo = q.first()

    if not vehiculo:
        raise ReglaNegocioError("Vehículo no encontrado.", 404, "VEHICULO_NO_ENCONTRADO")

    if vehiculo.disponible_para not in ("RENTA", "AMBOS"):
        raise ReglaNegocioError(
            "Este vehículo no está habilitado para renta.", 422, "VEHICULO_NO_RENTABLE")

    if vehiculo.estado not in ESTADOS_VEHICULO_RENTABLE:
        raise ReglaNegocioError(
            "El vehículo no está disponible para renta en este momento.",
            422, "VEHICULO_ESTADO_INVALIDO", {"estado": vehiculo.estado})

    if not vehiculo.tarifa_renta or not vehiculo.tarifa_renta.activo:
        raise ReglaNegocioError(
            "El vehículo no tiene una tarifa de renta configurada.",
            422, "SIN_TARIFA")

    return vehiculo


def validar_sucursales(recogida_id: int, devolucion_id: int):
    """Ambas sucursales deben existir Y estar activas."""
    recogida   = db.session.get(Sucursal, recogida_id)
    devolucion = db.session.get(Sucursal, devolucion_id)

    for suc, etiqueta in ((recogida, "recogida"), (devolucion, "devolución")):
        if not suc:
            raise ReglaNegocioError(
                f"La sucursal de {etiqueta} no existe.", 404, "SUCURSAL_NO_ENCONTRADA")
        if not suc.activo:
            raise ReglaNegocioError(
                f"La sucursal de {etiqueta} no está operativa actualmente.",
                422, "SUCURSAL_INACTIVA", {"sucursal_id": suc.id})
    return recogida, devolucion


def cargar_cobertura(cobertura_id: int) -> CoberturaSeguro:
    cobertura = db.session.get(CoberturaSeguro, cobertura_id)
    if not cobertura or not cobertura.activo:
        raise ReglaNegocioError(
            "La cobertura de seguro seleccionada no está disponible.",
            422, "COBERTURA_NO_DISPONIBLE")
    return cobertura


def resolver_extras(pares) -> list:
    """Convierte pares (id, cantidad) en dicts listos para `calcular_totales`.

    A diferencia del comportamiento anterior, un extra inexistente o inactivo
    produce un rechazo explícito: ignorarlo en silencio hacía que el cliente
    pagara un total que no incluía lo que creyó comprar.
    """
    resueltos = []
    for extra_id, cantidad in pares:
        extra = db.session.get(ExtraServicio, extra_id)
        if not extra or not extra.activo:
            raise ReglaNegocioError(
                f"El servicio adicional #{extra_id} no está disponible.",
                422, "EXTRA_NO_DISPONIBLE", {"extra_id": extra_id})
        resueltos.append({
            "extra_id":      extra.id,
            "nombre":        extra.nombre,
            "cantidad":      cantidad,
            "costo_dia":     extra.costo_dia,
            "es_pago_unico": extra.es_pago_unico,
        })
    return resueltos


def contar_reservas_activas(documento: str, email: str, *,
                            ahora: datetime | None = None) -> int:
    """Reservas vivas del mismo conductor.

    Es el control anti-abuso que de verdad importa: a diferencia del límite por
    IP, es inmune al NAT compartido de un hotel o un aeropuerto.
    """
    ahora = ahora or datetime.utcnow()
    return (
        ReservaRenta.query
        .filter(
            ReservaRenta.estado.in_(pol.ESTADOS_BLOQUEAN_CALENDARIO),
            ReservaRenta.fecha_fin > ahora,
            db.or_(
                ReservaRenta.conductor_documento == documento,
                ReservaRenta.conductor_email     == email,
            ),
        )
        .count()
    )


def obtener_reserva(*, pnr: str | None = None, reserva_id: int | None = None,
                    bloquear: bool = False) -> ReservaRenta:
    if not pnr and not reserva_id:
        raise ReglaNegocioError(
            "Se requiere el código PNR o el identificador de la reserva.",
            400, "IDENTIFICADOR_REQUERIDO")

    q = ReservaRenta.query
    if reserva_id:
        q = q.filter(ReservaRenta.id == reserva_id)
    else:
        q = q.filter(ReservaRenta.pnr == pnr.strip().upper())
    if bloquear:
        q = q.with_for_update()

    reserva = q.first()
    if not reserva:
        raise ReglaNegocioError(
            "No existe ninguna reserva con los datos proporcionados.",
            404, "RESERVA_NO_ENCONTRADA")
    return reserva
