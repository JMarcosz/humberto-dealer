"""Servicio WhatsApp Business API — Meta Cloud API oficial."""
import logging
import re
import requests
from datetime import datetime
from flask import current_app
from ..models import db, Vehiculo, Marca, Modelo

log = logging.getLogger(__name__)
GRAPH_URL = "https://graph.facebook.com/v19.0"

# ── Números de notificación ───────────────────────────────────────────────────
JOHN_NUMBER  = "18094346968"   # Administrador — John
OWNER_NUMBER = "18094346968"   # Dueño — mismo por ahora, cambiar cuando se tenga el número real

# ── Estado en memoria ─────────────────────────────────────────────────────────
# { numero_cliente: { "esperando_confirmacion": bool, "agente_activo": bool, "historial": [str] } }
_sesiones: dict = {}


class WhatsAppService:
    def __init__(self):
        self.api_key  = current_app.config["WHATSAPP_API_KEY"]
        self.phone_id = current_app.config["WHATSAPP_PHONE_NUMBER_ID"]
        self.base_url = f"{GRAPH_URL}/{self.phone_id}/messages"
        self.headers  = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type":  "application/json",
        }

    # ── Enviar mensaje ────────────────────────────────────────────────────────
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

    # ── Procesar mensaje entrante ─────────────────────────────────────────────
    def procesar_mensaje(self, mensaje: dict, metadata: dict) -> None:
        tipo  = mensaje.get("type")
        from_ = mensaje.get("from")

        if tipo != "text":
            self.enviar_texto(from_, "Hola 👋 Solo proceso mensajes de texto por ahora.")
            return

        texto = mensaje.get("text", {}).get("body", "").strip()

        # Inicializar sesión si es nuevo cliente
        es_nuevo = from_ not in _sesiones
        if es_nuevo:
            _sesiones[from_] = {
                "esperando_confirmacion": False,
                "agente_activo": False,
                "historial": [],
                "inicio": datetime.now().strftime("%d/%m/%Y %H:%M"),
            }

        sesion = _sesiones[from_]
        sesion["historial"].append(f"Cliente: {texto}")

        # Si ya hay agente activo → notificar a John que el cliente respondió
        if sesion["agente_activo"]:
            self._notificar_respuesta_cliente(from_, texto)
            return

        # Si está esperando confirmación para agente
        if sesion["esperando_confirmacion"]:
            t_lower = texto.lower().strip()
            if t_lower in ("si", "sí", "yes", "s", "1", "ok"):
                sesion["esperando_confirmacion"] = False
                sesion["agente_activo"] = True
                self.enviar_texto(from_,
                    "✅ *Un agente se comunicará contigo en breve.*\n\n"
                    "Por favor espera, nuestro equipo revisará tu consulta y te contactará pronto. 😊"
                )
                self._notificar_agente_solicitado(from_, sesion)
                return
            else:
                sesion["esperando_confirmacion"] = False
                self.enviar_texto(from_,
                    "De acuerdo, continuamos con el asistente virtual. 🤖\n\n"
                    "¿En qué más puedo ayudarte?"
                )
                return

        # Notificar a John si es cliente nuevo
        if es_nuevo:
            self._notificar_cliente_nuevo(from_, texto)

        # Generar respuesta del bot
        respuesta = self._generar_respuesta(texto, from_)
        if respuesta:
            sesion["historial"].append(f"Bot: {respuesta}")
            self.enviar_texto(from_, respuesta)

    # ── Notificaciones ────────────────────────────────────────────────────────
    def _notificar_cliente_nuevo(self, numero: str, primer_mensaje: str) -> None:
        notif = (
            "🔔 *NUEVO CLIENTE - Humberto Auto Import*\n\n"
            f"📱 Número: +{numero}\n"
            f"💬 Primer mensaje: _{primer_mensaje}_\n"
            f"🕐 Hora: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
            "El bot está atendiendo al cliente automáticamente."
        )
        self.enviar_texto(JOHN_NUMBER, notif)
        if OWNER_NUMBER != JOHN_NUMBER:
            self.enviar_texto(OWNER_NUMBER, notif)

    def _notificar_agente_solicitado(self, numero: str, sesion: dict) -> None:
        historial = "\n".join(sesion["historial"][-10:])  # últimos 10 mensajes
        notif = (
            "🚨 *CLIENTE SOLICITA HABLAR CON AGENTE*\n\n"
            f"📱 Número: +{numero}\n"
            f"🕐 Inicio conversación: {sesion['inicio']}\n\n"
            f"📋 *Resumen de la conversación:*\n"
            f"{historial}\n\n"
            "⚠️ El cliente está esperando tu respuesta. "
            f"Escríbele directamente al +{numero} en WhatsApp."
        )
        self.enviar_texto(JOHN_NUMBER, notif)
        if OWNER_NUMBER != JOHN_NUMBER:
            self.enviar_texto(OWNER_NUMBER, notif)

    def _notificar_respuesta_cliente(self, numero: str, texto: str) -> None:
        notif = (
            f"💬 *Respuesta de cliente +{numero}:*\n"
            f"_{texto}_"
        )
        self.enviar_texto(JOHN_NUMBER, notif)

    # ── Generador de respuestas ───────────────────────────────────────────────
    def _generar_respuesta(self, texto: str, from_: str) -> str:
        t = texto.lower()

        # Detectar solicitud de agente humano
        palabras_agente = ("agente", "humano", "persona", "hablar con alguien",
                           "quiero hablar", "representante", "asesor", "vendedor")
        if any(k in t for k in palabras_agente):
            _sesiones[from_]["esperando_confirmacion"] = True
            return (
                "👤 Entendido, quieres hablar con un agente humano.\n\n"
                "¿Confirmas que deseas ser atendido por una persona?\n\n"
                "Responde *SI* para confirmar o *NO* para continuar con el asistente virtual."
            )

        # Saludo
        if any(k in t for k in ("hola", "buenos", "buenas", "hey", "buen dia")):
            return (
                "👋 ¡Hola! Bienvenido a *Humberto Auto Import*.\n\n"
                "Puedo ayudarte con:\n"
                "🚗 *1* - Ver vehículos disponibles\n"
                "💰 *2* - Consultar precio de un vehículo\n"
                "📍 *3* - Nuestra ubicación\n"
                "📅 *4* - Agendar una visita\n"
                "👤 *5* - Hablar con un agente\n\n"
                "Escribe el número o dime qué buscas."
            )

        if t.strip() in ("5",):
            _sesiones[from_]["esperando_confirmacion"] = True
            return (
                "👤 ¿Deseas hablar con un agente humano?\n\n"
                "Responde *SI* para confirmar o *NO* para continuar con el asistente."
            )

        if t.strip() == "1" or any(k in t for k in ("disponible", "inventario", "catalogo", "catálogo", "ver carros")):
            return self._listar_disponibles()

        if t.strip() == "3" or any(k in t for k in ("ubicación", "ubicacion", "donde", "dónde", "dirección", "maps", "waze")):
            return (
                "📍 *Nuestra ubicación:*\n"
                "Prol. Av. 27 de Febrero 467, Santo Domingo\n\n"
                "🗺️ Google Maps: https://maps.app.goo.gl/ejemplo\n"
                "📱 Waze: https://waze.com/ul?ll=18.463905,-69.993384\n\n"
                "⏰ Lun-Vie 9AM-7PM | Sáb 9AM-5PM"
            )

        if t.strip() == "4" or any(k in t for k in ("cita", "visita", "agendar")):
            return (
                "📅 Con gusto agendamos tu visita.\n\n"
                "Por favor indícanos:\n"
                "• Tu nombre completo\n"
                "• Día y hora preferida\n"
                "• Vehículo de interés\n\n"
                "Horario: Lun-Vie 9AM-7PM | Sáb 9AM-5PM"
            )

        if t.strip() == "2" or any(k in t for k in ("precio", "costo", "cuánto", "cuanto", "vale", "interesado")):
            resultado = self._buscar_vehiculo(texto)
            if resultado:
                return resultado
            return (
                "💰 ¿De qué vehículo deseas el precio?\n\n"
                "Escríbeme marca, modelo y año. Ejemplo:\n"
                "_CHEVROLET Equinox 2020_"
            )

        if any(k in t for k in ("financiamiento", "financiar", "credito", "crédito", "cuotas")):
            return (
                "💳 *Financiamiento disponible*\n\n"
                "Trabajamos con los principales bancos del país.\n"
                "Para más información contáctanos:\n"
                "📞 +1 (849) 580-9586\n\n"
                "¿Te interesa algún vehículo en particular?"
            )

        if any(k in t for k in ("gracias", "ok", "perfecto", "listo", "excelente")):
            return "¡Con mucho gusto! 😊 Si necesitas algo más, aquí estamos."

        # Intentar buscar vehículo por marca/modelo
        resultado = self._buscar_vehiculo(texto)
        if resultado:
            return resultado

        return (
            "No entendí tu mensaje 😅\n\n"
            "🚗 *1* - Ver vehículos disponibles\n"
            "💰 *2* - Consultar precio\n"
            "📍 *3* - Ubicación\n"
            "📅 *4* - Agendar visita\n"
            "👤 *5* - Hablar con agente\n\n"
            "Escribe el número de la opción."
        )

    def _listar_disponibles(self) -> str:
        try:
            vehiculos = Vehiculo.query.filter_by(estado="DISPONIBLE").limit(6).all()
            if not vehiculos:
                return "En este momento no hay vehículos disponibles. ¡Pronto tendremos nuevo inventario!"
            lista = "\n".join(
                f"• *{v.modelo.marca.nombre} {v.modelo.nombre}* {v.anio} — RD$ {float(v.precio):,.0f}"
                for v in vehiculos
            )
            total = Vehiculo.query.filter_by(estado="DISPONIBLE").count()
            return (
                f"🚗 *Vehículos disponibles* ({total} en total):\n\n"
                f"{lista}\n\n"
                "¿Te interesa alguno? Escríbeme la marca y modelo para ver más detalles."
            )
        except Exception as exc:
            log.error("_listar_disponibles: %s", exc)
            return "Error consultando el inventario."

    def _buscar_vehiculo(self, texto: str) -> str | None:
        try:
            t_upper = texto.upper()
            años = re.findall(r'\b(199\d|20[012]\d)\b', texto)
            anio = int(años[0]) if años else None

            marcas = Marca.query.all()
            marca_encontrada = next((m for m in marcas if m.nombre.upper() in t_upper), None)

            modelos = Modelo.query.all()
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
                    f"😔 No encontramos *{nombre}* disponible ahora.\n\n"
                    "Escribe *1* para ver todo el inventario disponible."
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
                    "¿Te interesa? Escribe *4* para agendar una visita o *5* para hablar con un agente. 😊"
                )

            lista = "\n".join(
                f"• *{v.modelo.marca.nombre} {v.modelo.nombre}* {v.anio} — RD$ {float(v.precio):,.0f} ({v.color.capitalize()})"
                for v in vehiculos
            )
            return f"🚗 Encontramos estas opciones:\n\n{lista}\n\n¿Cuál te interesa? Escríbeme el año para ver más detalles."

        except Exception as exc:
            log.error("_buscar_vehiculo: %s", exc)
            return None

    def notificar_reserva(self, telefono: str, vehiculo_info: str) -> bool:
        texto = (
            f"✅ *Tu reserva ha sido registrada.*\n"
            f"Vehículo: {vehiculo_info}\n\n"
            f"Nos contactaremos pronto para confirmar los detalles.\n"
            f"📍 Prol. Av. 27 de Febrero 467, Santo Domingo"
        )
        return self.enviar_texto(telefono, texto)
