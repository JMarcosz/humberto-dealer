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

from werkzeug.middleware.proxy_fix import ProxyFix

from .config import get_config
from .models.base import db
from .models.users import Usuario

storage_uri   = os.getenv("REDIS_URL") or os.getenv("RATELIMIT_STORAGE_URI") or "memory://"
bcrypt        = Bcrypt()
login_manager = LoginManager()
limiter       = Limiter(key_func=get_remote_address, storage_uri=storage_uri, default_limits=["200 per minute"])
cache         = Cache()
compress      = Compress()


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "No autenticado"}), 401


def create_app(config_override: dict = None) -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(get_config())
    if config_override:
        app.config.update(config_override)

    # Middleware para resolución correcta de IP del cliente detrás del reverse proxy Next.js
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)
    cache.init_app(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
    compress.init_app(app)

    # CORS — orígenes permitidos según entorno
    frontend_url = app.config["FRONTEND_URL"].rstrip("/")
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
    from .blueprints.renta      import bp as renta_bp

    app.register_blueprint(catalog_bp,    url_prefix="/api/catalogo")
    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(admin_bp,      url_prefix="/api/admin")
    app.register_blueprint(reservas_bp,   url_prefix="/api/reservas")
    app.register_blueprint(borradores_bp, url_prefix="/api/borradores")
    app.register_blueprint(location_bp,   url_prefix="/api/location")
    app.register_blueprint(renta_bp,      url_prefix="/api/renta")

    # WhatsApp webhook
    from .blueprints.whatsapp import bp as wa_bp
    app.register_blueprint(wa_bp, url_prefix="/api/whatsapp")

    # Hilo de seguimiento automático a las 24 h (Automatización 13)
    if not app.config.get("TESTING"):
        from .services.whatsapp import start_followup_thread
        start_followup_thread(app)

    # Protección CSRF por verificación de Origin y Referer en métodos mutables
    @app.before_request
    def verificar_csrf_origin():
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.path.startswith("/api/whatsapp"):
                return
            expected_frontend = app.config.get("FRONTEND_URL", "").rstrip("/")
            origin = request.headers.get("Origin")
            referer = request.headers.get("Referer")

            target_origin = None
            if origin:
                target_origin = origin.rstrip("/")
            elif referer:
                from urllib.parse import urlparse
                p = urlparse(referer)
                target_origin = f"{p.scheme}://{p.netloc}".rstrip("/")

            if target_origin:
                if target_origin != expected_frontend:
                    return jsonify({"error": "Origen no autorizado"}), 403
            else:
                # Si ambos están ausentes en petición con cookie de sesión activa, denegar CSRF
                session_cookie = app.config.get("SESSION_COOKIE_NAME", "session")
                if not app.config.get("TESTING") and request.cookies.get(session_cookie):
                    return jsonify({"error": "Petición rechazada: falta cabecera Origin o Referer"}), 403

    # Healthcheck para Docker / orquestadores (sin fuga de información)
    @app.route('/api/health')
    def health_check():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({"status": "healthy", "database": "connected"}), 200
        except Exception as e:
            logging.getLogger(__name__).error("Health check error: %s", e)
            return jsonify({"status": "unhealthy", "error": "Servicio no disponible"}), 503

    # Servir archivos subidos: restringido a imágenes para evitar fuga de imports/
    @app.route('/api/uploads/<path:filename>')
    def serve_upload(filename):
        norm_filename = os.path.normpath(filename).replace('\\', '/')
        if norm_filename.startswith("imports") or ".." in norm_filename:
            return jsonify({"error": "Acceso denegado"}), 403

        allowed_exts = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
        ext = os.path.splitext(norm_filename)[1].lower()
        if ext not in allowed_exts:
            return jsonify({"error": "Tipo de archivo no permitido"}), 403

        upload_dir = app.config.get('UPLOAD_FOLDER', '/tmp')
        return send_from_directory(upload_dir, norm_filename)

    # ── Headers de seguridad y caché en todas las respuestas ─────────────────
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '0'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(self)'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "img-src 'self' data: https://images.unsplash.com; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "frame-ancestors 'self';"
        )
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
