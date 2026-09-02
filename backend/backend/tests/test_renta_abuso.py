"""Suite de abuso: intenta hacer mas de lo que la politica propone.

ASERCION TRANSVERSAL: ningun request de este archivo devuelve 500. Una entrada
malformada del usuario es siempre un 4xx con mensaje accionable; un 500
significaria que una excepcion se escapo sin capturar.
"""
import os
os.environ.setdefault("SECRET_KEY",               "test-secret-key")
os.environ.setdefault("DB_USER",                  "root")
os.environ.setdefault("DB_PASSWORD",              "test")
os.environ.setdefault("WHATSAPP_API_KEY",         "dummy")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "dummy")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN",    "test-token")
os.environ.setdefault("GOOGLE_CLIENT_ID",         "dummy")
os.environ.setdefault("GOOGLE_CLIENT_SECRET",     "dummy")

from datetime import datetime, timedelta, date

import pytest
from flask import request

from backend import create_app, bcrypt
from backend.models import (
    db as _db, Rol, Usuario, Marca, Modelo, Vehiculo,
    Sucursal, TarifaRenta, CoberturaSeguro, ExtraServicio, ReservaRenta,
)
from backend.services import renta_politica as pol


# ---------------------------------------------------------------------------
# Infraestructura
# ---------------------------------------------------------------------------

ERRORES_DE_SERVIDOR = []


@pytest.fixture(scope="module")
def app():
    application = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {},
        "WTF_CSRF_ENABLED": False,
        "RATELIMIT_ENABLED": False,   # los limites se prueban aparte
    })

    # Debe registrarse antes de la primera peticion: Flask no admite anadir
    # after_request una vez que la app ha atendido algo.
    @application.after_request
    def _vigilar_5xx(response):
        if response.status_code >= 500:
            ERRORES_DE_SERVIDOR.append(
                (request.method, request.path, response.status_code))
        return response

    return application


@pytest.fixture(scope="module")
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def sin_errores_de_servidor(app):
    """Asercion transversal de la suite.

    Cada respuesta pasa por el vigilante registrado en la app: si algun intento
    de abuso provoca un 5xx es que una excepcion se escapo sin capturar, y eso
    es un fallo del blindaje aunque el test que lo disparo pase por otras razones.
    """
    marca_inicial = len(ERRORES_DE_SERVIDOR)
    yield
    nuevos = ERRORES_DE_SERVIDOR[marca_inicial:]
    assert not nuevos, (
        f"Entradas de usuario que produjeron un error de servidor: {nuevos}")


