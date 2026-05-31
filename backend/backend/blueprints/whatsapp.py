"""Webhook WhatsApp Business API (Meta Cloud API)."""
import logging
from flask import Blueprint, jsonify, request, current_app
from ..services.whatsapp import WhatsAppService

bp  = Blueprint("whatsapp", __name__)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------
# GET /api/whatsapp/webhook  — verificación del webhook por Meta
# ---------------------------------------------------------------
@bp.get("/webhook")
def verificar_webhook():
    mode      = request.args.get("hub.mode")
    token     = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == current_app.config["WHATSAPP_VERIFY_TOKEN"]:
        log.info("WhatsApp webhook verificado")
        return challenge, 200
    return jsonify({"error": "Token inválido"}), 403


# ---------------------------------------------------------------
# POST /api/whatsapp/webhook  — mensajes entrantes
# ---------------------------------------------------------------
@bp.post("/webhook")
def recibir_mensaje():
    try:
        payload = request.get_json(silent=True) or {}
        entry   = payload.get("entry", [])

        for e in entry:
            for change in e.get("changes", []):
                value    = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    wa_service = WhatsAppService()
                    wa_service.procesar_mensaje(msg, value.get("metadata", {}))

        return jsonify({"status": "ok"})
    except Exception as exc:
        log.error("recibir_mensaje: %s", exc)
        return jsonify({"error": "Error interno"}), 500
