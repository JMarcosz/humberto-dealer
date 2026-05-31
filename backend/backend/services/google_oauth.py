"""Helpers de Google OAuth 2.0 — exclusivo para reseñas con estrellas."""
import logging
from authlib.integrations.flask_client import OAuth

log   = logging.getLogger(__name__)
oauth = OAuth()


def init_google_oauth(app) -> None:
    """Registrar cliente Google en la instancia OAuth."""
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    log.info("Google OAuth inicializado")
