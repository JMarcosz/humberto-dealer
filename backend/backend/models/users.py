"""Modelos de usuarios, roles, clientes, empleados y proveedores."""
from datetime import datetime
from flask_login import UserMixin
from .base import db
from sqlalchemy.dialects import mysql


class Rol(db.Model):
    __tablename__ = "roles"

    id     = db.Column(mysql.SMALLINT(unsigned=True), primary_key=True, autoincrement=True)
    nombre = db.Column(db.Enum("ADMIN", "USUARIO_PUBLICO"), nullable=False, unique=True)

    usuarios = db.relationship("Usuario", back_populates="rol", lazy="dynamic")

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre}


class Usuario(UserMixin, db.Model):
    __tablename__ = "usuarios"

    id            = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre        = db.Column(db.String(120), nullable=False)
    email         = db.Column(db.String(254), nullable=False, unique=True)
    password_hash = db.Column(db.String(255))
    rol_id        = db.Column(mysql.SMALLINT(unsigned=True), db.ForeignKey("roles.id"), nullable=False, default=2)
    google_id     = db.Column(db.String(128), unique=True)
    avatar_url    = db.Column(db.String(500))
    activo        = db.Column(db.Boolean, nullable=False, default=True)
    creado_en     = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    rol = db.relationship("Rol", back_populates="usuarios")

    @property
    def is_admin(self) -> bool:
        return self.rol and self.rol.nombre == "ADMIN"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "email": self.email,
            "rol": self.rol.to_dict() if self.rol else None,
            "avatar_url": self.avatar_url,
            "activo": self.activo,
        }


class Cliente(db.Model):
    __tablename__ = "clientes"

    id         = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    usuario_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("usuarios.id"), unique=True)
    nombre     = db.Column(db.String(120), nullable=False)
    apellido   = db.Column(db.String(120), nullable=False)
    cedula     = db.Column(db.String(20), unique=True)
    telefono   = db.Column(db.String(20))
    email      = db.Column(db.String(254))
    calle_id   = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("calles.id"))
    creado_en  = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    usuario  = db.relationship("Usuario")
    reservas = db.relationship("Reserva", back_populates="cliente", lazy="dynamic")
    ventas   = db.relationship("Venta", back_populates="cliente", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "cedula": self.cedula,
            "telefono": self.telefono,
            "email": self.email,
        }


class Empleado(db.Model):
    __tablename__ = "empleados"

    id         = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    usuario_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("usuarios.id"), nullable=False, unique=True)
    nombre     = db.Column(db.String(120), nullable=False)
    apellido   = db.Column(db.String(120), nullable=False)
    cedula     = db.Column(db.String(20), unique=True)
    cargo      = db.Column(db.String(80), nullable=False)
    telefono   = db.Column(db.String(20))
    activo     = db.Column(db.Boolean, nullable=False, default=True)

    usuario = db.relationship("Usuario")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "cargo": self.cargo,
            "activo": self.activo,
        }


class Proveedor(db.Model):
    __tablename__ = "proveedores"

    id       = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre   = db.Column(db.String(150), nullable=False)
    rnc      = db.Column(db.String(20), unique=True)
    telefono = db.Column(db.String(20))
    email    = db.Column(db.String(254))
    calle_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("calles.id"))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "rnc": self.rnc,
            "telefono": self.telefono,
            "email": self.email,
        }
