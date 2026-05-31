"""Modelos de jerarquía geográfica: Provincias → Municipios → Sectores → Calles."""
from .base import db
from sqlalchemy.dialects import mysql


class Provincia(db.Model):
    __tablename__ = "provincias"

    id     = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(100), nullable=False)

    municipios = db.relationship("Municipio", back_populates="provincia", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Provincia {self.nombre}>"

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre}


class Municipio(db.Model):
    __tablename__ = "municipios"

    id           = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre       = db.Column(db.String(100), nullable=False)
    provincia_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("provincias.id"), nullable=False)

    provincia = db.relationship("Provincia", back_populates="municipios")
    sectores  = db.relationship("Sector", back_populates="municipio", lazy="dynamic")

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre, "provincia_id": self.provincia_id}


class Sector(db.Model):
    __tablename__ = "sectores"

    id           = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre       = db.Column(db.String(100), nullable=False)
    municipio_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("municipios.id"), nullable=False)

    municipio = db.relationship("Municipio", back_populates="sectores")
    calles    = db.relationship("Calle", back_populates="sector", lazy="dynamic")

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre, "municipio_id": self.municipio_id}


class Calle(db.Model):
    __tablename__ = "calles"

    id        = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre    = db.Column(db.String(150), nullable=False)
    sector_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("sectores.id"), nullable=False)

    sector = db.relationship("Sector", back_populates="calles")

    def to_dict(self) -> dict:
        return {"id": self.id, "nombre": self.nombre, "sector_id": self.sector_id}
