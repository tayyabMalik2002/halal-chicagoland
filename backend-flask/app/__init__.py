from flask import Flask
from flask_cors import CORS

from .config import Config
from .extensions import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.json.sort_keys = False  # preserve Mon->Sun order in the `hours` object

    db.init_app(app)
    CORS(app)

    from .routes.restaurants import bp as restaurants_bp

    app.register_blueprint(restaurants_bp)

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok"}

    return app
