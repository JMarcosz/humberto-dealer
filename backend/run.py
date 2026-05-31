"""Entry point de la aplicación."""
from backend import create_app
from flask_cors import CORS

app = create_app()
CORS(app, resources={r"/*": {"origins": "*"}})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
