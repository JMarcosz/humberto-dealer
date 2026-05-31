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
        if not Usuario.query.filter_by(email="admin@concesionaria.com").first():
            db.session.add(Usuario(
                nombre="Admin",
                email="admin@concesionaria.com",
                password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
                rol_id=1,
            ))
            db.session.commit()
            print("Usuario admin creado.")
        else:
            print("Usuario admin ya existe, omitiendo.")

        # Usuario público de prueba
        if not Usuario.query.filter_by(email="maria@email.com").first():
            db.session.add(Usuario(
                nombre="Maria",
                email="maria@email.com",
                password_hash=bcrypt.generate_password_hash("user1234").decode("utf-8"),
                rol_id=2,
            ))
            db.session.commit()
            print("Usuario maria creado.")
        else:
            print("Usuario maria ya existe, omitiendo.")

        print("\nSeed completado.")
        print("  Admin:   admin@concesionaria.com / admin123")
        print("  Cliente: maria@email.com / user1234")


if __name__ == "__main__":
    seed()
