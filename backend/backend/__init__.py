"""App factory de Flask."""
import logging
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_compress import Compress
from flask_caching import Cache

from .config import get_config
from .models.base import db
from .models.users import Usuario

bcrypt        = Bcrypt()
login_manager = LoginManager()
limiter       = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
cache         = Cache()
compress      = Compress()


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "No autenticado"}), 401


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(get_config())

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)
    cache.init_app(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
    compress.init_app(app)

    # CORS — orígenes permitidos según entorno
    frontend_url = app.config.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    CORS(app, origins=[frontend_url], supports_credentials=True)

    # Logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Google OAuth (solo si las credenciales están configuradas)
    if app.config.get("GOOGLE_CLIENT_ID") and app.config.get("GOOGLE_CLIENT_SECRET"):
        from .blueprints.auth import init_oauth
        init_oauth(app)

    # Blueprints
    from .blueprints.catalog    import bp as catalog_bp
    from .blueprints.auth       import bp as auth_bp
    from .blueprints.admin      import bp as admin_bp
    from .blueprints.reservas   import bp as reservas_bp
    from .blueprints.borradores import bp as borradores_bp
    from .blueprints.location   import bp as location_bp

    app.register_blueprint(catalog_bp,    url_prefix="/api/catalogo")
    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(admin_bp,      url_prefix="/api/admin")
    app.register_blueprint(reservas_bp,   url_prefix="/api/reservas")
    app.register_blueprint(borradores_bp, url_prefix="/api/borradores")
    app.register_blueprint(location_bp,   url_prefix="/api/location")

    # WhatsApp webhook
    from .blueprints.whatsapp import bp as wa_bp
    app.register_blueprint(wa_bp, url_prefix="/api/whatsapp")

    # Hilo de seguimiento automático a las 24 h (Automatización 13)
    from .services.whatsapp import start_followup_thread
    start_followup_thread(app)

    # Servir archivos subidos (imágenes de vehículos)
    @app.route('/api/uploads/<path:filename>')
    def serve_upload(filename):
        upload_dir = app.config.get('UPLOAD_FOLDER', '/tmp')
        return send_from_directory(os.path.join(upload_dir), filename)

    # ── Headers de seguridad y caché en todas las respuestas ─────────────────
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not app.debug:
            response.headers['Strict-Transport-Security'] = (
                'max-age=31536000; includeSubDomains; preload'
            )

        path = request.path
        if path.startswith('/api/auth'):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
        elif path.startswith('/api/catalogo/marcas') and request.method == 'GET':
            response.headers['Cache-Control'] = 'public, max-age=300'
        elif path == '/api/catalogo/vehiculos' and request.method == 'GET':
            response.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
        return response

    # ── Manejadores de error globales ─────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Recurso no encontrado"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Método no permitido"}), 405

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({"error": "Demasiadas solicitudes. Por favor espera un momento."}), 429

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Error interno del servidor"}), 500

    return app


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(Usuario, int(user_id))
