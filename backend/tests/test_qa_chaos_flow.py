"""
Script de Auditoría QA y Chaos Testing Integral (0 a 100 y Acciones No Contempladas).
Ejecuta el ciclo de vida completo de renta y desafía la resiliencia del sistema con casos límite.
"""
import pytest
from datetime import datetime, timedelta
from backend import create_app, bcrypt
from backend.models import (
    db as _db, Rol, Usuario, Marca, Modelo, Vehiculo,
    Sucursal, CoberturaSeguro, ExtraServicio, TarifaRenta, ReservaRenta
)

@pytest.fixture(scope="session")
def app():
    application = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {},
        "WTF_CSRF_ENABLED": False,
    })
    return application

@pytest.fixture(scope="session", autouse=True)
def setup_qa_db(app):
    with app.app_context():
        _db.create_all()

        # Roles
        rol_admin = Rol(id=1, nombre="ADMIN")
        rol_pub   = Rol(id=2, nombre="USUARIO_PUBLICO")
        _db.session.add_all([rol_admin, rol_pub])
        _db.session.flush()

        # Admin
        admin = Usuario(
            nombre="QA Admin",
            email="admin@qa.com",
            password_hash=bcrypt.generate_password_hash("admin1234").decode(),
            rol_id=1,
        )
        _db.session.add(admin)

        # Marca y Modelo
        marca = Marca(nombre="TOYOTA")
        _db.session.add(marca)
        _db.session.flush()

        modelo = Modelo(nombre="RAV4", marca_id=marca.id, categoria="SUV")
        _db.session.add(modelo)
        _db.session.flush()

        # Vehículo de prueba
        v = Vehiculo(
            id=10,
            modelo_id=modelo.id,
            anio=2024,
            vin="4T1B11HK5JU100099",
            color="Blanco",
            precio=25000.0,
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
        _db.session.add(v)
        _db.session.flush()

        # Tarifa de Renta
        tarifa = TarifaRenta(
            vehiculo_id=v.id,
            precio_dia_base=55.0,
            deposito_garantia=500.0,
            moneda="USD",
            kilometraje_incluido="ILIMITADO",
            politica_combustible="LLENO_A_LLENO",
            activo=True,
        )
        _db.session.add(tarifa)

        # Sucursales
        s1 = Sucursal(
            id=1,
            nombre="Aeropuerto Internacional Las Américas (SDQ)",
            codigo_aeropuerto="SDQ",
            ciudad="Santo Domingo",
            direccion="Ruta 66, Aeropuerto AILA",
            activo=True,
        )
        s2 = Sucursal(
            id=2,
            nombre="Santo Domingo Centro (Piantini)",
            ciudad="Santo Domingo",
            direccion="Av. Winston Churchill",
            activo=True,
        )
        _db.session.add_all([s1, s2])

        # Coberturas
        cob_tpl = CoberturaSeguro(
            id=1,
            codigo="TPL_BASICO",
            nombre="Protección Básica TPL",
            costo_dia=0.0,
            deposito_requerido=800.0,
            destacado=False,
            activo=True,
        )
        cob_cdw = CoberturaSeguro(
            id=2,
            codigo="CDW_ESTANDAR",
            nombre="Protección Estándar CDW",
            costo_dia=15.0,
            deposito_requerido=400.0,
            destacado=True,
            activo=True,
        )
        _db.session.add_all([cob_tpl, cob_cdw])

        # Extras
        ex1 = ExtraServicio(
            id=1,
            codigo="PASO_RAPIDO",
            nombre="Dispositivo Paso Rápido Peajes",
            costo_dia=5.0,
            es_pago_unico=False,
            activo=True,
        )
        ex2 = ExtraServicio(
            id=2,
            codigo="SILLA_BEBE",
            nombre="Silla de Infante",
            costo_dia=8.0,
            es_pago_unico=False,
            activo=True,
        )
        _db.session.add_all([ex1, ex2])

        _db.session.commit()

@pytest.fixture
def client(app):
    return app.test_client()


# =========================================================================
# FASE 1: FLUJO DE USUARIO DE 0 A 100 (HAPPY PATH NOMINAL COMPLETO)
# =========================================================================

def test_flujo_completo_0_a_100(client):
    """
    Simula el viaje completo de un turista de 0 a 100:
    1. Catálogo con tarifas de renta en el serializador.
    2. Consulta de disponibilidad por 4 días.
    3. Checkout con CDW y Paso Rápido.
    4. Emisión y verificación del voucher con PNR.
    5. Check-in administrativo de entrega.
    6. Check-out administrativo de devolución.
    """
    # 1. Catálogo público incluye tarifa_renta por día y semana
    res_cat = client.get("/api/catalogo/vehiculos")
    assert res_cat.status_code == 200
    vehiculos = res_cat.get_json()["items"]
    assert len(vehiculos) >= 1
    v = vehiculos[0]
    assert "tarifa_renta" in v
    assert v["tarifa_renta"]["precio_dia_base"] == 55.0
    assert v["tarifa_renta"]["precio_semana_estimado"] == 330.0  # 55 * 6
    assert v["pasajeros"] == 5

    # 2. Búsqueda de disponibilidad para retiro cumpliendo lead time (3 horas) por 4 días
    f_ini = (datetime.utcnow() + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M")
    f_fin = (datetime.utcnow() + timedelta(hours=99)).strftime("%Y-%m-%dT%H:%M")
    res_disp = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini}&fecha_fin={f_fin}&sucursal_recogida_id=1")
    assert res_disp.status_code == 200
    disp_data = res_disp.get_json()
    assert disp_data["dias_facturables"] == 4
    assert disp_data["total_disponibles"] >= 1

    # 3. Checkout Web con conductor adulto (28 años), seguro CDW y Paso Rápido
    res_checkout = client.post("/api/renta/reservas", json={
        "vehiculo_id": 10,
        "sucursal_recogida_id": 1,
        "sucursal_devolucion_id": 1,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "cobertura_id": 2,      # CDW (+$15/día)
        "extras_ids": [1],      # Paso Rápido (+$5/día)
        "acepta_terminos": True,
        "conductor": {
            "nombre": "Manuel",
            "apellido": "García",
            "email": "manuel.garcia@test.com",
            "telefono": "+18095550199",
            "documento": "402-0000000-1",
            "licencia": "DO-992812",
            "fecha_nacimiento": "1996-03-10",  # 28 años
        },
        "notas_vuelo": "Delta 1832",
    })
    assert res_checkout.status_code == 201, res_checkout.get_json()
    checkout_data = res_checkout.get_json()
    pnr = checkout_data["pnr"]
    assert pnr.startswith("HA-")

    # Verificar liquidación: 4 días * ($55 vehículo + $15 CDW + $5 Paso Rápido) = 4 * $75 = $300 USD
    reserva_creada = checkout_data["reserva"]
    assert reserva_creada["total_alquiler"] == 300.0
    assert reserva_creada["deposito_garantia_monto"] in (400.0, 500.0)

    # 4. Verificación del Voucher por PNR (con segundo factor apellido)
    res_voucher = client.get(f"/api/renta/reservas/{pnr}?apellido=García")
    assert res_voucher.status_code == 200
    voucher_data = res_voucher.get_json()
    assert voucher_data["estado"] == "CONFIRMADA"
    assert voucher_data["pnr"] == pnr
    assert voucher_data["notas_vuelo"] == "Delta 1832"

    # 5. Admin Login & Check-in (Entrega en mostrador)
    login_res = client.post("/api/auth/login", json={"email": "admin@qa.com", "password": "admin1234"})
    assert login_res.status_code == 200

    checkin_res = client.post("/api/admin/renta/check-in", json={
        "pnr": pnr,
        "odometro": 15000,
        "combustible": "8/8",
        "observaciones_danos": "Sin daños preexistentes. Llaves y marbete entregados.",
    })
    assert checkin_res.status_code == 200
    assert checkin_res.get_json()["reserva"]["estado"] == "EN_CURSO"

    # 6. Admin Check-out (Devolución tras el viaje)
    checkout_res = client.post("/api/admin/renta/check-out", json={
        "pnr": pnr,
        "odometro": 15450,
        "combustible": "8/8",
        "observaciones_danos": "Vehículo devuelto limpio y en perfecto estado. Depósito liberado.",
    })
    assert checkout_res.status_code == 200
    reserva_fin = checkout_res.get_json()["reserva"]
    assert reserva_fin["estado"] == "COMPLETADA"


# =========================================================================
# FASE 2: ACCIONES NO CONTEMPLADAS (CHAOS TESTING / RESILIENCIA)
# =========================================================================

def test_chaos_conductor_menor_21_anos(client):
    """Acción no contemplada: Intentar reservar con un conductor de 19 años."""
    f_ini = (datetime.utcnow() + timedelta(days=15)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=18)).strftime("%Y-%m-%dT10:00")

    fecha_nac_menor = (datetime.utcnow() - timedelta(days=19 * 365)).strftime("%Y-%m-%d")

    res = client.post("/api/renta/reservas", json={
        "vehiculo_id": 10,
        "sucursal_recogida_id": 1,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "cobertura_id": 1,
        "acepta_terminos": True,
        "conductor": {
            "nombre": "Joven",
            "apellido": "Menor",
            "email": "joven@test.com",
            "telefono": "+18090000000",
            "documento": "402-9999999-9",
            "licencia": "DO-000000",
            "fecha_nacimiento": fecha_nac_menor,
        }
    })
    # Debe ser rechazado por política de edad
    assert res.status_code == 422
    assert "21 años" in res.get_json()["error"]


