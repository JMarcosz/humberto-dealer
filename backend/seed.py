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

        print("\nSeed completado.")
        print("  Admin:   admin@concesionaria.com / admin123")
        print("  Cliente: maria@email.com / user1234")
        print("  Cliente: carlos@email.com / user1234")


if __name__ == "__main__":
    seed()
