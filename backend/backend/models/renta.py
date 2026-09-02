"""Modelos de Renta de Vehículos: Sucursales, Tarifas, Coberturas, Extras, Reservas e Inspecciones."""
from datetime import datetime
from .base import db
from sqlalchemy.dialects import mysql


class Sucursal(db.Model):
    __tablename__ = "sucursales"

    id                = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre            = db.Column(db.String(120), nullable=False)
    codigo_aeropuerto = db.Column(db.String(10), nullable=True)  # Ej. "SDQ", "JBQ"
    direccion         = db.Column(db.String(255), nullable=False)
    ciudad            = db.Column(db.String(80), nullable=False, default="Santo Domingo")
    telefono          = db.Column(db.String(30), nullable=True)
    horario_atencion  = db.Column(db.String(60), nullable=False, default="24/7 (Previa reserva)")
    latitud           = db.Column(db.Numeric(10, 7), nullable=True)
    longitud          = db.Column(db.Numeric(10, 7), nullable=True)
    activo            = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "codigo_aeropuerto": self.codigo_aeropuerto,
            "direccion": self.direccion,
            "ciudad": self.ciudad,
            "telefono": self.telefono,
            "horario_atencion": self.horario_atencion,
            "latitud": float(self.latitud) if self.latitud else None,
            "longitud": float(self.longitud) if self.longitud else None,
            "activo": self.activo,
        }


class TarifaRenta(db.Model):
    __tablename__ = "tarifas_renta"

    id                    = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    vehiculo_id           = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"), nullable=False, unique=True)
    precio_dia_base       = db.Column(db.Numeric(10, 2), nullable=False)  # Ej. 45.00 USD
    deposito_garantia     = db.Column(db.Numeric(10, 2), nullable=False, default=500.00)
    moneda                = db.Column(db.String(3), nullable=False, default="USD")
    kilometraje_incluido  = db.Column(db.String(50), nullable=False, default="ILIMITADO")
    politica_combustible  = db.Column(db.String(50), nullable=False, default="LLENO_A_LLENO")
    activo                = db.Column(db.Boolean, nullable=False, default=True)

    vehiculo = db.relationship("Vehiculo", back_populates="tarifa_renta")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "vehiculo_id": self.vehiculo_id,
            "precio_dia_base": float(self.precio_dia_base),
            "deposito_garantia": float(self.deposito_garantia),
            "moneda": self.moneda,
            "kilometraje_incluido": self.kilometraje_incluido,
            "politica_combustible": self.politica_combustible,
            "activo": self.activo,
        }


class CoberturaSeguro(db.Model):
    __tablename__ = "coberturas_seguro"

    id                     = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    codigo                 = db.Column(db.String(30), nullable=False, unique=True)  # TPL_BASICO, CDW_ESTANDAR, TOTAL_PROTECTION
    nombre                 = db.Column(db.String(120), nullable=False)
    costo_dia              = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    deposito_requerido     = db.Column(db.Numeric(10, 2), nullable=False, default=800.00)
    # Regla 4: el riesgo escala con el vehiculo (TarifaRenta.deposito_garantia)
    # y la cobertura lo mitiga con este porcentaje. Sustituye a deposito_requerido,
    # que queda huerfano hasta su DROP en un PR posterior.
    reduccion_deposito_pct = db.Column(db.Numeric(5, 2), nullable=False, default=0.00)
    deducible_monto        = db.Column(db.Numeric(10, 2), nullable=False, default=1000.00)
    descripcion            = db.Column(db.Text, nullable=True)
    bullets_json           = db.Column(db.Text, nullable=True)
    destacado              = db.Column(db.Boolean, nullable=False, default=False)
    activo                 = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self) -> dict:
        bullets = [b.strip() for b in (self.bullets_json or "").split(";") if b.strip()]
        return {
            "id": self.id,
            "codigo": self.codigo,
            "nombre": self.nombre,
            "costo_dia": float(self.costo_dia),
            "reduccion_deposito_pct": float(self.reduccion_deposito_pct or 0),
            "deducible_monto": float(self.deducible_monto),
            "descripcion": self.descripcion,
            "bullets": bullets,
            "destacado": self.destacado,
        }


