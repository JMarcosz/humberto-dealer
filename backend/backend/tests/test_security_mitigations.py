"""Tests unitarios de verificación para mitigaciones de ciberseguridad."""
import json
import pytest

from backend import create_app, bcrypt
from backend.models import (
    db as _db, Rol, Usuario, Marca, Modelo, Vehiculo, Resena
)
from backend.blueprints.renta import generar_pnr_unico


@pytest.fixture(scope="session")
def app():
    application = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {},
        "FRONTEND_URL": "http://localhost:3000",
        "SESSION_COOKIE_NAME": "test_session",
    })
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(scope="session", autouse=True)
def setup_security_db(app):
    with app.app_context():
        _db.create_all()

        rol_admin = Rol(id=1, nombre="ADMIN")
        rol_pub   = Rol(id=2, nombre="USUARIO_PUBLICO")
        _db.session.add_all([rol_admin, rol_pub])
        _db.session.flush()

        admin = Usuario(
            nombre="Admin Sec",
            email="admin_sec@test.com",
            password_hash=bcrypt.generate_password_hash("admin1234").decode(),
            rol_id=rol_admin.id,
        )
        user = Usuario(
            nombre="User Sec",
            email="user_sec@test.com",
            password_hash=bcrypt.generate_password_hash("user1234").decode(),
            rol_id=rol_pub.id,
        )
        _db.session.add_all([admin, user])

        marca = Marca(nombre="PORSCHE")
        _db.session.add(marca)
        _db.session.flush()

        modelo = Modelo(nombre="911 Carrera", marca_id=marca.id, categoria="COUPE")
        _db.session.add(modelo)
        _db.session.flush()

        vehiculo = Vehiculo(
            modelo_id=modelo.id,
            anio=2024,
            vin="WP0AB2A99RS123456",
            color="NEGRO",
            precio=150000,
            kilometraje=500,
            combustible="GASOLINA",
            transmision="AUTOMATICA",
            estado="DISPONIBLE",
            disponible_para="VENTA",
        )
        _db.session.add(vehiculo)
        _db.session.commit()


def login_client(client, email, password):
    return client.post(
        "/api/auth/login",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
    )


# ---------------------------------------------------------------------------
# 1. Verificación de PNR Criptográfico (VULN-NEW-05)
# ---------------------------------------------------------------------------
def test_generar_pnr_unico_formato_y_entropia(app):
    with app.app_context():
        pnrs = {generar_pnr_unico() for _ in range(50)}
        assert len(pnrs) == 50, "Hubo colisiones en 50 PNRs generados"
        for pnr in pnrs:
            assert pnr.startswith("HA-")
            assert len(pnr) in (8, 9)


# ---------------------------------------------------------------------------
# 2. Aislamiento de Archivos en serve_upload (VULN-NEW-04)
# ---------------------------------------------------------------------------
def test_serve_upload_bloquea_imports(client):
    r = client.get("/api/uploads/imports/inventario.xlsx")
    assert r.status_code == 403
    assert r.get_json().get("error") == "Acceso denegado"


def test_serve_upload_bloquea_extensiones_no_imagen(client):
    r = client.get("/api/uploads/images/script.py")
    assert r.status_code == 403
    assert r.get_json().get("error") == "Tipo de archivo no permitido"


# ---------------------------------------------------------------------------
# 3. Validación y Unicidad en Reseñas (VULN-NEW-06)
# ---------------------------------------------------------------------------
def test_crear_resena_rechaza_vehiculo_inexistente(client):
    login_client(client, "user_sec@test.com", "user1234")
    r = client.post(
        "/api/catalogo/vehiculos/99999/resenas",
        data=json.dumps({"calificacion": 5, "comentario": "Excelente"}),
        content_type="application/json",
    )
    assert r.status_code == 404


def test_crear_resena_unicidad_y_limite_longitud(client, app):
    with app.app_context():
        v = Vehiculo.query.first()
        vid = v.id

    login_client(client, "user_sec@test.com", "user1234")

    # Rechazo por comentario excesivamente largo (> 1000 chars)
    r_largo = client.post(
        f"/api/catalogo/vehiculos/{vid}/resenas",
        data=json.dumps({"calificacion": 5, "comentario": "A" * 1001}),
        content_type="application/json",
    )
    assert r_largo.status_code == 422

    # Primera reseña válida -> 201
    r_valida = client.post(
        f"/api/catalogo/vehiculos/{vid}/resenas",
        data=json.dumps({"calificacion": 5, "comentario": "Gran auto"}),
        content_type="application/json",
    )
    assert r_valida.status_code == 201

    # Segunda reseña del mismo usuario -> 409 Conflicto
    r_dup = client.post(
        f"/api/catalogo/vehiculos/{vid}/resenas",
        data=json.dumps({"calificacion": 4, "comentario": "Otra reseña"}),
        content_type="application/json",
    )
    assert r_dup.status_code == 409


# ---------------------------------------------------------------------------
# 4. Validaciones de Rangos y Tipos en editar_vehiculo (VULN-NEW-10)
# ---------------------------------------------------------------------------
def test_editar_vehiculo_rechaza_valores_invalidos(client, app):
    with app.app_context():
        v = Vehiculo.query.first()
        vid = v.id

    login_client(client, "admin_sec@test.com", "admin1234")

    # Precio negativo
    r1 = client.patch(
        f"/api/admin/vehiculos/{vid}",
        data=json.dumps({"precio": -100}),
        content_type="application/json",
    )
    assert r1.status_code == 422

    # Kilometraje negativo
    r2 = client.patch(
        f"/api/admin/vehiculos/{vid}",
        data=json.dumps({"kilometraje": -50}),
        content_type="application/json",
    )
    assert r2.status_code == 422

    # Combustible inválido
    r3 = client.patch(
        f"/api/admin/vehiculos/{vid}",
        data=json.dumps({"combustible": "URANIO"}),
        content_type="application/json",
    )
    assert r3.status_code == 422

    # Transmisión inválida
    r4 = client.patch(
        f"/api/admin/vehiculos/{vid}",
        data=json.dumps({"transmision": "MAGNETICA"}),
        content_type="application/json",
    )
    assert r4.status_code == 422
