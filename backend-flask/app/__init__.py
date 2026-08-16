from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config
from .extensions import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.json.sort_keys = False  # preserve Mon->Sun order in the `hours` object

    # Azure Container Apps' ingress terminates TLS and forwards to gunicorn
    # over plain HTTP, setting X-Forwarded-Proto: https on the original
    # request. Without this, Flask has no way to know the real request was
    # HTTPS, so url_for(..., _external=True) (used for logo_url) generates
    # http:// links even though the site is only ever served over https.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    db.init_app(app)
    CORS(app)

    from .routes.restaurants import bp as restaurants_bp
    from .routes.admin import bp as admin_bp

    app.register_blueprint(restaurants_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok"}

    # Flask's default error pages are HTML, which breaks a JSON API's
    # contract for clients that only expect application/json. Route both
    # expected HTTP errors (404, 405, ...) and genuinely unhandled
    # exceptions (DB errors, etc.) through consistent JSON responses. The
    # generic 500 branch never includes the exception message/stack trace —
    # only the server-side log via app.logger.exception does.
    @app.errorhandler(HTTPException)
    def handle_http_exception(err):
        return jsonify({"error": err.description}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        app.logger.exception(err)
        return jsonify({"error": "Internal server error."}), 500

    return app
