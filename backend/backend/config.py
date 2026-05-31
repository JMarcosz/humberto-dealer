"""Configuración centralizada desde variables de entorno."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY = os.environ["SECRET_KEY"]
    DEBUG      = os.getenv("FLASK_DEBUG", "0") == "1"

    # Base de datos
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
        f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}"
        f"/{os.getenv('DB_NAME', 'concesionaria')}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"charset": "utf8mb4"},
        "pool_pre_ping": True,
    }
    JSON_AS_ASCII = False

    # WhatsApp Business API (Meta Cloud API)
    WHATSAPP_API_KEY          = os.getenv("WHATSAPP_API_KEY", "")
    WHATSAPP_PHONE_NUMBER_ID  = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_VERIFY_TOKEN     = os.getenv("WHATSAPP_VERIFY_TOKEN", "")

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Dealer location (Google Maps / Waze)
    DEALER_LAT   = float(os.getenv("DEALER_LAT", "18.4861"))
    DEALER_LNG   = float(os.getenv("DEALER_LNG", "-69.9312"))
    DEALER_PLACE = os.getenv("DEALER_PLACE", "Piantini, Santo Domingo, República Dominicana")

    # Excel uploads
    UPLOAD_FOLDER   = os.getenv("UPLOAD_FOLDER", "/tmp/concesionaria_uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB


class DevelopmentConfig(Config):
    DEBUG = True
    # Cookies cross-port en localhost (desarrollo)
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE   = False
    SESSION_COOKIE_HTTPONLY = True


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE   = True
    SESSION_COOKIE_HTTPONLY = True


config_map = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
}

def get_config() -> Config:
    env = os.getenv("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