@pytest.fixture(scope="module", autouse=True)
def datos(app):
    with app.app_context():
        _db.create_all()

        admin_rol = Rol(id=1, nombre="ADMIN")
        _db.session.add_all([admin_rol, Rol(id=2, nombre="USUARIO_PUBLICO")])
        _db.session.flush()
        _db.session.add(Usuario(
            nombre="Admin", email="admin@abuso.test",
            password_hash=bcrypt.generate_password_hash("admin1234").decode(),
            rol_id=admin_rol.id))

        _db.session.add_all([
            Sucursal(id=1, nombre="Aeropuerto SDQ", codigo_aeropuerto="SDQ",
                     direccion="AILA", ciudad="Santo Domingo", activo=True),
            Sucursal(id=2, nombre="Piantini", direccion="Av. Lincoln",
                     ciudad="Santo Domingo", activo=True),
            # Sucursal cerrada: existe pero no debe poder reservarse.
            Sucursal(id=3, nombre="Santiago (cerrada)", direccion="Del Sol",
                     ciudad="Santiago", activo=False),
        ])
        _db.session.add_all([
            CoberturaSeguro(id=1, codigo="TPL_BASICO", nombre="Basica",
                            costo_dia=0, deposito_requerido=800,
                            reduccion_deposito_pct=0, deducible_monto=1000, activo=True),
            CoberturaSeguro(id=2, codigo="CDW_ESTANDAR", nombre="Estandar",
                            costo_dia=15, deposito_requerido=400,
                            reduccion_deposito_pct=50, deducible_monto=500, activo=True),
            CoberturaSeguro(id=3, codigo="TOTAL", nombre="Total",
                            costo_dia=25, deposito_requerido=150,
                            reduccion_deposito_pct=100, deducible_monto=0, activo=True),
            CoberturaSeguro(id=4, codigo="RETIRADA", nombre="Descontinuada",
                            costo_dia=5, deposito_requerido=500,
                            reduccion_deposito_pct=0, deducible_monto=500, activo=False),
        ])
        _db.session.add_all([
            ExtraServicio(id=1, codigo="SILLA_BEBE", nombre="Silla de bebe",
                          costo_dia=8, es_pago_unico=False, activo=True),
            ExtraServicio(id=2, codigo="PASO_RAPIDO", nombre="Paso Rapido",
                          costo_dia=5, es_pago_unico=False, activo=True),
            # Extra inactivo: pedirlo debe fallar, no ignorarse en silencio.
            ExtraServicio(id=9, codigo="OBSOLETO", nombre="Descontinuado",
                          costo_dia=3, es_pago_unico=False, activo=False),
        ])

        marca = Marca(nombre="TOYOTA", pais_origen="Japon")
        _db.session.add(marca); _db.session.flush()

        # Un SEDAN (deposito base 450) y una VAN (deposito base 800) para probar
        # que la fianza escala con el vehiculo (Regla 4).
        for i, (mod, cat, precio, deposito) in enumerate([
            ("COROLLA", "SEDAN", 40, 450),
            ("SIENNA",  "VAN",   75, 800),
        ], start=1):
            modelo = Modelo(nombre=mod, marca_id=marca.id, categoria=cat)
            _db.session.add(modelo); _db.session.flush()
            v = Vehiculo(
                id=i, modelo_id=modelo.id, anio=2024, vin=f"VIN{i:014d}XYZ",
                color="BLANCO", precio=25000, kilometraje=0,
                combustible="GASOLINA", transmision="AUTOMATICA",
                estado="DISPONIBLE", disponible_para="AMBOS",
                pasajeros=5, maletas_grandes=2, maletas_pequenas=2,
                tiene_aire_acondicionado=True)
            _db.session.add(v); _db.session.flush()
            _db.session.add(TarifaRenta(
                vehiculo_id=v.id, precio_dia_base=precio,
                deposito_garantia=deposito, moneda="USD", activo=True))

        # Vehiculo dedicado solo a venta: no debe aparecer ni reservarse en renta.
        modelo_v = Modelo(nombre="HILUX", marca_id=marca.id, categoria="PICKUP")
        _db.session.add(modelo_v); _db.session.flush()
        solo_venta = Vehiculo(
            id=3, modelo_id=modelo_v.id, anio=2024, vin="VIN00000000003XYZ",
            color="NEGRO", precio=40000, kilometraje=0, combustible="DIESEL",
            transmision="AUTOMATICA", estado="DISPONIBLE",
            disponible_para="VENTA", pasajeros=5, maletas_grandes=2,
            maletas_pequenas=2, tiene_aire_acondicionado=True)
        _db.session.add(solo_venta); _db.session.flush()
        _db.session.add(TarifaRenta(vehiculo_id=solo_venta.id, precio_dia_base=60,
                                    deposito_garantia=600, moneda="USD", activo=True))
        _db.session.commit()


def _f(horas):
    return (datetime.utcnow() + timedelta(hours=horas)).strftime("%Y-%m-%dT%H:%M")


