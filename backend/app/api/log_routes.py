from datetime import datetime

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import AuditLog, User
from .auth_routes import permission_required

logs_bp = Blueprint("logs", __name__)


def log_json(log):
    actor = db.session.get(User, log.actor_user_id) if log.actor_user_id else None
    return {
        "id": log.id,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "actor": {"id": actor.id, "username": actor.username} if actor else None,
        "details": log.details or {},
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@logs_bp.get("/logs")
@permission_required("logs.view")
def list_logs():
    q = (request.args.get("q") or "").strip()
    action = (request.args.get("action") or "").strip()
    entity_type = (request.args.get("entity_type") or "").strip()
    actor_id = request.args.get("actor_id", type=int)
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(10, request.args.get("per_page", 25, type=int)))

    query = AuditLog.query
    if q:
        term = f"%{q}%"
        query = query.filter(db.or_(AuditLog.action.ilike(term), AuditLog.entity_type.ilike(term)))
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_id:
        query = query.filter(AuditLog.actor_user_id == actor_id)

    date_from = (request.args.get("date_from") or "").strip()
    date_to = (request.args.get("date_to") or "").strip()
    try:
        if date_from:
            query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(AuditLog.created_at < datetime.fromisoformat(date_to))
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    pagination = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": [log_json(x) for x in pagination.items],
        "pagination": {"page": pagination.page, "per_page": pagination.per_page, "pages": pagination.pages, "total": pagination.total},
    })


@logs_bp.get("/logs/<int:log_id>")
@permission_required("logs.view")
def get_log(log_id):
    log = db.session.get(AuditLog, log_id)
    if not log:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"item": log_json(log)})


@logs_bp.get("/logs/meta")
@permission_required("logs.view")
def log_meta():
    actions = [x[0] for x in db.session.query(AuditLog.action).distinct().order_by(AuditLog.action).all()]
    entity_types = [x[0] for x in db.session.query(AuditLog.entity_type).filter(AuditLog.entity_type.isnot(None)).distinct().order_by(AuditLog.entity_type).all()]
    users = User.query.order_by(User.username).all()
    return jsonify({
        "actions": actions,
        "entity_types": entity_types,
        "users": [{"id": u.id, "username": u.username} for u in users],
    })
