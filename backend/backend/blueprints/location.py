"""Endpoint de ubicación del dealer — Google Maps / Waze."""
import logging
from flask import Blueprint, jsonify, current_app

bp  = Blueprint("location", __name__)
log = logging.getLogger(__name__)


@bp.get("/dealer")
def dealer_location():
    """Retorna lat/lng + URLs de navegación para Google Maps y Waze."""
    try:
        lat   = current_app.config["DEALER_LAT"]
        lng   = current_app.config["DEALER_LNG"]
        place = current_app.config["DEALER_PLACE"]

        return jsonify({
            "nombre": "Concesionaria — Showroom Principal",
            "direccion": place,
            "lat": lat,
            "lng": lng,
            "google_maps_url": f"https://www.google.com/maps?q={lat},{lng}",
            "waze_url":        f"https://waze.com/ul?ll={lat},{lng}&navigate=yes",
        })
    except Exception as exc:
        log.error("dealer_location: %s", exc)
        return jsonify({"error": "Error interno"}), 500
