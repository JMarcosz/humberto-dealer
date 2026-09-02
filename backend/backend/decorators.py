"""Decoradores de autorización por rol y traducción de errores de negocio."""
import functools
import logging
from flask import jsonify
from flask_login import current_user

from .errors import ReglaNegocioError
from .models import db


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


def maneja_errores_renta(f):
    """Traduce excepciones a respuestas JSON con el status correcto.

    Sin esto, una entrada malformada del usuario (`int("abc")`, una fecha que
    llega como número) revienta dentro de un `except Exception` genérico y se
    responde 500: el servidor no distingue "el usuario mandó basura" de "el
    servidor falló".

    Debe ser el decorador MAS INTERNO: un 403 de autorización o un 429 de
    cuota no son reglas de negocio y no deben pasar por aquí.
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ReglaNegocioError as exc:
            # Rollback tambien aqui: varias reglas se evaluan despues de un
            # flush() o un with_for_update, y la sesion quedaria sucia para el
            # siguiente request del mismo worker.
            db.session.rollback()
            cuerpo = {"error": exc.mensaje}
            if exc.codigo:
                cuerpo["codigo"] = exc.codigo
            if exc.detalles:
                cuerpo["detalles"] = exc.detalles
            return jsonify(cuerpo), exc.status
        except Exception:
            db.session.rollback()
            # log.exception preserva el traceback; log.error("%s", exc) lo pierde.
            logging.getLogger(f.__module__).exception(
                "Fallo no controlado en %s", f.__qualname__)
            return jsonify({"error": "Error interno del servidor"}), 500
    return wrapper
