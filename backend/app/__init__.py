from flask import Flask, jsonify, request
from .config import Config
from .extensions import db, migrate
from .api import api_bp, stock_bp
from .api.auth_routes import auth_bp, current_user
from .api.maintenance_routes import maintenance_bp
from .api.request_routes import requests_bp
from .api.personnel_routes import personnel_bp
from .api.knowledge_routes import knowledge_bp
from .api.scrap_routes import scrap_bp
from .api.report_routes import reports_bp
from .api.settings_routes import settings_bp
from .api.log_routes import logs_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(stock_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(maintenance_bp, url_prefix="/api")
    app.register_blueprint(requests_bp, url_prefix="/api")
    app.register_blueprint(personnel_bp, url_prefix="/api")
    app.register_blueprint(knowledge_bp, url_prefix="/api")
    app.register_blueprint(scrap_bp, url_prefix="/api")
    app.register_blueprint(reports_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(logs_bp, url_prefix="/api")

    @app.before_request
    def require_api_authentication():
        if not request.path.startswith("/api/"):
            return None
        if request.path in {"/api/auth/login", "/api/health/db"}:
            return None
        if request.method == "OPTIONS":
            return None
        user = current_user()
        if user is None:
            return jsonify({"error": "authentication_required"}), 401

        method = request.method.upper()
        path = request.path
        permission = None
        mutation_methods = {"POST", "PUT", "PATCH", "DELETE"}
        if path.startswith("/api/inventory") and method in mutation_methods:
            permission = "inventory.manage"
        elif path.startswith("/api/licenses") and method in mutation_methods:
            permission = "licenses.manage"
        elif path.startswith("/api/stock") and method in mutation_methods:
            permission = "stock.manage"
        elif path.startswith("/api/maintenance") and method in mutation_methods:
            permission = "maintenance.manage"
        elif path.startswith("/api/requests") and method in mutation_methods:
            permission = "requests.manage"
        elif path.startswith("/api/personnel") and method in mutation_methods:
            permission = "people.manage"
        elif path.startswith("/api/knowledge") and method in mutation_methods:
            permission = "knowledge.manage"
        elif path.startswith("/api/scrap") and method in mutation_methods:
            permission = "scrap.manage"
        elif path.startswith("/api/reports"):
            permission = "reports.view"
        elif path.startswith("/api/settings"):
            permission = "settings.manage"

        if permission and not user.has_permission(permission):
            return jsonify({"error": "forbidden", "permission": permission}), 403
        return None

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