def _payload(**over):
    base = {
        "vehiculo_id": 1,
        "sucursal_recogida_id": 1,
        "sucursal_devolucion_id": 1,
        "fecha_inicio": _f(48),
        "fecha_fin": _f(120),
        "cobertura_id": 1,
        "acepta_terminos": True,
        "conductor": {
            "nombre": "Ana", "apellido": "Perez",
            "email": "ana@test.com", "telefono": "8095551111",
            "documento": "00100000099", "licencia": "DO-11111",
            "fecha_nacimiento": (date.today() - timedelta(days=365 * 30)).isoformat(),
        },
    }
    if "conductor" in over:
        # Centinela explicito: `conductor=None` debe poder enviarse tal cual
        # para probar el rechazo, no caer al bloque por defecto.
        conductor = over.pop("conductor")
        base["conductor"] = {**base["conductor"], **conductor} if conductor else conductor
    base.update(over)
    return base


def _liberar_vehiculo(client, vehiculo_id):
    """Cancela las reservas vivas de una unidad para que el siguiente caso de
    la suite parta de un calendario limpio."""
    with client.application.app_context():
        activas = ReservaRenta.query.filter(
            ReservaRenta.vehiculo_id == vehiculo_id,
            ReservaRenta.estado.in_(("CONFIRMADA", "EN_CURSO")),
        ).all()
        for r in activas:
            r.estado = "CANCELADA"
            r.cancelado_por = "SISTEMA"
            r.cancelacion_motivo = "Limpieza entre casos de prueba"
        veh = _db.session.get(Vehiculo, vehiculo_id)
        if veh and veh.estado == "RENTADO":
            veh.estado = "DISPONIBLE"
        _db.session.commit()


def _reservar(client, **over):
    return client.post("/api/renta/reservas", json=_payload(**over))


# ===========================================================================
# 1. COERCION: entrada basura debe ser 4xx, nunca 500
# ===========================================================================

@pytest.mark.parametrize("valor", ["abc", {}, [], True, 1.5, None, "1e400", -1, 0])
def test_vehiculo_id_basura_no_produce_500(client, valor):
    res = _reservar(client, vehiculo_id=valor)
    assert res.status_code == 400, res.get_json()


@pytest.mark.parametrize("valor", [12345, None, "no-es-fecha", {}, [], "2026-13-45"])
def test_fecha_basura_no_produce_500(client, valor):
    res = _reservar(client, fecha_inicio=valor)
    assert res.status_code == 400, res.get_json()


@pytest.mark.parametrize("valor", ["abc", {"id": 1}, "1,2,3"])
def test_extras_no_lista_no_produce_500(client, valor):
    """`for item in "abc"` iteraba caracteres y reventaba con un 500."""
    res = _reservar(client, extras_ids=valor)
    assert res.status_code == 400, res.get_json()


def test_conductor_ausente_o_malformado(client):
    assert _reservar(client, conductor=None).status_code == 400
    assert _reservar(client, conductor={"email": "no-es-email"}).status_code == 400


def test_disponibilidad_sin_parametros_no_produce_500(client):
    assert client.get("/api/renta/disponibilidad").status_code == 400
    assert client.get("/api/renta/disponibilidad?fecha_inicio=x&fecha_fin=y").status_code == 400


def test_filtros_invalidos_rechazados(client):
    url = f"/api/renta/disponibilidad?fecha_inicio={_f(48)}&fecha_fin={_f(120)}"
    assert client.get(url + "&categoria=DROP+TABLE").status_code == 400
    assert client.get(url + "&transmision=COHETE").status_code == 400
    assert client.get(url + "&pasajeros=abc").status_code == 400


# ===========================================================================
# 2. POLITICA TEMPORAL
# ===========================================================================

def test_no_se_puede_reservar_en_el_pasado(client):
    res = _reservar(client, fecha_inicio=_f(-240), fecha_fin=_f(-120))
    assert res.status_code == 422
    assert res.get_json()["codigo"] in ("FECHA_PASADA", "HORIZONTE_EXCEDIDO")


def test_duracion_menor_a_24h_rechazada(client):
    """El widget validaba 23 h en cliente; la API no validaba nada."""
    res = _reservar(client, fecha_inicio=_f(48), fecha_fin=_f(65))
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "DURACION_INSUFICIENTE"


