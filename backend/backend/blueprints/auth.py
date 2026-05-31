"""Autenticación: registro, login local, logout, Google OAuth."""
import logging
from flask import Blueprint, jsonify, request, current_app, redirect, url_for
from flask_login import login_user, logout_user, current_user
from authlib.integrations.flask_client import OAuth

from ..models import db, Usuario, Rol
from ..validators import validar_email
from backend import bcrypt

bp  = Blueprint("auth", __name__)
log = logging.getLogger(__name__)
oauth = OAuth()


def init_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


# ---------------------------------------------------------------
# POST /api/auth/registro
# ---------------------------------------------------------------
@bp.post("/registro")
def registro():
    try:
        data = request.get_json(silent=True) or {}
        nombre = (data.get("nombre") or "").strip()
        email  = (data.get("email") or "").strip().lower()
        senha  = data.get("password") or ""

        if not nombre or not email or not senha:
            return jsonify({"error": "nombre, email y password son obligatorios"}), 400
        if not validar_email(email):
            return jsonify({"error": "Error de validación: email inválido"}), 422
        if len(senha) < 8:
            return jsonify({"error": "Error de validación: password mínimo 8 caracteres"}), 422
        if Usuario.query.filter_by(email=email).first():
            return jsonify({"error": "Email ya registrado"}), 409

        rol_pub = Rol.query.filter_by(nombre="USUARIO_PUBLICO").first()
        usuario = Usuario(
            nombre=nombre,
            email=email,
            password_hash=bcrypt.generate_password_hash(senha).decode("utf-8"),
            rol_id=rol_pub.id if rol_pub else 2,
        )
        db.session.add(usuario)
        db.session.commit()
        log.info("Nuevo usuario registrado: %s", email)
        return jsonify({"mensaje": "Usuario creado", "id": usuario.id}), 201
    except Exception as exc:
        db.session.rollback()
        log.error("registro: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------
@bp.post("/login")
def login():
    try:
        data  = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        senha = data.get("password") or ""

        usuario = Usuario.query.filter_by(email=email, activo=True).first()
        if not usuario or not usuario.password_hash:
            return jsonify({"error": "Credenciales inválidas"}), 401
        if not bcrypt.check_password_hash(usuario.password_hash, senha):
            return jsonify({"error": "Credenciales inválidas"}), 401

        login_user(usuario, remember=data.get("remember", False))
        log.info("Login: %s", email)
        return jsonify({"mensaje": "Sesión iniciada", "usuario": usuario.to_dict()})
    except Exception as exc:
        log.error("login: %s", exc)
        return jsonify({"error": "Error interno"}), 500


# ---------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------
@bp.post("/logout")
def logout():
    logout_user()
    return jsonify({"mensaje": "Sesión cerrada"})


# ---------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------
@bp.get("/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    return jsonify(current_user.to_dict())


# ---------------------------------------------------------------
# Google OAuth — solo para reseñas
# GET /api/auth/google
# GET /api/auth/google/callback
# ---------------------------------------------------------------
@bp.get("/google")
def google_login():
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@bp.get("/google/callback")
def google_callback():
    try:
        token    = oauth.google.authorize_access_token()
        userinfo = token.get("userinfo") or oauth.google.userinfo()

        google_id = userinfo["sub"]
        email     = userinfo.get("email", "").lower()
        nombre    = userinfo.get("name", email)
        avatar    = userinfo.get("picture")

        usuario = Usuario.query.filter_by(google_id=google_id).first()
        if not usuario:
            usuario = Usuario.query.filter_by(email=email).first()
        if not usuario:
            rol_pub = Rol.query.filter_by(nombre="USUARIO_PUBLICO").first()
            usuario = Usuario(
                nombre=nombre,
                email=email,
                google_id=google_id,
                avatar_url=avatar,
                rol_id=rol_pub.id if rol_pub else 2,
            )
            db.session.add(usuario)
        else:
            usuario.google_id  = google_id
            usuario.avatar_url = avatar
        db.session.commit()
        login_user(usuario)
        frontend = "http://localhost:3000"
        dest = "/admin" if usuario.is_admin else "/"
        return redirect(f"{frontend}{dest}")
    except Exception as exc:
        log.error("google_callback: %s", exc)
        return jsonify({"error": "Error en autenticación Google"}), 500