class ExtraServicio(db.Model):
    __tablename__ = "extras_servicio"

    id           = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    codigo       = db.Column(db.String(30), nullable=False, unique=True)  # SILLA_BEBE, PASO_RAPIDO, CONDUCTOR_EXTRA, WIFI
    nombre       = db.Column(db.String(120), nullable=False)
    descripcion  = db.Column(db.String(255), nullable=True)
    costo_dia    = db.Column(db.Numeric(10, 2), nullable=False)
    es_pago_unico= db.Column(db.Boolean, nullable=False, default=False)
    icono        = db.Column(db.String(50), nullable=True)
    activo       = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "codigo": self.codigo,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "costo_dia": float(self.costo_dia),
            "es_pago_unico": self.es_pago_unico,
            "icono": self.icono,
        }


class ReservaRenta(db.Model):
    __tablename__ = "reservas_renta"
    __table_args__ = (
        db.Index("ix_reservas_renta_pnr", "pnr"),
        db.Index("ix_reservas_renta_fechas", "fecha_inicio", "fecha_fin"),
        db.Index("ix_reservas_renta_estado", "estado"),
        db.Index("ix_reservas_renta_documento", "conductor_documento"),
        db.Index("ix_reservas_renta_email", "conductor_email"),
        # Cubre exactamente el predicado de colision de calendario.
        db.Index("ix_reservas_renta_veh_estado_fechas",
                 "vehiculo_id", "estado", "fecha_inicio", "fecha_fin"),
    )

    id                     = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    pnr                    = db.Column(db.String(12), nullable=False, unique=True)  # Ej. "HA-84920"
    vehiculo_id            = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("vehiculos.id"), nullable=False)
    cliente_id             = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("clientes.id"), nullable=True)
    sucursal_recogida_id   = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("sucursales.id"), nullable=False)
    sucursal_devolucion_id = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("sucursales.id"), nullable=False)
    
    fecha_inicio           = db.Column(db.DateTime, nullable=False)
    fecha_fin              = db.Column(db.DateTime, nullable=False)
    total_dias             = db.Column(mysql.SMALLINT(unsigned=True), nullable=False)
    
    cobertura_id           = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("coberturas_seguro.id"), nullable=False)
    tarifa_diaria_aplicada = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal_vehiculo      = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal_cobertura     = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    subtotal_extras        = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    total_alquiler         = db.Column(db.Numeric(10, 2), nullable=False)
    deposito_garantia_monto= db.Column(db.Numeric(10, 2), nullable=False)
    moneda                 = db.Column(db.String(3), nullable=False, default="USD")
    
    estado                 = db.Column(
        db.Enum("CONFIRMADA", "EN_CURSO", "COMPLETADA", "CANCELADA",
                "NO_SHOW", "EXPIRADA"),
        nullable=False,
        default="CONFIRMADA",
    )
    
    # Datos del conductor principal para el contrato
    conductor_nombre       = db.Column(db.String(150), nullable=False)
    conductor_apellido     = db.Column(db.String(150), nullable=False)
    conductor_email        = db.Column(db.String(254), nullable=False)
    conductor_telefono     = db.Column(db.String(30), nullable=False)
    conductor_documento    = db.Column(db.String(50), nullable=False)
    conductor_licencia     = db.Column(db.String(50), nullable=False)
    conductor_fecha_nac    = db.Column(db.Date, nullable=False)
    notas_vuelo            = db.Column(db.String(100), nullable=True)

    # -- Regla 2: snapshot de edad y recargo por conductor joven -------------
    edad_conductor         = db.Column(mysql.SMALLINT(unsigned=True), nullable=True)
    recargo_young_driver   = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)

    # -- Prueba de aceptacion del contrato ----------------------------------
    terminos_aceptados     = db.Column(db.Boolean, nullable=False, default=False)
    terminos_aceptados_en  = db.Column(db.DateTime, nullable=True)
    terminos_version       = db.Column(db.String(20), nullable=True)
    terminos_ip            = db.Column(db.String(45), nullable=True)   # cabe IPv6

    # -- Cancelacion / no-show ----------------------------------------------
    cancelada_en           = db.Column(db.DateTime, nullable=True)
    cancelacion_motivo     = db.Column(db.String(255), nullable=True)
    cancelado_por          = db.Column(db.Enum("CLIENTE", "ADMIN", "SISTEMA"), nullable=True)

    # -- Liquidacion de mostrador -------------------------------------------
    fecha_recogida_real    = db.Column(db.DateTime, nullable=True)
    fecha_devolucion_real  = db.Column(db.DateTime, nullable=True)
    horas_retraso          = db.Column(db.Numeric(6, 2),  nullable=False, default=0.00)
    cargo_retraso          = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    cargo_combustible      = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    cargo_danos            = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    total_penalidades      = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    # NULL = renta aun no liquidada. Un 0.00 haria indistinguible una reserva
    # en curso de una cerrada sin cargos.
    total_final            = db.Column(db.Numeric(10, 2), nullable=True)
    
    creado_en              = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    actualizado_en         = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    vehiculo            = db.relationship("Vehiculo", back_populates="reservas_renta")
    cliente             = db.relationship("Cliente")
    sucursal_recogida   = db.relationship("Sucursal", foreign_keys=[sucursal_recogida_id])
    sucursal_devolucion = db.relationship("Sucursal", foreign_keys=[sucursal_devolucion_id])
    cobertura           = db.relationship("CoberturaSeguro")
    extras              = db.relationship("ReservaRentaExtra", back_populates="reserva", cascade="all, delete-orphan")
    inspecciones        = db.relationship("InspeccionRenta", back_populates="reserva", cascade="all, delete-orphan")

    def to_dict(self, include_detalle: bool = True, publico: bool = False) -> dict:
        """Serializa la reserva.

        Con `publico=True` (voucher accesible sin sesion) el documento y la
        licencia salen enmascarados y la fecha de nacimiento se omite: una
        fecha de nacimiento no se enmascara de forma util, se quita.
        """
        from ..services.renta_politica import enmascarar_documento, enmascarar_licencia
        v = self.vehiculo
        modelo = v.modelo if v else None
        marca  = modelo.marca if modelo else None
        data = {
            "id": self.id,
            "pnr": self.pnr,
            "estado": self.estado,
            "vehiculo_id": self.vehiculo_id,
            "vehiculo_nombre": f"{marca.nombre} {modelo.nombre}" if (marca and modelo) else f"Vehículo #{self.vehiculo_id}",
            "categoria": modelo.categoria if modelo else None,
            "fecha_inicio": self.fecha_inicio.isoformat(),
            "fecha_fin": self.fecha_fin.isoformat(),
            "total_dias": self.total_dias,
            "total_alquiler": float(self.total_alquiler),
            "deposito_garantia_monto": float(self.deposito_garantia_monto),
            "moneda": self.moneda,
            "sucursal_recogida": self.sucursal_recogida.to_dict() if self.sucursal_recogida else None,
            "sucursal_devolucion": self.sucursal_devolucion.to_dict() if self.sucursal_devolucion else None,
            "conductor": {
                "nombre": self.conductor_nombre,
                "apellido": self.conductor_apellido,
                "email": self.conductor_email,
                "telefono": self.conductor_telefono,
                "documento": (enmascarar_documento(self.conductor_documento)
                              if publico else self.conductor_documento),
                "licencia": (enmascarar_licencia(self.conductor_licencia)
                             if publico else self.conductor_licencia),
            },
            "notas_vuelo": self.notas_vuelo,
            "creado_en": self.creado_en.isoformat(),
        }
        if not publico:
            data["conductor"]["fecha_nacimiento"] = (
                self.conductor_fecha_nac.isoformat() if self.conductor_fecha_nac else None
            )
        if self.estado in ("CANCELADA", "NO_SHOW", "EXPIRADA"):
            data["cancelacion"] = {
                "cancelada_en": self.cancelada_en.isoformat() if self.cancelada_en else None,
                "motivo": self.cancelacion_motivo,
                "cancelado_por": self.cancelado_por,
            }
        if include_detalle:
            data["cobertura"] = self.cobertura.to_dict() if self.cobertura else None
            data["desglose"] = {
                "tarifa_diaria": float(self.tarifa_diaria_aplicada),
                "subtotal_vehiculo": float(self.subtotal_vehiculo),
                "subtotal_cobertura": float(self.subtotal_cobertura),
                "subtotal_extras": float(self.subtotal_extras),
                "recargo_young_driver": float(self.recargo_young_driver or 0),
            }
            data["edad_conductor"] = self.edad_conductor
            data["liquidacion"] = {
                "recogida_real": self.fecha_recogida_real.isoformat() if self.fecha_recogida_real else None,
                "devolucion_real": self.fecha_devolucion_real.isoformat() if self.fecha_devolucion_real else None,
                "horas_retraso": float(self.horas_retraso or 0),
                "cargo_retraso": float(self.cargo_retraso or 0),
                "cargo_combustible": float(self.cargo_combustible or 0),
                "cargo_danos": float(self.cargo_danos or 0),
                "total_penalidades": float(self.total_penalidades or 0),
                "total_final": float(self.total_final) if self.total_final is not None else None,
            }
            data["extras"] = [e.to_dict() for e in self.extras]
            data["inspecciones"] = [i.to_dict() for i in self.inspecciones]
            if v:
                imgs = [img.to_dict() for img in v.imagenes]
                data["vehiculo_imagen"] = imgs[0]["url"] if imgs else None
        return data


