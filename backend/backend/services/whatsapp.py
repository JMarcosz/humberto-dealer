"""Servicio WhatsApp Business API — Meta Cloud API oficial.

Automatizaciones implementadas (13):
  1  Bienvenida + Menú Principal
  2  Inventario / Catálogo
  3  Cotización paso a paso
  4  Información General y Ubicación
  5  Hablar con Asesor (bot se pausa)
  6  Trade-in
  7  Requisitos de Financiamiento
  8  Importaciones Directas
  9  Garantía e Historial (Carfax)
  10 Agendar Test Drive / Cita
  11 Estatus de Traspaso y Placa
  12 Fuera de Horario
  13 Seguimiento 24 horas
"""
import logging
import re
import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import requests
from flask import current_app
from ..models import db, Vehiculo, Marca, Modelo

log = logging.getLogger(__name__)

GRAPH_URL = "https://graph.facebook.com/v22.0"
TZ_RD     = ZoneInfo("America/Santo_Domingo")

# Horario de atención: clave = día semana (0=Lun), valor = (apertura, cierre) en horas
HORARIO = {
    0: (9, 19), 1: (9, 19), 2: (9, 19),
    3: (9, 19), 4: (9, 19), 5: (9, 17),
    # 6 = domingo: cerrado (no aparece)
}


MENU_PRINCIPAL = (
    "Bienvenido a *Humberto Auto Import* el que te monta fácil. 🚗\n\n"
    "¿Cómo podemos ayudarte hoy?\n\n"
    "1️⃣ Ver inventario disponible\n"
    "2️⃣ Cotizar un vehículo específico\n"
    "3️⃣ Ver ubicación, horarios y financiamiento\n"
    "4️⃣ Hablar con un asesor\n"
    "5️⃣ Recepción de vehículos (Trade-in)\n"
    "6️⃣ Requisitos de financiamiento\n"
    "7️⃣ Importaciones directas\n"
    "8️⃣ Garantía e historial (Carfax)\n"
    "9️⃣ Agendar Test Drive o Cita\n"
    "🔟 Estatus de Traspaso y Placa\n\n"
    "_Escribe el número de la opción._"
)

# ── Estado de sesiones en memoria ─────────────────────────────────────────────
# { numero: { estado, cotizacion, nombre_cliente, inicio,
#             historial, ultimo_cliente_msg, pendiente_followup,
#             followup_enviado, fuera_horario_dia } }
_sesiones: dict = {}
_lock = threading.Lock()

# ── Hilo de seguimiento 24 h ──────────────────────────────────────────────────
_followup_started = False
_app_ref          = None


def _nueva_sesion() -> dict:
    return {
        "estado":             "MENU",
        "cotizacion":         {},
        "nombre_cliente":     None,
        "inicio":             datetime.now(),
        "historial":          [],
        "ultimo_cliente_msg": datetime.now(),
        "pendiente_followup": False,
        "followup_enviado":   False,
        "fuera_horario_dia":  None,
    }


def _en_horario() -> bool:
    ahora = datetime.now(TZ_RD)
    rango = HORARIO.get(ahora.weekday())
    if not rango:
        return False
    return rango[0] <= ahora.hour < rango[1]


def start_followup_thread(app) -> None:
    """Iniciar hilo daemon que envía el seguimiento de 24 h. Llamar desde create_app()."""
    global _followup_started, _app_ref
    if _followup_started:
        return
    _app_ref = app
    _followup_started = True
    t = threading.Thread(target=_followup_worker, daemon=True, name="wa-followup")
    t.start()
    log.info("WhatsApp follow-up thread iniciado")


def _followup_worker() -> None:
    while True:
        time.sleep(1800)  # revisar cada 30 min
        try:
            with _app_ref.app_context():
                _procesar_followups()
        except Exception as exc:
            log.error("followup_worker: %s", exc)