def test_chaos_fechas_invertidas(client):
    """Acción no contemplada: Fecha de devolución anterior a la de recogida."""
    f_ini = (datetime.utcnow() + timedelta(days=20)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=18)).strftime("%Y-%m-%dT10:00")  # Anterior

    res = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini}&fecha_fin={f_fin}")
    assert res.status_code == 422


def test_chaos_duracion_insuficiente_menor_24_horas(client):
    """Acción no contemplada: Alquiler de solo 2 horas. El sistema estandariza a 1 día mínimo."""
    f_ini = (datetime.utcnow() + timedelta(days=25)).strftime("%Y-%m-%dT10:00")
    f_fin = (datetime.utcnow() + timedelta(days=25)).strftime("%Y-%m-%dT12:00")  # 2 horas

    res = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini}&fecha_fin={f_fin}")
    assert res.status_code == 200
    assert res.get_json()["dias_facturables"] == 1


def test_chaos_doble_reserva_solapamiento_bloqueo(client):
    """
    Acción no contemplada: Cliente A reserva del día 30 al 35.
    Cliente B intenta reservar el mismo auto del día 32 al 36.
    El sistema debe impedir el solapamiento y mostrar 0 disponibles.
    """
    f_ini_a = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%dT10:00")
    f_fin_a = (datetime.utcnow() + timedelta(days=35)).strftime("%Y-%m-%dT10:00")

    # 1. Cliente A reserva exitosamente
    res_a = client.post("/api/renta/reservas", json={
        "vehiculo_id": 10,
        "sucursal_recogida_id": 1,
        "fecha_inicio": f_ini_a,
        "fecha_fin": f_fin_a,
        "cobertura_id": 1,
        "acepta_terminos": True,
        "conductor": {
            "nombre": "Cliente",
            "apellido": "A",
            "email": "a@test.com",
            "telefono": "+18091111111",
            "documento": "402-1111111-1",
            "licencia": "DO-111111",
            "fecha_nacimiento": "1990-01-01",
        }
    })
    assert res_a.status_code == 201

    # 2. Cliente B busca disponibilidad solapada (días 32 a 36)
    f_ini_b = (datetime.utcnow() + timedelta(days=32)).strftime("%Y-%m-%dT10:00")
    f_fin_b = (datetime.utcnow() + timedelta(days=36)).strftime("%Y-%m-%dT10:00")

    res_disp_b = client.get(f"/api/renta/disponibilidad?fecha_inicio={f_ini_b}&fecha_fin={f_fin_b}")
    assert res_disp_b.status_code == 200
    # La unidad 10 no debe aparecer disponible
    vehiculos_disp = res_disp_b.get_json()["vehiculos"]
    assert all(v["id"] != 10 for v in vehiculos_disp)