class ReservaRentaExtra(db.Model):
    __tablename__ = "reservas_renta_extras"

    id              = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    reserva_id      = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("reservas_renta.id", ondelete="CASCADE"), nullable=False)
    extra_id        = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("extras_servicio.id"), nullable=False)
    cantidad        = db.Column(mysql.SMALLINT(unsigned=True), nullable=False, default=1)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal        = db.Column(db.Numeric(10, 2), nullable=False)

    reserva = db.relationship("ReservaRenta", back_populates="extras")
    extra   = db.relationship("ExtraServicio")

    def to_dict(self) -> dict:
        return {
            "extra_id": self.extra_id,
            "nombre": self.extra.nombre if self.extra else "",
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario),
            "subtotal": float(self.subtotal),
        }


class InspeccionRenta(db.Model):
    __tablename__ = "inspecciones_renta"

    id                  = db.Column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    reserva_id          = db.Column(mysql.INTEGER(unsigned=True), db.ForeignKey("reservas_renta.id"), nullable=False)
    tipo                = db.Column(db.Enum("ENTREGA", "DEVOLUCION"), nullable=False)
    odometro            = db.Column(db.Integer, nullable=False)
    combustible         = db.Column(db.String(20), nullable=False)  # Ej. "8/8", "4/4"
    observaciones_danos = db.Column(db.Text, nullable=True)
    fotos_urls          = db.Column(db.Text, nullable=True)  # URLs separadas por coma
    creado_en           = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    reserva = db.relationship("ReservaRenta", back_populates="inspecciones")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "odometro": self.odometro,
            "combustible": self.combustible,
            "observaciones_danos": self.observaciones_danos,
            "fotos": [f.strip() for f in (self.fotos_urls or "").split(",") if f.strip()],
            "creado_en": self.creado_en.isoformat(),
        }
