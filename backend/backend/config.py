"""Configuración centralizada desde variables de entorno."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY = os.environ["SECRET_KEY"]
    DEBUG      = False

    # Base de datos — todos requeridos
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
        f"@{os.environ['DB_HOST']}:{os.environ['DB_PORT']}"
        f"/{os.environ['DB_NAME']}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"charset": "utf8mb4"},
        "pool_pre_ping":  True,
        "pool_recycle":   300,
        "pool_size":      10,
        "max_overflow":   20,
    }
    JSON_AS_ASCII = False

    # Tamaño máximo de archivos (10 MB)
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024

    # URL del frontend — requerido
    FRONTEND_URL = os.environ["FRONTEND_URL"]

    # WhatsApp Business API — opcionales (bot desactivado si están vacíos)
    WHATSAPP_API_KEY         = os.getenv("WHATSAPP_API_KEY", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_VERIFY_TOKEN    = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    WHATSAPP_OWNER_NUMBER    = os.getenv("WHATSAPP_OWNER_NUMBER", "")

    # Google OAuth 2.0 — opcionales (login Google desactivado si están vacíos)
    GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Dealer location — requeridos
    DEALER_LAT     = float(os.environ["DEALER_LAT"])
    DEALER_LNG     = float(os.environ["DEALER_LNG"])
    DEALER_PLACE   = os.environ["DEALER_PLACE"]
    DEALER_ADDRESS = os.environ["DEALER_ADDRESS"]

    # Catálogo y mapas para el bot de WhatsApp — requeridos
    CATALOG_URL      = os.environ["CATALOG_URL"]
    GOOGLE_MAPS_LINK = os.environ["GOOGLE_MAPS_LINK"]

    # Subida de archivos
    UPLOAD_FOLDER = os.getenv(
        "UPLOAD_FOLDER",
        os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
    )


class DevelopmentConfig(Config):
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE   = False
    SESSION_COOKIE_HTTPONLY = True


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE   = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_NAME     = "__Host-session"
    PERMANENT_SESSION_LIFETIME = 86400 * 7


config_map = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
}


def get_config() -> Config:
    env = os.getenv("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