def test_lead_time_minimo(client):
    res = _reservar(client, fecha_inicio=_f(1), fecha_fin=_f(30))
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "LEAD_TIME_INSUFICIENTE"


def test_duracion_absurda_rechazada(client):
    res = _reservar(client, fecha_inicio=_f(48), fecha_fin=_f(24 * 400))
    assert res.status_code == 422
    assert res.get_json()["codigo"] in ("DURACION_EXCEDIDA", "HORIZONTE_EXCEDIDO")


def test_horizonte_maximo(client):
    res = _reservar(client, fecha_inicio=_f(24 * 500), fecha_fin=_f(24 * 504))
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "HORIZONTE_EXCEDIDO"


# ===========================================================================
# 3. CARRITO
# ===========================================================================

def test_cantidad_de_extra_desorbitada(client):
    res = _reservar(client, extras_ids=[{"id": 1, "cantidad": 999999}])
    assert res.status_code == 400
    assert res.get_json()["codigo"] == "FUERA_DE_RANGO"


def test_extra_repetido_se_agrega_no_se_duplica(client):
    """[1,1,1] son 3 sillas, no 3 filas del mismo extra."""
    res = _reservar(client, extras_ids=[1, 1, 1], fecha_inicio=_f(500), fecha_fin=_f(572))
    assert res.status_code == 201, res.get_json()
    extras = res.get_json()["reserva"]["extras"]
    assert len(extras) == 1
    assert extras[0]["cantidad"] == 3


def test_extra_inactivo_falla_en_vez_de_ignorarse(client):
    """Antes se ignoraba en silencio y el cliente pagaba un total incompleto."""
    res = _reservar(client, extras_ids=[9])
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "EXTRA_NO_DISPONIBLE"


def test_sucursal_inactiva_rechazada(client):
    res = _reservar(client, sucursal_recogida_id=3)
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "SUCURSAL_INACTIVA"


def test_cobertura_inactiva_rechazada(client):
    res = _reservar(client, cobertura_id=4)
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "COBERTURA_NO_DISPONIBLE"


def test_vehiculo_solo_venta_no_es_rentable(client):
    res = _reservar(client, vehiculo_id=3)
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "VEHICULO_NO_RENTABLE"


# ===========================================================================
# 4. REGLAS QUE ANTES SOLO VIVIAN EN REACT
# ===========================================================================

def test_reserva_sin_aceptar_terminos_rechazada(client):
    """La aceptacion vivia solo en React y venia pre-marcada en true."""
    for valor in (None, False):
        res = _reservar(client, acepta_terminos=valor)
        assert res.status_code in (400, 422)
        assert res.get_json()["codigo"] in ("TERMINOS_NO_ACEPTADOS", "CAMPO_REQUERIDO")


def test_menor_de_21_rechazado(client):
    res = _reservar(client, conductor={
        "fecha_nacimiento": (date.today() - timedelta(days=365 * 19)).isoformat()})
    assert res.status_code == 422
    assert res.get_json()["codigo"] == "EDAD_INSUFICIENTE"


def test_terminos_quedan_registrados_con_version(client):
    res = _reservar(client, fecha_inicio=_f(700), fecha_fin=_f(772),
                    conductor={"documento": "00100000077", "email": "t@test.com"})
    assert res.status_code == 201, res.get_json()
    with client.application.app_context():
        reserva = ReservaRenta.query.filter_by(pnr=res.get_json()["pnr"]).first()
        assert reserva.terminos_aceptados is True
        assert reserva.terminos_version == pol.TERMINOS_VERSION
        assert reserva.terminos_aceptados_en is not None


# ===========================================================================
# 5. REGLA 4 - deposito por categoria x cobertura
# ===========================================================================

