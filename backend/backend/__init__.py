"""App factory de Flask."""
import logging
import os
from flask import Flask, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_cors import CORS

from .config import get_config
from .models.base import db
from .models.users import Usuario

bcrypt        = Bcrypt()
login_manager = LoginManager()


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

    # CORS — permite requests desde el frontend Next.js
    CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

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

    # Servir archivos subidos (imágenes de vehículos)
    @app.route('/api/uploads/<path:filename>')
    def serve_upload(filename):
        upload_dir = app.config.get('UPLOAD_FOLDER', '/tmp')
        return send_from_directory(os.path.join(upload_dir), filename)

    return app


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(Usuario, int(user_id))
