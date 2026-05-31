"""Modelos transaccionales: Reservas, Citas, Ventas, Pagos, Reseñas."""
from datetime import datetime
from .base import db
from sqlalchemy.dialects import mysql


class Reserva(db.Model):
    __tablename__ = "reservas"

    id             = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    vehiculo_id    = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"), nullable=False)
    cliente_id     = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("clientes.id"), nullable=False)
    estado         = db.Column(
        db.Enum("EN_PROCESO", "CONFIRMADA", "CANCELADA"), nullable=False, default="EN_PROCESO"
    )
    notas          = db.Column(db.Text)
    creado_en      = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    actualizado_en = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    vehiculo = db.relationship("Vehiculo", back_populates="reservas")
    cliente  = db.relationship("Cliente", back_populates="reservas")
    venta    = db.relationship("Venta", back_populates="reserva", uselist=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "vehiculo_id": self.vehiculo_id,
            "cliente_id": self.cliente_id,
            "estado": self.estado,
            "notas": self.notas,
            "creado_en": self.creado_en.isoformat(),
        }


class TipoCita(db.Model):
    __tablename__ = "tipos_cita"

    id     = db.Column(mysql.SMALLINT(unsigned=True), primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(80), nullable=False, unique=True)

    citas = db.relationship("Cita", back_populates="tipo_cita", lazy="dynamic")

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre}


class Cita(db.Model):
    __tablename__ = "citas"

    id           = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    cliente_id   = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("clientes.id"), nullable=False)
    vehiculo_id  = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"))
    tipo_cita_id = db.Column(mysql.SMALLINT(unsigned=True), db.ForeignKey("tipos_cita.id"), nullable=False)
    empleado_id  = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("empleados.id"))
    fecha_hora   = db.Column(db.DateTime, nullable=False)
    estado       = db.Column(
        db.Enum("PENDIENTE", "CONFIRMADA", "COMPLETADA", "CANCELADA"),
        nullable=False,
        default="PENDIENTE",
    )
    notas      = db.Column(db.Text)
    creado_en  = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    cliente   = db.relationship("Cliente")
    tipo_cita = db.relationship("TipoCita", back_populates="citas")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "vehiculo_id": self.vehiculo_id,
            "tipo_cita": self.tipo_cita.to_dict() if self.tipo_cita else None,
            "fecha_hora": self.fecha_hora.isoformat(),
            "estado": self.estado,
        }


class Venta(db.Model):
    __tablename__ = "ventas"

    id              = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    vehiculo_id     = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"), nullable=False)
    cliente_id      = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("clientes.id"), nullable=False)
    empleado_id     = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("empleados.id"))
    reserva_id      = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("reservas.id"), unique=True)
    precio_final    = db.Column(db.Numeric(12, 2), nullable=False)
    fecha_hora      = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ubicacion_lat   = db.Column(db.Numeric(10, 7))
    ubicacion_lng   = db.Column(db.Numeric(10, 7))
    ubicacion_desc  = db.Column(db.String(300))
    notas           = db.Column(db.Text)

    vehiculo = db.relationship("Vehiculo")
    cliente  = db.relationship("Cliente", back_populates="ventas")
    reserva  = db.relationship("Reserva", back_populates="venta")
    pagos    = db.relationship("Pago", back_populates="venta", lazy="select")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "vehiculo_id": self.vehiculo_id,
            "cliente_id": self.cliente_id,
            "precio_final": float(self.precio_final),
            "fecha_hora": self.fecha_hora.isoformat(),
            "ubicacion_lat": float(self.ubicacion_lat) if self.ubicacion_lat else None,
            "ubicacion_lng": float(self.ubicacion_lng) if self.ubicacion_lng else None,
            "ubicacion_desc": self.ubicacion_desc,
        }


class Pago(db.Model):
    __tablename__ = "pagos"

    id         = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    venta_id   = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("ventas.id"), nullable=False)
    metodo     = db.Column(
        db.Enum("EFECTIVO", "TRANSFERENCIA", "TARJETA", "FINANCIAMIENTO", "OTRO"), nullable=False
    )
    monto      = db.Column(db.Numeric(12, 2), nullable=False)
    referencia = db.Column(db.String(100))
    fecha_hora = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    venta = db.relationship("Venta", back_populates="pagos")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "venta_id": self.venta_id,
            "metodo": self.metodo,
            "monto": float(self.monto),
            "referencia": self.referencia,
            "fecha_hora": self.fecha_hora.isoformat(),
        }


class Resena(db.Model):
    __tablename__ = "resenas"

    id              = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    usuario_id      = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("usuarios.id"), nullable=False)
    vehiculo_id     = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"))
    estrellas       = db.Column(db.SmallInteger, nullable=False)
    comentario      = db.Column(db.Text)
    google_verified = db.Column(db.Boolean, nullable=False, default=False)
    creado_en       = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    usuario = db.relationship("Usuario")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "usuario_id": self.usuario_id,
            "vehiculo_id": self.vehiculo_id,
            "estrellas": self.estrellas,
            "comentario": self.comentario,
            "google_verified": self.google_verified,
            "creado_en": self.creado_en.isoformat(),
        }
