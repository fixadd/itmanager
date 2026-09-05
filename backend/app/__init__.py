from flask import Flask, jsonify
from .config import Config
from .extensions import db
from .api import api_bp, stock_bp
from .api.maintenance_routes import maintenance_bp
from .api.request_routes import requests_bp
from .api.personnel_routes import personnel_bp
from .api.knowledge_routes import knowledge_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(stock_bp, url_prefix="/api")
    app.register_blueprint(maintenance_bp, url_prefix="/api")
    app.register_blueprint(requests_bp, url_prefix="/api")
    app.register_blueprint(personnel_bp, url_prefix="/api")
    app.register_blueprint(knowledge_bp, url_prefix="/api")

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