def _procesar_followups() -> None:
    ahora = datetime.now()
    with _lock:
        pendientes = [
            (num, ses) for num, ses in _sesiones.items()
            if ses["pendiente_followup"]
            and not ses["followup_enviado"]
            and (ahora - ses["ultimo_cliente_msg"]) >= timedelta(hours=24)
        ]
    for num, ses in pendientes:
        try:
            svc = WhatsAppService()
            svc.enviar_texto(num,
                "👋 ¡Hola! Te escribimos de *Humberto Auto Import* para hacerte seguimiento.\n\n"
                "¿Pudiste revisar las opciones de vehículos que te compartimos? 🚗\n\n"
                "Recuerda que *nuestro inventario rota rápido* y no queremos "
                "que pierdas el modelo que te interesó. 😊\n\n"
                "Escribe *menu* para volver al menú o dinos en qué podemos ayudarte."
            )
            with _lock:
                ses["followup_enviado"]   = True
                ses["pendiente_followup"] = False
        except Exception as exc:
            log.error("followup para %s: %s", num, exc)


# ─────────────────────────────────────────────────────────────────────────────
class WhatsAppService:

    def __init__(self):
        self.api_key        = current_app.config["WHATSAPP_API_KEY"]
        self.phone_id       = current_app.config["WHATSAPP_PHONE_NUMBER_ID"]
        self.base_url       = f"{GRAPH_URL}/{self.phone_id}/messages"
        self.headers        = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type":  "application/json",
        }
        self.owner_number   = current_app.config.get("WHATSAPP_OWNER_NUMBER", "")
        self.catalogo_url   = current_app.config.get("CATALOG_URL", "")
        self.maps_url       = current_app.config.get("GOOGLE_MAPS_LINK", "")
        self.dealer_address = current_app.config.get("DEALER_ADDRESS", "")

    # ── Envíos ────────────────────────────────────────────────────────────────

    def enviar_texto(self, destinatario: str, texto: str) -> bool:
        payload = {
            "messaging_product": "whatsapp",
            "to":   destinatario,
            "type": "text",
            "text": {"body": texto},
        }
        try:
            r = requests.post(self.base_url, json=payload, headers=self.headers, timeout=10)
            r.raise_for_status()
            return True
        except requests.RequestException as exc:
            log.error("enviar_texto → %s: %s", destinatario, exc)
            return False

    def enviar_ubicacion(self, destinatario: str) -> bool:
        payload = {
            "messaging_product": "whatsapp",
            "to":   destinatario,
            "type": "location",
            "location": {
                "latitude":  current_app.config.get("DEALER_LAT", 18.4861),
                "longitude": current_app.config.get("DEALER_LNG", -69.9312),
                "name":      "Humberto Auto Import",
                "address":   self.dealer_address,
            },
        }
        try:
            r = requests.post(self.base_url, json=payload, headers=self.headers, timeout=10)
            r.raise_for_status()
            return True
        except requests.RequestException as exc:
            log.error("enviar_ubicacion → %s: %s", destinatario, exc)
            return False

    # ── Punto de entrada ──────────────────────────────────────────────────────

    def procesar_mensaje(self, mensaje: dict, metadata: dict) -> None:
        tipo  = mensaje.get("type")
        from_ = mensaje.get("from")

        # Solo procesar texto; los archivos (fotos de trade-in, etc.) se aceptan sin respuesta extra
        if tipo not in ("text", "image", "document", "audio", "video"):
            return

        texto = (mensaje.get("text", {}).get("body", "") or "").strip() if tipo == "text" else ""

        with _lock:
            es_nuevo = from_ not in _sesiones
            if es_nuevo:
                _sesiones[from_] = _nueva_sesion()
            else:
                _sesiones[from_]["ultimo_cliente_msg"] = datetime.now()

        ses = _sesiones[from_]
        if texto:
            ses["historial"].append(f"Cliente: {texto}")

        # Notificación de cliente nuevo a John
        if es_nuevo:
            self._notificar_cliente_nuevo(from_, texto or "[archivo]")

        # Bot pausado → reenviar a John sin responder al cliente
        if ses["estado"] == "HUMAN":
            if texto:
                self._notificar_respuesta_cliente(from_, texto)
            return

        # ── Automatización 12: Fuera de horario ──────────────────────────────
        if not _en_horario():
            hoy = str(datetime.now(TZ_RD).date())
            if ses["fuera_horario_dia"] != hoy:
                ses["fuera_horario_dia"] = hoy
                self.enviar_texto(from_,
                    "🌙 Hola, en este momento estamos *fuera de nuestro horario de atención*.\n\n"
                    "⏰ *Horario:*\n"
                    "Lun-Vie: 9:00 AM – 7:00 PM\n"
                    "Sábado: 9:00 AM – 5:00 PM\n"
                    "Domingo: Cerrado\n\n"
                    "Pero tu mensaje es importante para nosotros. 📝\n"
                    "Por favor *déjanos tu consulta aquí* y será "
                    "lo primero que respondamos cuando abramos. "
                    "¡Gracias por contactar a *Humberto Auto Import*! 🚗"
                )
            return

        # Palabra clave para volver al menú desde cualquier estado
        t = texto.strip().lower()
        if t in ("menu", "menú", "menus", "menús", "0", "volver", "inicio", "regresar"):
            ses["estado"] = "MENU"
            self.enviar_texto(from_, MENU_PRINCIPAL)
            return

        # Palabra clave de ubicación desde cualquier estado
        if t in ("ubicacion", "ubicación", "donde quedan", "donde están", "mapa"):
            self.enviar_ubicacion(from_)
            self.enviar_texto(from_,
                f"📍 *{self.dealer_address}*\n"
                f"🗺️ {self.maps_url}\n\n"
                "⏰ Lun-Vie 9AM-7PM | Sáb 9AM-5PM"
            )
            return

        self._enrutar(from_, texto, ses)

    # ── Enrutador de estados ──────────────────────────────────────────────────

    def _enrutar(self, from_: str, texto: str, ses: dict) -> None:
        estado = ses["estado"]
        t      = texto.strip().lower()

        # ── MENÚ PRINCIPAL ────────────────────────────────────────────────────
        if estado == "MENU":
            palabras_saludo = (
                "hola", "buenos", "buenas", "hey", "hi",
                "buen dia", "buen día", "info", "información",
                "informacion", "ayuda", "help", "start",
            )
            if any(k in t for k in palabras_saludo) or t == "":
                self.enviar_texto(from_, MENU_PRINCIPAL)
                return

            # Palabras clave que disparan opciones sin necesidad del número
            if any(k in t for k in ("trade", "cambiar mi carro", "carro usado",
                                     "cambio de carro", "recibir mi vehículo")):
                self._opcion_5(from_, ses); return
            if any(k in t for k in ("financiamiento", "financiar", "crédito",
                                     "credito", "préstamo", "prestamo", "requisito")):
                self._opcion_6(from_, ses); return
            if any(k in t for k in ("garantía", "garantia", "carfax", "historial")):
                self._opcion_8(from_, ses); return
            if any(k in t for k in ("test drive", "testdrive", "cita",
                                     "quiero ir", "ver en persona", "visitarlos")):
                self._opcion_9(from_, ses); return
            if any(k in t for k in ("traspaso", "placa", "mis papeles", "estatus")):
                self._opcion_10(from_, ses); return
            if any(k in t for k in ("importar", "importación", "importacion",
                                     "bajo pedido", "traer del exterior")):
                self._opcion_7(from_, ses); return
            if any(k in t for k in ("asesor", "agente", "persona", "humano",
                                     "vendedor", "quiero hablar con")):
                self._opcion_4(from_, ses); return

            opciones = {
                "1": self._opcion_1, "2": self._opcion_2, "3":  self._opcion_3,
                "4": self._opcion_4, "5": self._opcion_5, "6":  self._opcion_6,
                "7": self._opcion_7, "8": self._opcion_8, "9":  self._opcion_9,
                "10": self._opcion_10,
            }
            if t in opciones:
                opciones[t](from_, ses)
                return

            # Intentar buscar vehículo por nombre en la DB
            resultado = self._buscar_vehiculo(texto)
            if resultado:
                self.enviar_texto(from_, resultado)
            else:
                self.enviar_texto(from_, "No entendí tu mensaje. 😅\n\n" + MENU_PRINCIPAL)

        # ── COTIZACIÓN paso 2: año ────────────────────────────────────────────
        elif estado == "COT_VEHICULO":
            ses["cotizacion"]["vehiculo"] = texto
            ses["estado"] = "COT_ANIO"
            self.enviar_texto(from_,
                "📅 ¿Qué *año de preferencia* buscas?\n\n"
                "_(Ejemplo: 2022, 2023, o escribe_ *cualquiera* _si es flexible)_"
            )

        # ── COTIZACIÓN paso 3: tipo entrega ───────────────────────────────────
        elif estado == "COT_ANIO":
            ses["cotizacion"]["anio"] = texto
            ses["estado"] = "COT_TIPO"
            self.enviar_texto(from_,
                "🚚 ¿Buscas:\n\n"
                "1️⃣ Entrega inmediata (del inventario actual)\n"
                "2️⃣ Bajo pedido (importación directa)\n\n"
                "Escribe *1* o *2*."
            )

        # ── COTIZACIÓN paso 4: confirmación ───────────────────────────────────
        elif estado == "COT_TIPO":
            tipo_entrega = "Entrega inmediata" if t in ("1", "inmediata", "inmediato") else "Bajo pedido"
            ses["cotizacion"]["tipo"] = tipo_entrega
            cot = ses["cotizacion"]
            es_import = cot.get("flujo") == "importacion"

            self.enviar_texto(from_,
                f"✅ *{'Solicitud de importación' if es_import else 'Solicitud de cotización'} registrada*\n\n"
                f"🚗 Vehículo: {cot.get('vehiculo', 'N/A')}\n"
                f"📅 Año: {cot.get('anio', 'N/A')}\n"
                f"🚚 Tipo: {tipo_entrega}\n\n"
                "Nuestro equipo revisará tu solicitud y te contactará pronto con el precio. 😊\n\n"
                "_Escribe *menu* para ver otras opciones._"
            )
            self._notificar_cotizacion(from_, cot)
            ses["estado"]             = "MENU"
            ses["cotizacion"]         = {}
            ses["pendiente_followup"] = True
            ses["followup_enviado"]   = False

        # ── ASESOR: pedir nombre antes de pausar el bot ───────────────────────
        elif estado == "HUMAN_NOMBRE":
            ses["nombre_cliente"] = texto
            ses["estado"]         = "HUMAN"
            self.enviar_texto(from_,
                f"Gracias, *{texto}*. 😊\n\n"
                "✅ *Te estamos transfiriendo con un especialista en ventas.*\n\n"
                "En breve uno de nuestros asesores tomará el control del chat. "
                "Por favor espera un momento. 🤝"
            )
            self._notificar_agente_solicitado(from_, ses)

        # ── TEST DRIVE: guardar fecha ─────────────────────────────────────────
        elif estado == "TESTDRIVE_FECHA":
            ses["estado"] = "MENU"
            self.enviar_texto(from_,
                f"✅ *¡Perfecto!* Quedamos para *{texto}*.\n\n"
                "📍 Te esperamos en:\n"
                f"{self.dealer_address}\n\n"
                "Si quieres la ubicación exacta escribe *ubicacion*. "
                "¡Hasta pronto! 🚗😊"
            )
            self._notificar_cita(from_, texto, ses)

        # ── TRASPASO: guardar datos ───────────────────────────────────────────
        elif estado == "TRASPASO_INFO":
            ses["estado"] = "MENU"
            self.enviar_texto(from_,
                "✅ Recibimos tu información. Nuestro equipo de administración "
                "revisará tu expediente y te dará una actualización en breve. 📋\n\n"
                "_Escribe *menu* para ver otras opciones._"
            )
            self._notificar_traspaso(from_, texto)

        else:
            ses["estado"] = "MENU"
            self.enviar_texto(from_, MENU_PRINCIPAL)

    # ── Opciones del menú (1–10) ──────────────────────────────────────────────

    def _opcion_1(self, from_: str, ses: dict) -> None:
        """Automatización 2 — Inventario y Catálogo."""
        ses["pendiente_followup"] = True
        ses["followup_enviado"]   = False
        self.enviar_texto(from_,
            "🚗 *¡Aquí está nuestro catálogo digital!*\n\n"
            f"👇 {self.catalogo_url}\n\n"
            "Si ves algún modelo que te guste, *tómale un screenshot y envíalo por aquí* "
            "para darte todos los detalles y el precio. 📸\n\n"
            "¡Estamos para ayudarte!"
        )

    def _opcion_2(self, from_: str, ses: dict) -> None:
        """Automatización 3 — Cotizaciones."""
        ses["estado"]     = "COT_VEHICULO"
        ses["cotizacion"] = {"flujo": "cotizacion"}
        self.enviar_texto(from_,
            "💰 *Cotización de vehículo*\n\n"
            "Para darte el mejor precio, necesito algunos datos. 📝\n\n"
            "¿Qué *marca y modelo exacto* buscas?\n"
            "_(Ejemplo:_ *Toyota Corolla*, *Honda CR-V*, *Hyundai Tucson*_)_"
        )

    def _opcion_3(self, from_: str, ses: dict) -> None:
        """Automatización 4 — Información General y Ubicación."""
        self.enviar_texto(from_,
            "📍 *Información General — Humberto Auto Import*\n\n"
            f"🏢 *Dirección:* {self.dealer_address}\n"
            f"🗺️ Google Maps: {self.maps_url}\n\n"
            "⏰ *Horario de atención:*\n"
            "Lun-Vie: 9:00 AM – 7:00 PM\n"
            "Sábado:  9:00 AM – 5:00 PM\n"
            "Domingo: Cerrado\n\n"
            "💳 *Formas de pago:*\n"
            "✅ Pago al contado\n"
            "✅ Transferencia bancaria\n"
            "✅ Financiamiento bancario (lo gestionamos nosotros)\n\n"
            "_Escribe *menu* para volver al menú principal._"
        )
        self.enviar_ubicacion(from_)

    def _opcion_4(self, from_: str, ses: dict) -> None:
        """Automatización 5 — Pasar a un Asesor (bot se pausa)."""
        ses["estado"] = "HUMAN_NOMBRE"
        self.enviar_texto(from_,
            "👤 *Hablar con un asesor*\n\n"
            "Con gusto te conectamos con uno de nuestros especialistas en ventas. 🤝\n\n"
            "Para presentarte correctamente, ¿cuál es tu *nombre*?"
        )

    def _opcion_5(self, from_: str, ses: dict) -> None:
        """Automatización 6 — Trade-in."""
        self.enviar_texto(from_,
            "🔄 *Recepción de vehículos (Trade-in)*\n\n"
            "¡Sí, evaluamos tu vehículo actual para recibirlo como inicial! 🚗\n\n"
            "Para ir avanzando, por favor envíame por aquí:\n\n"
            "1️⃣ Fotos claras del exterior e interior\n"
            "2️⃣ Año, marca y modelo\n"
            "3️⃣ Kilometraje actual\n\n"
            "Con eso nuestro equipo de tasación te dará un estimado. 😊\n\n"
            "_Escribe *menu* para volver al menú principal._"
        )

    def _opcion_6(self, from_: str, ses: dict) -> None:
        """Automatización 7 — Requisitos de Financiamiento."""
        self.enviar_texto(from_,
            "🏦 *Requisitos de Financiamiento*\n\n"
            "Trabajamos con varias entidades para conseguirte la mejor tasa. 💰\n\n"
            "Los requisitos básicos para pre-calificar son:\n\n"
            "📄 Copia de tu cédula\n"
            "📋 Carta de trabajo o comprobantes de ingresos\n"
            "🏦 Últimos 3 movimientos bancarios\n\n"
            "¿Te gustaría que te pasemos con un asesor para iniciar tu evaluación crediticia? "
            "Escribe *4* para hablar con un agente. 😊\n\n"
            "_Escribe *menu* para volver al menú principal._"
        )

    def _opcion_7(self, from_: str, ses: dict) -> None:
        """Automatización 8 — Importaciones Directas."""
        ses["estado"]     = "COT_VEHICULO"
        ses["cotizacion"] = {"flujo": "importacion"}
        self.enviar_texto(from_,
            "✈️ *Importaciones Directas — Bajo Pedido*\n\n"
            "Si no lo tenemos, ¡te lo traemos! 🌍\n\n"
            "Trabajamos importaciones directas con *total transparencia*. "
            "Nos dices qué modelo buscas, te damos el *costo total puesto aquí*, "
            "y nos encargamos de toda la logística y aduanas.\n\n"
            "¿Qué vehículo exactamente te gustaría que coticemos en el exterior? 🚗"
        )

    def _opcion_8(self, from_: str, ses: dict) -> None:
        """Automatización 9 — Garantía e Historial Carfax."""
        self.enviar_texto(from_,
            "🛡️ *Garantía e Historial (Carfax)*\n\n"
            "¡Transparencia total! ✅\n\n"
            "Todos nuestros vehículos pasan por una *revisión técnica rigurosa*. "
            "Entregamos el *reporte de Carfax* (historial limpio) y ofrecemos "
            "*garantía en motor y transmisión*.\n\n"
            "Si te interesa una unidad de nuestro catálogo, "
            "pídenos el Carfax y te lo enviamos de inmediato. 📋\n\n"
            "_Escribe *menu* para volver al menú principal._"
        )

    def _opcion_9(self, from_: str, ses: dict) -> None:
        """Automatización 10 — Agendar Test Drive o Cita."""
        ses["estado"] = "TESTDRIVE_FECHA"
        self.enviar_texto(from_,
            "🚗 *Agendar Test Drive o Cita*\n\n"
            "¡Claro que sí! Nada como ver el vehículo en persona. 😊\n\n"
            "Para tener la unidad *lista y limpia para ti*, "
            "¿qué *día y a qué hora* te gustaría visitarnos?\n\n"
            "⏰ Horario disponible:\n"
            "Lun-Vie: 9:00 AM – 7:00 PM\n"
            "Sábado:  9:00 AM – 5:00 PM"
        )

    def _opcion_10(self, from_: str, ses: dict) -> None:
        """Automatización 11 — Estatus de Traspaso y Placa."""
        ses["estado"] = "TRASPASO_INFO"
        self.enviar_texto(from_,
            "📋 *Estatus de Traspaso y Placa*\n\n"
            "¡Hola! Para revisar el estatus de tu placa o traspaso, "
            "por favor déjanos:\n\n"
            "👤 Tu *nombre completo*\n"
            "🚗 El *modelo del vehículo* que adquiriste\n\n"
            "Nuestro equipo de administración revisará el expediente "
            "y te dará una actualización en breve. 📂"
        )

    # ── Búsqueda en DB ────────────────────────────────────────────────────────

    def _buscar_vehiculo(self, texto: str) -> str | None:
        try:
            t_upper = texto.upper()
            años    = re.findall(r'\b(199\d|20[012]\d)\b', texto)
            anio    = int(años[0]) if años else None

            marcas           = Marca.query.all()
            marca_encontrada = next((m for m in marcas if m.nombre.upper() in t_upper), None)
            modelos          = Modelo.query.all()
            modelo_encontrado = next((mo for mo in modelos if mo.nombre.upper() in t_upper), None)

            if not marca_encontrada and not modelo_encontrado:
                return None

            q = Vehiculo.query.filter(Vehiculo.estado.in_(["DISPONIBLE", "RESERVADO"]))
            if marca_encontrada:
                q = q.join(Modelo).filter(Modelo.marca_id == marca_encontrada.id)
            if modelo_encontrado:
                q = q.filter(Vehiculo.modelo_id == modelo_encontrado.id)
            if anio:
                q = q.filter(Vehiculo.anio == anio)

            vehiculos = q.limit(4).all()

            if not vehiculos:
                nombre = f"{marca_encontrada.nombre if marca_encontrada else ''} {modelo_encontrado.nombre if modelo_encontrado else ''} {anio or ''}".strip()
                return (
                    f"😔 No encontramos *{nombre}* disponible en este momento.\n\n"
                    f"👇 Revisa todo el inventario en: {self.catalogo_url}\n\n"
                    "_Escribe *menu* para ver otras opciones._"
                )

            if len(vehiculos) == 1:
                v = vehiculos[0]
                return (
                    f"✅ *{v.modelo.marca.nombre} {v.modelo.nombre} {v.anio}*\n\n"
                    f"💰 Precio: *RD$ {float(v.precio):,.0f}*\n"
                    f"🎨 Color: {v.color.capitalize()}\n"
                    f"⛽ Combustible: {v.combustible.capitalize()}\n"
                    f"⚙️ Transmisión: {v.transmision.capitalize()}\n"
                    f"📊 Estado: {'Disponible ✅' if v.estado == 'DISPONIBLE' else 'Reservado ⚠️'}\n\n"
                    "¿Te interesa? Escribe *9* para agendar una visita o *4* para hablar con un agente. 😊"
                )

            lista = "\n".join(
                f"• *{v.modelo.marca.nombre} {v.modelo.nombre}* {v.anio} — "
                f"RD$ {float(v.precio):,.0f} ({v.color.capitalize()})"
                for v in vehiculos
            )
            return (
                f"🚗 Encontramos estas opciones:\n\n{lista}\n\n"
                "¿Cuál te interesa? Escríbeme el año o el color para ver más detalles."
            )

        except Exception as exc:
            log.error("_buscar_vehiculo: %s", exc)
            return None

    # ── Notificaciones a John ─────────────────────────────────────────────────

    def _notificar_cliente_nuevo(self, numero: str, primer_mensaje: str) -> None:
        self.enviar_texto(self.owner_number,
            "🔔 *NUEVO CLIENTE — Humberto Auto Import*\n\n"
            f"📱 Número: +{numero}\n"
            f"💬 Primer mensaje: _{primer_mensaje}_\n"
            f"🕐 Hora: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
            "El bot está atendiendo al cliente automáticamente."
        )

    def _notificar_agente_solicitado(self, numero: str, ses: dict) -> None:
        historial = "\n".join(ses["historial"][-10:])
        nombre    = ses.get("nombre_cliente") or "No indicó"
        self.enviar_texto(self.owner_number,
            "🚨 *CLIENTE SOLICITA HABLAR CON ASESOR*\n\n"
            f"📱 Número: +{numero}\n"
            f"👤 Nombre: {nombre}\n"
            f"🕐 Inicio: {ses['inicio'].strftime('%d/%m/%Y %H:%M')}\n\n"
            f"📋 *Últimos mensajes:*\n{historial}\n\n"
            f"⚠️ El bot está *pausado*. Escríbele directamente al +{numero} en WhatsApp."
        )

    def _notificar_respuesta_cliente(self, numero: str, texto: str) -> None:
        self.enviar_texto(self.owner_number,
            f"💬 *Mensaje de cliente +{numero}* (en espera de asesor):\n_{texto}_"
        )

    def _notificar_cotizacion(self, numero: str, cot: dict) -> None:
        es_import = cot.get("flujo") == "importacion"
        self.enviar_texto(self.owner_number,
            f"💰 *{'SOLICITUD DE IMPORTACIÓN' if es_import else 'NUEVA COTIZACIÓN'}*\n\n"
            f"📱 Número: +{numero}\n"
            f"🚗 Vehículo: {cot.get('vehiculo', 'N/A')}\n"
            f"📅 Año: {cot.get('anio', 'N/A')}\n"
            f"🚚 Tipo: {cot.get('tipo', 'N/A')}\n"
            f"🕐 Hora: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )

    def _notificar_cita(self, numero: str, fecha: str, ses: dict) -> None:
        nombre = ses.get("nombre_cliente") or f"+{numero}"
        self.enviar_texto(self.owner_number,
            "📅 *NUEVA CITA / TEST DRIVE*\n\n"
            f"📱 Número: +{numero}\n"
            f"👤 Cliente: {nombre}\n"
            f"📆 Fecha solicitada: {fecha}\n"
            f"🕐 Registrada: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )

    def _notificar_traspaso(self, numero: str, info: str) -> None:
        self.enviar_texto(self.owner_number,
            "📋 *CONSULTA DE TRASPASO/PLACA*\n\n"
            f"📱 Número: +{numero}\n"
            f"📝 Info del cliente: {info}\n"
            f"🕐 Hora: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )

    def notificar_reserva(self, telefono: str, vehiculo_info: str) -> bool:
        return self.enviar_texto(telefono,
            "✅ *Tu reserva ha sido registrada.*\n"
            f"Vehículo: {vehiculo_info}\n\n"
            "Nos contactaremos pronto para confirmar los detalles.\n"
            f"📍 {self.dealer_address}"
        )
