import hashlib
import hmac
import logging
from flask import Blueprint, jsonify, request, current_app
from ..services.whatsapp import WhatsAppService

bp  = Blueprint("whatsapp", __name__)
log = logging.getLogger(__name__)


def _validar_firma_whatsapp(app_secret: str, raw_body: bytes, sig_header: str | None) -> bool:
    """Valida la firma HMAC-SHA256 enviada por Meta en la cabecera X-Hub-Signature-256."""
    if not sig_header or not sig_header.startswith("sha256="):
        return False
    received_hash = sig_header.split("sha256=", 1)[1]
    expected_hash = hmac.new(
        key=app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_hash, received_hash)


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
        app_secret = current_app.config.get("WHATSAPP_APP_SECRET")
        if app_secret:
            sig_header = request.headers.get("X-Hub-Signature-256")
            if not _validar_firma_whatsapp(app_secret, request.get_data(), sig_header):
                log.warning("Intento de acceso a webhook WhatsApp con firma ausente o inválida")
                return jsonify({"error": "Firma no válida"}), 401

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
