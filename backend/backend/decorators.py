"""Decoradores de autorización por rol."""
import functools
from flask import jsonify
from flask_login import current_user


def admin_required(f):
    """Protege endpoints que requieren rol ADMIN."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "Acceso denegado: autenticación requerida"}), 401
        if not current_user.is_admin:
            return jsonify({"error": "Acceso denegado: privilegios insuficientes"}), 403
        return f(*args, **kwargs)
    return wrapper


def login_required_api(f):
    """Versión API de login_required — responde JSON en lugar de redirect."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "Acceso denegado: autenticación requerida"}), 401
        return f(*args, **kwargs)
    return wrapper
