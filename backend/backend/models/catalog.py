"""Modelos de catálogo: Marca → Modelo → Vehículo + imágenes."""
import enum
from datetime import datetime
from .base import db
from sqlalchemy.dialects import mysql


class EstadoVehiculo(str, enum.Enum):
    DISPONIBLE            = "DISPONIBLE"
    RESERVADO             = "RESERVADO"
    VENDIDO               = "VENDIDO"
    BORRADOR              = "BORRADOR"
    PENDIENTE_VALIDACION  = "PENDIENTE_VALIDACION"


class Marca(db.Model):
    __tablename__ = "marcas"

    id          = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre      = db.Column(db.String(80), nullable=False, unique=True)
    pais_origen = db.Column(db.String(80))
    logo_url    = db.Column(db.String(500))

    modelos = db.relationship("Modelo", back_populates="marca", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "pais_origen": self.pais_origen,
            "logo_url": self.logo_url,
        }


class Modelo(db.Model):
    __tablename__ = "modelos"

    id        = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre    = db.Column(db.String(100), nullable=False)
    marca_id  = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("marcas.id"), nullable=False)
    categoria = db.Column(
        db.Enum("SEDAN", "SUV", "COUPE", "CONVERTIBLE", "PICKUP", "VAN", "OTRO"),
        nullable=False,
        default="OTRO",
    )

    marca     = db.relationship("Marca", back_populates="modelos")
    vehiculos = db.relationship("Vehiculo", back_populates="modelo", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "marca": self.marca.to_dict() if self.marca else None,
            "categoria": self.categoria,
        }


class Vehiculo(db.Model):
    __tablename__ = "vehiculos"
    __table_args__ = (
        db.Index("ix_vehiculos_estado",        "estado"),
        db.Index("ix_vehiculos_publicado_en",  "publicado_en"),
        db.Index("ix_vehiculos_creado_en",     "creado_en"),
        db.Index("ix_vehiculos_anio",          "anio"),
        db.Index("ix_vehiculos_precio",        "precio"),
        db.Index("ix_vehiculos_kilometraje",   "kilometraje"),
        db.Index("ix_vehiculos_estado_pub",    "estado", "publicado_en"),
    )

    id               = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    modelo_id        = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("modelos.id"), nullable=False)
    anio             = db.Column(db.SmallInteger, nullable=False)
    vin              = db.Column(db.String(17), nullable=False, unique=True)
    color            = db.Column(db.String(50), nullable=False)
    precio           = db.Column(db.Numeric(12, 2), nullable=False)
    kilometraje      = db.Column(db.Integer, nullable=False, default=0)
    combustible      = db.Column(
        db.Enum("GASOLINA", "DIESEL", "HIBRIDO", "ELECTRICO", "GAS"), nullable=False
    )
    transmision      = db.Column(db.Enum("AUTOMATICA", "MANUAL", "CVT"), nullable=False)
    descripcion      = db.Column(db.Text)
    estado           = db.Column(
        db.Enum(*[e.value for e in EstadoVehiculo]),
        nullable=False,
        default=EstadoVehiculo.BORRADOR.value,
    )
    disponible_para  = db.Column(
        db.Enum("VENTA", "RENTA", "AMBOS"),
        nullable=False,
        default="AMBOS",
    )
    pasajeros        = db.Column(db.SmallInteger, nullable=False, default=5)
    maletas_grandes  = db.Column(db.SmallInteger, nullable=False, default=2)
    maletas_pequenas = db.Column(db.SmallInteger, nullable=False, default=2)
    tiene_aire_acondicionado = db.Column(db.Boolean, nullable=False, default=True)
    importado_excel  = db.Column(db.Boolean, nullable=False, default=False)
    publicado_en     = db.Column(db.DateTime)
    creado_en        = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    actualizado_en   = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    modelo   = db.relationship("Modelo", back_populates="vehiculos")
    imagenes = db.relationship(
        "VehiculoImagen", back_populates="vehiculo", cascade="all, delete-orphan", lazy="select"
    )
    reservas = db.relationship("Reserva", back_populates="vehiculo", lazy="dynamic")
    tarifa_renta = db.relationship("TarifaRenta", back_populates="vehiculo", uselist=False, cascade="all, delete-orphan")
    reservas_renta = db.relationship("ReservaRenta", back_populates="vehiculo", lazy="dynamic")

    def to_dict(self, include_imagenes: bool = True) -> dict:
        data = {
            "id": self.id,
            "modelo": self.modelo.to_dict() if self.modelo else None,
            "anio": self.anio,
            "vin": self.vin,
            "color": self.color,
            "precio": float(self.precio),
            "kilometraje": self.kilometraje,
            "combustible": self.combustible,
            "transmision": self.transmision,
            "descripcion": self.descripcion,
            "estado": self.estado,
            "disponible_para": self.disponible_para,
            "pasajeros": self.pasajeros,
            "maletas_grandes": self.maletas_grandes,
            "maletas_pequenas": self.maletas_pequenas,
            "tiene_aire_acondicionado": self.tiene_aire_acondicionado,
            "publicado_en": self.publicado_en.isoformat() if self.publicado_en else None,
        }
        if self.tarifa_renta and self.tarifa_renta.activo:
            data["tarifa_renta"] = self.tarifa_renta.to_dict()
        if include_imagenes:
            data["imagenes"] = [img.to_dict() for img in self.imagenes]
        return data

    def to_dict_summary(self) -> dict:
        """Versión ligera para listados — omite descripcion y campos pesados."""
        modelo = self.modelo
        marca  = modelo.marca if modelo else None
        data = {
            "id": self.id,
            "modelo": {
                "id":       modelo.id      if modelo else None,
                "nombre":   modelo.nombre  if modelo else None,
                "categoria": modelo.categoria if modelo else None,
                "marca": {
                    "id":     marca.id     if marca else None,
                    "nombre": marca.nombre if marca else None,
                } if marca else None,
            },
            "anio":        self.anio,
            "vin":         self.vin,
            "color":       self.color,
            "precio":      float(self.precio),
            "kilometraje": self.kilometraje,
            "combustible": self.combustible,
            "transmision": self.transmision,
            "estado":      self.estado,
            "disponible_para": self.disponible_para,
            "pasajeros":   self.pasajeros,
            "maletas_grandes": self.maletas_grandes,
            "maletas_pequenas": self.maletas_pequenas,
            "tiene_aire_acondicionado": self.tiene_aire_acondicionado,
            "publicado_en": self.publicado_en.isoformat() if self.publicado_en else None,
            "imagenes":    [img.to_dict() for img in self.imagenes],
        }
        if self.tarifa_renta and self.tarifa_renta.activo:
            data["tarifa_renta"] = self.tarifa_renta.to_dict()
        return data


class VehiculoImagen(db.Model):
    __tablename__ = "vehiculo_imagenes"

    id          = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    vehiculo_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"), nullable=False)
    url         = db.Column(db.String(500), nullable=False)
    es_principal = db.Column(db.Boolean, nullable=False, default=False)
    orden       = db.Column(db.SmallInteger, nullable=False, default=0)

    vehiculo = db.relationship("Vehiculo", back_populates="imagenes")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "es_principal": self.es_principal,
            "orden": self.orden,
        }
