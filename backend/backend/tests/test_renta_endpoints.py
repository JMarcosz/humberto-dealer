"""Tests automatizados de endpoints y reglas de negocio de Renta de Autos."""
import json
from datetime import datetime, timedelta, date
import pytest

from backend import create_app, bcrypt
from backend.models import (
    db as _db, Rol, Usuario, Marca, Modelo, Vehiculo,
    Sucursal, TarifaRenta, CoberturaSeguro, ExtraServicio,
    ReservaRenta, InspeccionRenta
)


@pytest.fixture(scope="session")
def app():
    import os
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ.setdefault("DB_USER", "root")
    os.environ.setdefault("DB_PASSWORD", "test")
    os.environ.setdefault("WHATSAPP_API_KEY", "dummy")
    os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "dummy")
    os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "test-token")
    os.environ.setdefault("GOOGLE_CLIENT_ID", "dummy")
    os.environ.setdefault("GOOGLE_CLIENT_SECRET", "dummy")

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
def setup_renta_db(app):
    with app.app_context():
        _db.create_all()

        # Roles
        rol_admin = Rol(nombre="ADMIN")
        rol_pub   = Rol(nombre="USUARIO_PUBLICO")
        _db.session.add_all([rol_admin, rol_pub])
        _db.session.flush()

        # Usuario admin
        admin = Usuario(
            nombre="Admin Test",
            email="admin@test.com",
            password_hash=bcrypt.generate_password_hash("admin1234").decode(),
            rol_id=rol_admin.id,
        )
        _db.session.add(admin)

        # Sucursales
        suc_sdq = Sucursal(
            nombre="Aeropuerto SDQ",
            codigo_aeropuerto="SDQ",
            direccion="Ruta 66",
            ciudad="Santo Domingo",
            activo=True,
        )
        suc_centro = Sucursal(
            nombre="Santo Domingo Centro",
            codigo_aeropuerto=None,
            direccion="Av. Lincoln",
            ciudad="Santo Domingo",
            activo=True,
        )
        _db.session.add_all([suc_sdq, suc_centro])
        _db.session.flush()

        # Coberturas
        cob_tpl = CoberturaSeguro(
            codigo="TPL_BASICO",
            nombre="Protección Básica (TPL)",
            costo_dia=0.00,
            deposito_requerido=800.00,
            deducible_monto=1000.00,
            activo=True,
        )
        cob_cdw = CoberturaSeguro(
            codigo="CDW_ESTANDAR",
            nombre="Protección Estándar (CDW)",
            costo_dia=15.00,
            deposito_requerido=400.00,
            deducible_monto=500.00,
            activo=True,
        )
        _db.session.add_all([cob_tpl, cob_cdw])

        # Extras
        extra_silla = ExtraServicio(
            codigo="SILLA_BEBE",
            nombre="Silla de Bebé",
            costo_dia=8.00,
            es_pago_unico=False,
            activo=True,
        )
        _db.session.add(extra_silla)

        # Catálogo
        marca = Marca(nombre="TOYOTA", pais_origen="Japón")
        _db.session.add(marca)
        _db.session.flush()

        modelo = Modelo(nombre="COROLLA", marca_id=marca.id, categoria="SEDAN")
        _db.session.add(modelo)
        _db.session.flush()

        vehiculo = Vehiculo(
            modelo_id=modelo.id,
            anio=2023,
            vin="12345678901234567",
            color="BLANCO",
            precio=25000.00,
            kilometraje=15000,
            combustible="GASOLINA",
            transmision="AUTOMATICA",
            estado="DISPONIBLE",
            disponible_para="AMBOS",
            pasajeros=5,
            maletas_grandes=2,
            maletas_pequenas=2,
            tiene_aire_acondicionado=True,
        )
        _db.session.add(vehiculo)
        _db.session.flush()

        tarifa = TarifaRenta(
            vehiculo_id=vehiculo.id,
            precio_dia_base=40.00,
            deposito_garantia=500.00,
            moneda="USD",
            activo=True,
        )
        _db.session.add(tarifa)
        _db.session.commit()


