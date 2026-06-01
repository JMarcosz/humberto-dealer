"""Entry point de la aplicación."""
from backend import create_app


app = create_app()

# Crear tablas nuevas si no existen (seguro en producción, no elimina datos)
with app.app_context():
    from backend.models import db
    db.create_all()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, use_reloader=False)