@pytest.mark.parametrize("vehiculo_id,cobertura_id,esperado", [
    (1, 1, 450.0),   # SEDAN base 450, TPL 0 %
    (1, 2, 225.0),   # SEDAN base 450, CDW 50 %
    (1, 3, 200.0),   # SEDAN base 450, TOTAL 100 % -> piso DEPOSITO_MINIMO
    (2, 1, 800.0),   # VAN base 800, TPL 0 %
    (2, 2, 400.0),   # VAN base 800, CDW 50 %
])
def test_deposito_escala_con_el_vehiculo(client, vehiculo_id, cobertura_id, esperado):
    """Antes toda reserva usaba el deposito de la cobertura: una VAN y un
    Spark pedian la misma fianza."""
    res = client.post("/api/renta/cotizar", json=_payload(
        vehiculo_id=vehiculo_id, cobertura_id=cobertura_id))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["deposito_garantia"] == esperado


def test_recargo_young_driver(client):
    joven = _payload(conductor={
        "fecha_nacimiento": (date.today() - timedelta(days=365 * 23 + 6)).isoformat()})
    res = client.post("/api/renta/cotizar", json=joven).get_json()
    assert res["es_young_driver"] is True
    assert res["recargo_young_driver"] == float(pol.YOUNG_DRIVER_CARGO_DIA) * res["dias_facturables"]

    mayor = _payload(conductor={
        "fecha_nacimiento": (date.today() - timedelta(days=365 * 40)).isoformat()})
    res2 = client.post("/api/renta/cotizar", json=mayor).get_json()
    assert res2["es_young_driver"] is False
    assert res2["recargo_young_driver"] == 0.0


# ===========================================================================
# 6. PARIDAD COTIZACION <-> RESERVA (sostiene "una sola fuente de verdad")
# ===========================================================================

@pytest.mark.parametrize("extras,cobertura,anios", [
    ([],            1, 30),
    ([1],           2, 30),
    ([1, 2],        3, 23),          # con recargo young driver
    ([{"id": 1, "cantidad": 2}], 2, 45),
])
def test_cotizar_y_reservar_coinciden_al_centimo(client, extras, cobertura, anios):
    """Si divergen, hay logica de precios duplicada en algun sitio."""
    ini, fin = _f(900), _f(996)
    datos = dict(fecha_inicio=ini, fecha_fin=fin, extras_ids=extras,
                 cobertura_id=cobertura, vehiculo_id=2,
                 conductor={
                     "fecha_nacimiento": (date.today() - timedelta(days=365 * anios)).isoformat(),
                     "documento": f"0010000{anios:04d}",
                     "email": f"paridad{anios}@test.com"})

    cot = client.post("/api/renta/cotizar", json=_payload(**datos))
    assert cot.status_code == 200, cot.get_json()
    c = cot.get_json()

    res = _reservar(client, **datos)
    assert res.status_code == 201, res.get_json()
    r = res.get_json()["reserva"]

    assert c["dias_facturables"]     == r["total_dias"]
    assert c["total_alquiler"]       == r["total_alquiler"]
    assert c["deposito_garantia"]    == r["deposito_garantia_monto"]
    assert c["subtotal_vehiculo"]    == r["desglose"]["subtotal_vehiculo"]
    assert c["subtotal_cobertura"]   == r["desglose"]["subtotal_cobertura"]
    assert c["subtotal_extras"]      == r["desglose"]["subtotal_extras"]
    assert c["recargo_young_driver"] == r["desglose"]["recargo_young_driver"]

    # Limpieza: liberar el calendario para el siguiente caso de la matriz.
    client.post(f"/api/renta/reservas/{r['pnr']}/cancelar",
                json={"apellido": "Perez", "motivo": "Fin de la prueba de paridad"})


# ===========================================================================
# 7. PRIVACIDAD DEL VOUCHER
# ===========================================================================

