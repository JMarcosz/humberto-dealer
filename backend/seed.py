"""
Inicializa la base de datos: crea tablas y carga datos de prueba.
Uso: python seed.py
Es seguro ejecutar múltiples veces (idempotente).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend import create_app, bcrypt
from backend.models.base import db
from backend.models.users import Rol, Usuario


def seed():
    app = create_app()
    with app.app_context():
        print("Creando tablas...")
        db.create_all()

        # Migración automática de columnas previas al seed
        try:
            with db.engine.connect() as conn:
                from sqlalchemy import inspect, text
                inspector = inspect(db.engine)

                if 'vehiculos' in inspector.get_table_names():
                    existing_veh_cols = {c['name'] for c in inspector.get_columns('vehiculos')}
                    alter_veh = []
                    if 'disponible_para' not in existing_veh_cols:
                        alter_veh.append("ADD COLUMN disponible_para ENUM('VENTA', 'RENTA', 'AMBOS') NOT NULL DEFAULT 'AMBOS'")
                    if 'pasajeros' not in existing_veh_cols:
                        alter_veh.append("ADD COLUMN pasajeros SMALLINT NOT NULL DEFAULT 5")
                    if 'maletas_grandes' not in existing_veh_cols:
                        alter_veh.append("ADD COLUMN maletas_grandes SMALLINT NOT NULL DEFAULT 2")
                    if 'maletas_pequenas' not in existing_veh_cols:
                        alter_veh.append("ADD COLUMN maletas_pequenas SMALLINT NOT NULL DEFAULT 2")
                    if 'tiene_aire_acondicionado' not in existing_veh_cols:
                        alter_veh.append("ADD COLUMN tiene_aire_acondicionado TINYINT(1) NOT NULL DEFAULT 1")
                    if alter_veh:
                        conn.execute(text(f"ALTER TABLE vehiculos {', '.join(alter_veh)}"))
                        conn.commit()

                if 'coberturas_seguro' in inspector.get_table_names():
                    existing_cob_cols = {c['name'] for c in inspector.get_columns('coberturas_seguro')}
                    if 'reduccion_deposito_pct' not in existing_cob_cols:
                        conn.execute(text("ALTER TABLE coberturas_seguro ADD COLUMN reduccion_deposito_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00"))
                        conn.commit()
                        print("Columna reduccion_deposito_pct agregada a coberturas_seguro.")
        except Exception as e:
            print(f"Nota de migración: {e}")

        # Roles
        if not Rol.query.first():
            db.session.add_all([
                Rol(nombre="ADMIN"),
                Rol(nombre="USUARIO_PUBLICO"),
            ])
            db.session.commit()
            print("Roles creados.")
        else:
            print("Roles ya existen, omitiendo.")

        # Admin
        admin = Usuario.query.filter_by(email="admin@concesionaria.com").first()
        if not admin:
            db.session.add(Usuario(
                nombre="Admin",
                email="admin@concesionaria.com",
                password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
                rol_id=1,
            ))
            db.session.commit()
            print("Usuario admin creado.")
        elif "PLACEHOLDER" in (admin.password_hash or ""):
            admin.password_hash = bcrypt.generate_password_hash("admin123").decode("utf-8")
            db.session.commit()
            print("Password hash de admin actualizado con bcrypt real.")
        else:
            print("Usuario admin ya existe, omitiendo.")

        # Usuario público de prueba (Maria)
        maria = Usuario.query.filter_by(email="maria@email.com").first()
        if not maria:
            db.session.add(Usuario(
                nombre="Maria",
                email="maria@email.com",
                password_hash=bcrypt.generate_password_hash("user1234").decode("utf-8"),
                rol_id=2,
            ))
            db.session.commit()
            print("Usuario maria creado.")
        elif "PLACEHOLDER" in (maria.password_hash or ""):
            maria.password_hash = bcrypt.generate_password_hash("user1234").decode("utf-8")
            db.session.commit()
            print("Password hash de maria actualizado con bcrypt real.")
        else:
            print("Usuario maria ya existe, omitiendo.")

        # Usuario Carlos
        carlos = Usuario.query.filter_by(email="carlos@email.com").first()
        if carlos and "PLACEHOLDER" in (carlos.password_hash or ""):
            carlos.password_hash = bcrypt.generate_password_hash("user1234").decode("utf-8")
            db.session.commit()
            print("Password hash de carlos actualizado con bcrypt real.")

        # Semillas de Renta de Autos
        from backend.models.renta import Sucursal, CoberturaSeguro, ExtraServicio, TarifaRenta
        from backend.models.catalog import Vehiculo, Modelo

        # 1. Sucursales
        if not Sucursal.query.first():
            db.session.add_all([
                Sucursal(
                    nombre="Aeropuerto Internacional Las Américas (SDQ)",
                    codigo_aeropuerto="SDQ",
                    direccion="Ruta 66, Salida Terminal A, Santo Domingo Este",
                    ciudad="Santo Domingo",
                    telefono="+1 (809) 555-7368",
                    horario_atencion="24/7 (Atención continua)",
                    latitud=18.4297,
                    longitud=-69.6689,
                    activo=True,
                ),
                Sucursal(
                    nombre="Santo Domingo Centro (Piantini)",
                    codigo_aeropuerto=None,
                    direccion="Av. Abraham Lincoln esq. Andrés Julio Aybar, Piantini",
                    ciudad="Santo Domingo",
                    telefono="+1 (809) 555-7369",
                    horario_atencion="Lunes a Domingo: 07:00 AM - 09:00 PM",
                    latitud=18.4721,
                    longitud=-69.9389,
                    activo=True,
                ),
                Sucursal(
                    nombre="Aeropuerto La Isabela / Joaquín Balaguer (JBQ)",
                    codigo_aeropuerto="JBQ",
                    direccion="Av. Aeropuerto La Isabela, El Higüero",
                    ciudad="Santo Domingo Norte",
                    telefono="+1 (809) 555-7370",
                    horario_atencion="07:00 AM - 07:00 PM",
                    latitud=18.5719,
                    longitud=-69.9861,
                    activo=True,
                ),
            ])
            db.session.commit()
            print("Sucursales de renta creadas.")
        else:
            print("Sucursales ya existen, omitiendo.")

        # 2. Coberturas de Seguro
        if not CoberturaSeguro.query.first():
            db.session.add_all([
                CoberturaSeguro(
                    codigo="TPL_BASICO",
                    nombre="Protección Básica (TPL Obligatorio)",
                    costo_dia=0.00,
                    deposito_requerido=800.00,
                    reduccion_deposito_pct=0.00,
                    deducible_monto=1000.00,
                    descripcion="Seguro de Responsabilidad Civil contra Daños a Terceros requerido por ley en República Dominicana.",
                    bullets_json="Responsabilidad Civil Daños a Terceros (TPL);Asistencia Vial Básica en Santo Domingo;Depósito de garantía completo según la categoría del vehículo",
                    destacado=False,
                    activo=True,
                ),
                CoberturaSeguro(
                    codigo="CDW_ESTANDAR",
                    nombre="Protección Estándar (CDW)",
                    costo_dia=15.00,
                    deposito_requerido=400.00,
                    reduccion_deposito_pct=50.00,
                    deducible_monto=500.00,
                    descripcion="Cobertura ante colisión y robo con deducible reducido a US$ 500 y depósito en tarjeta de solo US$ 400.",
                    bullets_json="Cobertura por Daños de Colisión (CDW);Protección contra Robo Total;Depósito de garantía reducido a la mitad;Asistencia vial 24/7 en carretera",
                    destacado=True,
                    activo=True,
                ),
                CoberturaSeguro(
                    codigo="TOTAL_PROTECTION",
                    nombre="Protección Total Cero Deducible",
                    costo_dia=28.00,
                    deposito_requerido=150.00,
                    reduccion_deposito_pct=100.00,
                    deducible_monto=0.00,
                    descripcion="Tranquilidad absoluta sin deducible ante colisiones, robo, rotura de cristales y daños a neumáticos.",
                    bullets_json="Cero Deducible / Sin Franquicia;Cobertura de Cristales, Parabrisas y Neumáticos;Depósito de garantía al mínimo (US$ 200);Remolque y grúa nacional ilimitados",
                    destacado=False,
                    activo=True,
                ),
            ])
            db.session.commit()
            print("Coberturas de seguro creadas.")
        else:
            print("Coberturas ya existen, omitiendo.")

        # 3. Extras / Adicionales
        if not ExtraServicio.query.first():
            db.session.add_all([
                ExtraServicio(
                    codigo="SILLA_BEBE",
                    nombre="Silla de Seguridad para Infantes",
                    descripcion="Asiento homologado para niños (0 a 4 años) conforme a regulaciones viales.",
                    costo_dia=8.00,
                    es_pago_unico=False,
                    icono="baby",
                    activo=True,
                ),
                ExtraServicio(
                    codigo="PASO_RAPIDO",
                    nombre="Dispositivo Paso Rápido Peajes RD",
                    descripcion="Tag electrónico prepagado para cruzar sin filas todos los peajes de autopistas dominicanas.",
                    costo_dia=5.00,
                    es_pago_unico=False,
                    icono="credit-card",
                    activo=True,
                ),
                ExtraServicio(
                    codigo="CONDUCTOR_EXTRA",
                    nombre="Conductor Adicional Autorizado",
                    descripcion="Habilita legalmente a un segundo conductor con cobertura de la póliza contratada.",
                    costo_dia=10.00,
                    es_pago_unico=False,
                    icono="users",
                    activo=True,
                ),
                ExtraServicio(
                    codigo="WIFI_PORTATIL",
                    nombre="Hotspot Wi-Fi 4G Ilimitado",
                    descripcion="Módem Wi-Fi portátil para conectar hasta 5 dispositivos con internet en todo el país.",
                    costo_dia=9.00,
                    es_pago_unico=False,
                    icono="wifi",
                    activo=True,
                ),
            ])
            db.session.commit()
            print("Extras de renta creados.")
        else:
            print("Extras ya existen, omitiendo.")

        # 4. Asignar tarifas de renta a vehículos existentes
        vehiculos = Vehiculo.query.all()
        for v in vehiculos:
            if not v.tarifa_renta:
                # Determinar tarifa según categoría del modelo
                cat = v.modelo.categoria if v.modelo else "OTRO"
                if cat in ("SUV", "PICKUP"):
                    precio_dia = 55.00
                    deposito = 600.00
                elif cat in ("VAN", "CONVERTIBLE"):
                    precio_dia = 75.00
                    deposito = 800.00
                else:
                    precio_dia = 38.00
                    deposito = 450.00

                v.disponible_para = "AMBOS"
                v.pasajeros = 7 if cat == "VAN" else 5
                v.maletas_grandes = 3 if cat in ("SUV", "VAN") else 2
                v.maletas_pequenas = 2
                v.tiene_aire_acondicionado = True

                tarifa = TarifaRenta(
                    vehiculo_id=v.id,
                    precio_dia_base=precio_dia,
                    deposito_garantia=deposito,
                    moneda="USD",
                    kilometraje_incluido="ILIMITADO",
                    politica_combustible="LLENO_A_LLENO",
                    activo=True,
                )
                db.session.add(tarifa)

        db.session.commit()
        print("Tarifas de renta asignadas a vehículos.")

        print("\nSeed completado exitosamente.")
        print("  Admin:   admin@concesionaria.com / admin123")
        print("  Cliente: maria@email.com / user1234")
        print("  Cliente: carlos@email.com / user1234")


if __name__ == "__main__":
    seed()
