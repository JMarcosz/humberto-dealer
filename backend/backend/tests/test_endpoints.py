"""Tests básicos de endpoints críticos — pytest + Flask test client."""
import json
import pytest

from backend import create_app
from backend.models import db as _db, Rol, Usuario, Marca, Modelo, Vehiculo
from backend import bcrypt


@pytest.fixture(scope="session")
def app():
    """App configurada en modo test con SQLite en memoria."""
    import os
    os.environ.setdefault("SECRET_KEY",              "test-secret-key")
    os.environ.setdefault("DB_USER",                 "root")
    os.environ.setdefault("DB_PASSWORD",             "test")
    os.environ.setdefault("WHATSAPP_API_KEY",         "dummy")
    os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "dummy")
    os.environ.setdefault("WHATSAPP_VERIFY_TOKEN",    "test-token")
    os.environ.setdefault("GOOGLE_CLIENT_ID",         "dummy")
    os.environ.setdefault("GOOGLE_CLIENT_SECRET",     "dummy")

    application = create_app()
    application.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,
    })
    return application


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="session", autouse=True)
def seed_db(app):
    """Crea tablas y datos mínimos para tests."""
    with app.app_context():
        _db.create_all()

        rol_admin  = Rol(nombre="ADMIN")
        rol_pub    = Rol(nombre="USUARIO_PUBLICO")
        _db.session.add_all([rol_admin, rol_pub])
        _db.session.flush()

        admin = Usuario(
            nombre="Admin Test",
            email="admin@test.com",
            password_hash=bcrypt.generate_password_hash("admin1234").decode(),
            rol_id=rol_admin.id,
        )
        user = Usuario(
            nombre="User Test",
            email="user@test.com",
            password_hash=bcrypt.generate_password_hash("user1234").decode(),
            rol_id=rol_pub.id,
        )
        _db.session.add_all([admin, user])

        marca  = Marca(nombre="BMW", pais_origen="ALEMANIA")
        _db.session.add(marca)
        _db.session.flush()

        modelo = Modelo(nombre="M3 COMPETITION", marca_id=marca.id, categoria="SEDAN")
        _db.session.add(modelo)
        _db.session.flush()

        v = Vehiculo(
            modelo_id=modelo.id, anio=2023, vin="WBS8M9C50PA000001",
            color="NEGRO", precio=85000, kilometraje=0,
            combustible="GASOLINA", transmision="AUTOMATICA",
            estado="DISPONIBLE",
        )
        from datetime import datetime
        v.publicado_en = datetime.utcnow()
        _db.session.add(v)
        _db.session.commit()


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def login(client, email: str, password: str):
    return client.post(
        "/api/auth/login",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
    )


# ---------------------------------------------------------------
# Tests de autenticación
# ---------------------------------------------------------------
class TestAuth:
    def test_login_exitoso(self, client):
        r = login(client, "admin@test.com", "admin1234")
        assert r.status_code == 200
        data = r.get_json()
        assert "usuario" in data

    def test_login_credenciales_invalidas(self, client):
        r = login(client, "admin@test.com", "wrong")
        assert r.status_code == 401

    def test_registro_email_duplicado(self, client):
        client.post(
            "/api/auth/registro",
            data=json.dumps({"nombre": "A", "email": "dup@test.com", "password": "pass1234"}),
            content_type="application/json",
        )
        r = client.post(
            "/api/auth/registro",
            data=json.dumps({"nombre": "B", "email": "dup@test.com", "password": "pass1234"}),
            content_type="application/json",
        )
        assert r.status_code == 409


# ---------------------------------------------------------------
# Tests de catálogo
# ---------------------------------------------------------------
class TestCatalogo:
    def test_listar_vehiculos(self, client):
        r = client.get("/api/catalogo/vehiculos")
        assert r.status_code == 200
        data = r.get_json()
        assert "items" in data
        assert data["total"] >= 1

    def test_ficha_vehiculo(self, client):
        r = client.get("/api/catalogo/vehiculos/1")
        assert r.status_code == 200
        assert r.get_json()["estado"] in ("DISPONIBLE", "RESERVADO")

    def test_listar_marcas(self, client):
        r = client.get("/api/catalogo/marcas")
        assert r.status_code == 200
        assert len(r.get_json()) >= 1


# ---------------------------------------------------------------
# Tests de admin — protección por rol
# ---------------------------------------------------------------
class TestAdminProteccion:
    def test_historico_sin_autenticar(self, client):
        r = client.get("/api/admin/historico")
        assert r.status_code == 401

    def test_historico_usuario_publico(self, client):
        login(client, "user@test.com", "user1234")
        r = client.get("/api/admin/historico")
        assert r.status_code in (401, 403)

    def test_historico_admin(self, client):
        login(client, "admin@test.com", "admin1234")
        r = client.get("/api/admin/historico")
        assert r.status_code == 200


# ---------------------------------------------------------------
# Tests de validaciones
# ---------------------------------------------------------------
class TestValidaciones:
    def test_registro_email_invalido(self, client):
        r = client.post(
            "/api/auth/registro",
            data=json.dumps({"nombre": "X", "email": "noesemail", "password": "pass1234"}),
            content_type="application/json",
        )
        assert r.status_code == 422

    def test_registro_password_corto(self, client):
        r = client.post(
            "/api/auth/registro",
            data=json.dumps({"nombre": "X", "email": "x@test.com", "password": "abc"}),
            content_type="application/json",
        )
        assert r.status_code == 422