def test_voucher_exige_segundo_factor_y_no_confirma_existencia(client):
    res = _reservar(client, fecha_inicio=_f(1100), fecha_fin=_f(1180),
                    conductor={"documento": "00100000055", "email": "v@test.com"})
    assert res.status_code == 201
    pnr = res.get_json()["pnr"]

    sin_factor = client.get(f"/api/renta/reservas/{pnr}")
    assert sin_factor.status_code == 403

    malo = client.get(f"/api/renta/reservas/{pnr}?apellido=Incorrecto")
    inexistente = client.get("/api/renta/reservas/HA-00000?apellido=Incorrecto")
    # Misma respuesta exacta: un atacante no puede distinguir un PNR valido.
    assert malo.status_code == inexistente.status_code == 403
    assert malo.get_json() == inexistente.get_json()

    bueno = client.get(f"/api/renta/reservas/{pnr}?apellido=perez")   # sin distinguir caso
    assert bueno.status_code == 200
    conductor = bueno.get_json()["conductor"]
    assert conductor["documento"].startswith("*")
    assert "fecha_nacimiento" not in conductor
    assert conductor["licencia"].startswith("*")


def test_voucher_acepta_ultimos_4_del_documento(client):
    res = _reservar(client, fecha_inicio=_f(1300), fecha_fin=_f(1380),
                    conductor={"documento": "00100000066", "email": "d4@test.com"})
    pnr = res.get_json()["pnr"]
    assert client.get(f"/api/renta/reservas/{pnr}?doc4=0066").status_code == 200
    assert client.get(f"/api/renta/reservas/{pnr}?doc4=9999").status_code == 403


# ===========================================================================
# 8. MAQUINA DE ESTADOS
# ===========================================================================

def test_cancelar_libera_el_calendario(client):
    ini, fin = _f(1500), _f(1580)
    res = _reservar(client, fecha_inicio=ini, fecha_fin=fin,
                    conductor={"documento": "00100000088", "email": "c@test.com"})
    pnr = res.get_json()["pnr"]

    ocupado = client.get(f"/api/renta/disponibilidad?fecha_inicio={ini}&fecha_fin={fin}")
    ids_ocupado = [v["id"] for v in ocupado.get_json()["vehiculos"]]
    assert 1 not in ids_ocupado

    cancel = client.post(f"/api/renta/reservas/{pnr}/cancelar",
                         json={"apellido": "Perez", "motivo": "Cambio de planes"})
    assert cancel.status_code == 200
    assert cancel.get_json()["reserva"]["estado"] == "CANCELADA"

    libre = client.get(f"/api/renta/disponibilidad?fecha_inicio={ini}&fecha_fin={fin}")
    assert 1 in [v["id"] for v in libre.get_json()["vehiculos"]]

    # Una reserva cancelada no se puede volver a cancelar.
    repetir = client.post(f"/api/renta/reservas/{pnr}/cancelar",
                          json={"apellido": "Perez"})
    assert repetir.status_code == 422
    assert repetir.get_json()["codigo"] == "TRANSICION_INVALIDA"


def test_cancelar_exige_segundo_factor(client):
    res = _reservar(client, fecha_inicio=_f(1700), fecha_fin=_f(1780),
                    conductor={"documento": "00100000111", "email": "x@test.com"})
    pnr = res.get_json()["pnr"]
    assert client.post(f"/api/renta/reservas/{pnr}/cancelar",
                       json={"apellido": "Ajeno"}).status_code == 403


