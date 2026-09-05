from flask import Flask, jsonify
from .config import Config
from .extensions import db
from .api import api_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "itmanager-api"})

    @app.get("/api/health/db")
    def db_health():
        from sqlalchemy import text
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({"status": "ok", "database": "postgresql"})
        except Exception as exc:
            db.session.rollback()
            return jsonify({"status": "error", "database": "postgresql", "detail": str(exc)}), 503

    return app