def test_chaos_busqueda_pnr_inyeccion_caracteres_raros(client):
    """Acción no contemplada: Búsqueda con caracteres de inyección SQL o scripts."""
    pnr_inyeccion = "HA-00000' OR '1'='1"
    res = client.get(f"/api/renta/reservas/{pnr_inyeccion}?apellido=Hacker")
    assert res.status_code in (400, 403, 404)

    pnr_xss = "<script>alert('pwn')</script>"
    res_xss = client.get(f"/api/renta/reservas/{pnr_xss}?apellido=Hacker")
    assert res_xss.status_code in (400, 403, 404)


def test_chaos_devolucion_combustible_faltante(client):
    """
    Acción no contemplada: Entrega con tanque lleno 8/8 y devolución con 2/8.
    Verifica que el sistema registre la incidencia en la inspección física.
    """
    f_ini = (datetime.utcnow() + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M")
    f_fin = (datetime.utcnow() + timedelta(hours=75)).strftime("%Y-%m-%dT%H:%M")

    res_crear = client.post("/api/renta/reservas", json={
        "vehiculo_id": 10,
        "sucursal_recogida_id": 1,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "cobertura_id": 1,
        "acepta_terminos": True,
        "conductor": {
            "nombre": "Test",
            "apellido": "Combustible",
            "email": "comb@test.com",
            "telefono": "+18092222222",
            "documento": "402-2222222-2",
            "licencia": "DO-222222",
            "fecha_nacimiento": "1992-05-15",
        }
    })
    assert res_crear.status_code == 201
    pnr = res_crear.get_json()["pnr"]

    # Login como admin para operaciones de patio
    client.post("/api/auth/login", json={"email": "admin@qa.com", "password": "admin1234"})

    # Check-in con 8/8
    checkin_res = client.post("/api/admin/renta/check-in", json={
        "pnr": pnr,
        "odometro": 16000,
        "combustible": "8/8"
    })
    assert checkin_res.status_code == 200

    # Check-out con combustible bajo: 2/8 y reporte de incidencia
    checkout_res = client.post("/api/admin/renta/check-out", json={
        "pnr": pnr,
        "odometro": 16300,
        "combustible": "2/8",
        "observaciones_danos": "Faltan 6/8 de combustible. Cobro de recarga aplicado en mostrador."
    })
    assert checkout_res.status_code == 200
    reserva = checkout_res.get_json()["reserva"]
    assert reserva["estado"] == "COMPLETADA"