def test_tope_de_reservas_activas_por_conductor(client):
    """Control anti-abuso inmune al NAT: se cuenta por documento, no por IP."""
    doc = "00100000222"
    creadas = []
    for i in range(pol.RESERVAS_ACTIVAS_MAXIMAS):
        r = _reservar(client, vehiculo_id=(1 if i % 2 == 0 else 2),
                      fecha_inicio=_f(2000 + i * 200), fecha_fin=_f(2080 + i * 200),
                      conductor={"documento": doc, "email": "tope@test.com"})
        assert r.status_code == 201, r.get_json()
        creadas.append(r.get_json()["pnr"])

    extra = _reservar(client, fecha_inicio=_f(3000), fecha_fin=_f(3080),
                      conductor={"documento": doc, "email": "tope@test.com"})
    assert extra.status_code == 409
    assert extra.get_json()["codigo"] == "DEMASIADAS_RESERVAS_ACTIVAS"

    for pnr in creadas:
        client.post(f"/api/renta/reservas/{pnr}/cancelar",
                    json={"apellido": "Perez", "motivo": "Limpieza de la prueba"})


def test_doble_reserva_del_mismo_vehiculo_en_las_mismas_fechas(client):
    ini, fin = _f(4000), _f(4080)
    primera = _reservar(client, fecha_inicio=ini, fecha_fin=fin,
                        conductor={"documento": "00100000333", "email": "p1@test.com"})
    assert primera.status_code == 201

    segunda = _reservar(client, fecha_inicio=ini, fecha_fin=fin,
                        conductor={"documento": "00100000444", "email": "p2@test.com"})
    assert segunda.status_code == 409
    assert segunda.get_json()["codigo"] == "VEHICULO_OCUPADO"


# ===========================================================================
# 9. OPERACION DE MOSTRADOR
# ===========================================================================

@pytest.fixture()
def admin(client):
    client.post("/api/auth/login", json={"email": "admin@abuso.test",
                                         "password": "admin1234"})
    yield client
    client.post("/api/auth/logout")


def _reserva_lista_para_entregar(client, doc):
    _liberar_vehiculo(client, 2)
    res = _reservar(client, vehiculo_id=2, fecha_inicio=_f(3), fecha_fin=_f(27),
                    conductor={"documento": doc, "email": f"{doc}@test.com"})
    assert res.status_code == 201, res.get_json()
    return res.get_json()["pnr"]


def test_odometro_cero_es_valido(admin):
    """`if not odometro` rechazaba el 0: un auto nuevo no podia entregarse."""
    pnr = _reserva_lista_para_entregar(admin, "00100000501")
    res = admin.post("/api/admin/renta/check-in",
                     json={"pnr": pnr, "odometro": 0, "combustible": "8/8"})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["reserva"]["estado"] == "EN_CURSO"
    admin.post("/api/admin/renta/check-out",
               json={"pnr": pnr, "odometro": 120, "combustible": "8/8"})


def test_check_in_fuera_de_ventana(admin):
    _liberar_vehiculo(admin, 2)
    res = _reservar(admin, vehiculo_id=2, fecha_inicio=_f(24 * 60), fecha_fin=_f(24 * 63),
                    conductor={"documento": "00100000502", "email": "v2@test.com"})
    assert res.status_code == 201, res.get_json()
    pnr = res.get_json()["pnr"]
    r = admin.post("/api/admin/renta/check-in", json={"pnr": pnr, "odometro": 100})
    assert r.status_code == 422
    assert r.get_json()["codigo"] == "CHECKIN_FUERA_DE_VENTANA"


def test_check_out_sin_check_in_previo(admin):
    pnr = _reserva_lista_para_entregar(admin, "00100000503")
    r = admin.post("/api/admin/renta/check-out", json={"pnr": pnr, "odometro": 500})
    assert r.status_code == 422
    assert r.get_json()["codigo"] == "TRANSICION_INVALIDA"


def test_odometro_regresivo_rechazado(admin):
    pnr = _reserva_lista_para_entregar(admin, "00100000504")
    admin.post("/api/admin/renta/check-in",
               json={"pnr": pnr, "odometro": 5000, "combustible": "8/8"})
    r = admin.post("/api/admin/renta/check-out",
                   json={"pnr": pnr, "odometro": 4000, "combustible": "8/8"})
    assert r.status_code == 422
    assert r.get_json()["codigo"] == "ODOMETRO_REGRESIVO"
    admin.post("/api/admin/renta/check-out",
               json={"pnr": pnr, "odometro": 5300, "combustible": "8/8"})