def test_listar_sucursales(client):
    res = client.get("/api/renta/sucursales")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) >= 2
    assert any(s["codigo_aeropuerto"] == "SDQ" for s in data)


def test_listar_coberturas(client):
    res = client.get("/api/renta/coberturas")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) >= 2
    assert any(c["codigo"] == "TPL_BASICO" for c in data)


def test_listar_extras(client):
    res = client.get("/api/renta/extras")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) >= 1
    assert data[0]["codigo"] == "SILLA_BEBE"


def test_disponibilidad_fechas_invalidas(client):
    res = client.get("/api/renta/disponibilidad?fecha_inicio=2026-10-05T10:00&fecha_fin=2026-10-01T10:00")
    assert res.status_code == 422
    assert "posterior" in res.get_json()["error"]


def test_disponibilidad_exitosa(client):
    f_ini = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=4)).strftime("%Y-%m-%dT10:00")

    res = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini}&fecha_fin={f_fin}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["dias_facturables"] == 3
    assert data["total_disponibles"] >= 1
    v = data["vehiculos"][0]
    assert v["tarifa"]["precio_por_dia"] == 40.0
    assert v["tarifa"]["total_estimado"] == 120.0  # 40 * 3


def test_checkout_rechazo_menor_21_anos(client):
    f_ini = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=13)).strftime("%Y-%m-%dT10:00")

    # Conductor con 19 años
    f_nac_joven = (date.today() - timedelta(days=365 * 19)).isoformat()

    payload = {
        "vehiculo_id": 1,
        "sucursal_recogida_id": 1,
        "sucursal_devolucion_id": 1,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "cobertura_id": 1,
        "conductor": {
            "nombre": "Joven",
            "apellido": "Tester",
            "email": "joven@test.com",
            "telefono": "8095551234",
            "documento": "40200000001",
            "licencia": "DO-12345",
            "fecha_nacimiento": f_nac_joven,
        }
    }
    res = client.post("/api/renta/reservas", json=payload)
    assert res.status_code == 422
    assert "21 años" in res.get_json()["error"]


def test_checkout_exitoso_y_voucher(client):
    f_ini = (datetime.utcnow() + timedelta(days=20)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=23)).strftime("%Y-%m-%dT10:00")

    # Conductor de 28 años
    f_nac_adulto = (date.today() - timedelta(days=365 * 28)).isoformat()

    payload = {
        "vehiculo_id": 1,
        "sucursal_recogida_id": 1,
        "sucursal_devolucion_id": 2,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "cobertura_id": 2,  # CDW (15/dia)
        "extras_ids": [1],  # Silla bebe (8/dia)
        "conductor": {
            "nombre": "Carlos",
            "apellido": "Adulto",
            "email": "carlos@test.com",
            "telefono": "8095559876",
            "documento": "00100000002",
            "licencia": "DO-98765",
            "fecha_nacimiento": f_nac_adulto,
        },
        "notas_vuelo": "Delta 1832",
    }
    res = client.post("/api/renta/reservas", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    pnr = data["pnr"]
    assert pnr.startswith("HA-")
    
    # 3 días: Vehiculo (40*3 = 120) + CDW (15*3 = 45) + Silla (8*3 = 24) = 189
    reserva = data["reserva"]
    assert reserva["total_dias"] == 3
    assert reserva["total_alquiler"] == 189.0

    # Consultar voucher
    res_voucher = client.get(f"/api/renta/reservas/{pnr}")
    assert res_voucher.status_code == 200
    v_data = res_voucher.get_json()
    assert v_data["pnr"] == pnr
    assert v_data["conductor"]["nombre"] == "Carlos"
    assert v_data["estado"] == "CONFIRMADA"

    # Verificar que el mismo vehículo no está disponible para esas fechas
    res_disp = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini}&fecha_fin={f_fin}")
    assert res_disp.status_code == 200
    assert res_disp.get_json()["total_disponibles"] == 0