def test_penalidad_por_combustible_faltante(admin):
    """Regla 5: devolver a 4/8 tras entregar a 8/8 son 4 octavos."""
    pnr = _reserva_lista_para_entregar(admin, "00100000505")
    admin.post("/api/admin/renta/check-in",
               json={"pnr": pnr, "odometro": 1000, "combustible": "8/8"})
    r = admin.post("/api/admin/renta/check-out",
                   json={"pnr": pnr, "odometro": 1400, "combustible": "4/8"})
    assert r.status_code == 200, r.get_json()
    liq = r.get_json()["liquidacion"]
    assert liq["octavos_faltantes"] == 4
    assert liq["cargo_combustible"] == 4 * float(pol.CARGO_COMBUSTIBLE_POR_OCTAVO)
    assert liq["total_final"] > 0
    assert liq["deposito_a_retener"] == liq["total_penalidades"]


def test_check_in_vuelve_el_vehiculo_no_vendible(admin):
    """Cierre del hueco mas agudo: vender un auto que rueda con un turista."""
    pnr = _reserva_lista_para_entregar(admin, "00100000506")
    admin.post("/api/admin/renta/check-in",
               json={"pnr": pnr, "odometro": 2000, "combustible": "8/8"})

    venta = admin.post("/api/reservas/", json={"vehiculo_id": 2})
    assert venta.status_code in (409, 422)

    admin.post("/api/admin/renta/check-out",
               json={"pnr": pnr, "odometro": 2400, "combustible": "8/8"})


def test_nivel_de_combustible_invalido(admin):
    pnr = _reserva_lista_para_entregar(admin, "00100000507")
    r = admin.post("/api/admin/renta/check-in",
                   json={"pnr": pnr, "odometro": 10, "combustible": "LLENO"})
    assert r.status_code == 400
    assert r.get_json()["codigo"] == "VALOR_NO_PERMITIDO"


def test_tarifa_negativa_rechazada(admin):
    r = admin.post("/api/admin/renta/tarifas",
                   json={"vehiculo_id": 1, "precio_dia_base": -50})
    assert r.status_code == 400
    assert r.get_json()["codigo"] == "FUERA_DE_RANGO"


def test_tarifa_no_reconvierte_el_vehiculo_en_silencio(admin):
    """Antes, cambiar un precio ponia disponible_para='AMBOS' sin avisar."""
    with admin.application.app_context():
        Vehiculo.query.filter_by(id=1).update({"disponible_para": "RENTA"})
        _db.session.commit()

    r = admin.post("/api/admin/renta/tarifas",
                   json={"vehiculo_id": 1, "precio_dia_base": 42})
    assert r.status_code == 200, r.get_json()

    with admin.application.app_context():
        assert _db.session.get(Vehiculo, 1).disponible_para == "RENTA"
        Vehiculo.query.filter_by(id=1).update({"disponible_para": "AMBOS"})
        _db.session.commit()


# ===========================================================================
# 10. VENTA <-> RENTA
# ===========================================================================

def test_no_se_vende_un_auto_con_renta_futura(admin):
    _liberar_vehiculo(admin, 1)
    ini, fin = _f(5000), _f(5080)
    res = _reservar(admin, vehiculo_id=1, fecha_inicio=ini, fecha_fin=fin,
                    conductor={"documento": "00100000601", "email": "vr@test.com"})
    assert res.status_code == 201
    pnr = res.get_json()["pnr"]

    venta = admin.post("/api/reservas/", json={"vehiculo_id": 1})
    assert venta.status_code == 409
    assert venta.get_json()["codigo"] == "TIENE_RENTAS_FUTURAS"

    admin.post(f"/api/renta/reservas/{pnr}/cancelar",
               json={"apellido": "Perez", "motivo": "Limpieza de la prueba"})
