from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import AuditLog, Permission, Role, User


auth_bp = Blueprint("auth", __name__)


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    user = db.session.get(User, user_id)
    if not user or not user.active:
        session.clear()
        return None
    return user


def user_json(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "active": user.active,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "role": {"id": user.role.id, "name": user.role.name} if user.role else None,
        "personnel": {"id": user.personnel.id, "name": user.personnel.name} if user.personnel else None,
        "permissions": [p.key for p in user.role.permissions] if user.role and user.role.active else [],
    }


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "authentication_required"}), 401
        return view(*args, **kwargs)
    return wrapped


def permission_required(permission):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "authentication_required"}), 401
            if not user.has_permission(permission):
                return jsonify({"error": "forbidden", "permission": permission}), 403
            return view(*args, **kwargs)
        return wrapped
    return decorator


def audit(action, entity_type=None, entity_id=None, details=None):
    actor = current_user()
    db.session.add(AuditLog(action=action, entity_type=entity_type, entity_id=entity_id,
                            actor_user_id=actor.id if actor else None, details=details or {}))


@auth_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not username or not password:
        return jsonify({"error": "username_and_password_required"}), 400
    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if not user or not user.active or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid_credentials"}), 401
    user.last_login_at = datetime.now(timezone.utc)
    session.clear()
    session["user_id"] = user.id
    audit("login", "user", user.id)
    db.session.commit()
    return jsonify({"user": user_json(user)})


@auth_bp.post("/auth/logout")
@login_required
def logout():
    user = current_user()
    audit("logout", "user", user.id)
    db.session.commit()
    session.clear()
    return jsonify({"ok": True})


@auth_bp.get("/auth/me")
@login_required
def me():
    return jsonify({"user": user_json(current_user())})


@auth_bp.get("/users")
@permission_required("users.manage")
def list_users():
    q = (request.args.get("q") or "").strip()
    query = User.query
    if q:
        term = f"%{q}%"
        query = query.filter(db.or_(User.username.ilike(term), User.email.ilike(term)))
    return jsonify({"items": [user_json(u) for u in query.order_by(User.username).all()]})


@auth_bp.post("/users")
@permission_required("users.manage")
def create_user():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not username or len(password) < 8:
        return jsonify({"error": "username_and_password_required", "detail": "Password must be at least 8 characters."}), 400
    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"error": "username_exists"}), 409
    user = User(username=username, email=str(data.get("email") or "").strip() or None,
                password_hash=generate_password_hash(password), active=bool(data.get("active", True)))
    if data.get("role_id"):
        user.role = db.session.get(Role, int(data["role_id"]))
    db.session.add(user)
    db.session.flush()
    audit("user_created", "user", user.id, {"username": user.username})
    db.session.commit()
    return jsonify({"user": user_json(user)}), 201


@auth_bp.patch("/users/<int:user_id>")
@permission_required("users.manage")
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404
    data = request.get_json(silent=True) or {}
    if "username" in data:
        username = str(data["username"] or "").strip()
        if not username:
            return jsonify({"error": "username_required"}), 400
        conflict = User.query.filter(db.func.lower(User.username) == username.lower(), User.id != user.id).first()
        if conflict:
            return jsonify({"error": "username_exists"}), 409
        user.username = username
    if "email" in data:
        user.email = str(data["email"] or "").strip() or None
    if "active" in data:
        user.active = bool(data["active"])
    if "role_id" in data:
        user.role = db.session.get(Role, int(data["role_id"])) if data["role_id"] else None
    if data.get("password"):
        if len(str(data["password"])) < 8:
            return jsonify({"error": "password_too_short"}), 400
        user.password_hash = generate_password_hash(str(data["password"]))
    audit("user_updated", "user", user.id, {"username": user.username})
    db.session.commit()
    return jsonify({"user": user_json(user)})


@auth_bp.post("/users/<int:user_id>/toggle")
@permission_required("users.manage")
def toggle_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404
    if current_user().id == user.id and user.active:
        return jsonify({"error": "cannot_disable_current_user"}), 400
    user.active = not user.active
    audit("user_status_changed", "user", user.id, {"active": user.active})
    db.session.commit()
    return jsonify({"user": user_json(user)})


@auth_bp.get("/roles")
@permission_required("roles.manage")
def list_roles():
    roles = Role.query.order_by(Role.name).all()
    return jsonify({"items": [{"id": r.id, "name": r.name, "description": r.description, "active": r.active,
                                "permissions": [p.key for p in r.permissions]} for r in roles]})


@auth_bp.post("/roles")
@permission_required("roles.manage")
def create_role():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name_required"}), 400
    if Role.query.filter(db.func.lower(Role.name) == name.lower()).first():
        return jsonify({"error": "role_exists"}), 409
    role = Role(name=name, description=str(data.get("description") or "").strip() or None, active=bool(data.get("active", True)))
    role.permissions = Permission.query.filter(Permission.id.in_([int(x) for x in data.get("permission_ids", [])])).all() if data.get("permission_ids") else []
    db.session.add(role)
    db.session.flush()
    audit("role_created", "role", role.id, {"name": role.name})
    db.session.commit()
    return jsonify({"id": role.id, "name": role.name, "description": role.description, "active": role.active,
                    "permissions": [p.key for p in role.permissions]}), 201


@auth_bp.patch("/roles/<int:role_id>")
@permission_required("roles.manage")
def update_role(role_id):
    role = db.session.get(Role, role_id)
    if not role:
        return jsonify({"error": "not_found"}), 404
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"] or "").strip()
        conflict = Role.query.filter(db.func.lower(Role.name) == name.lower(), Role.id != role.id).first()
        if not name or conflict:
            return jsonify({"error": "invalid_role_name"}), 400
        role.name = name
    if "description" in data:
        role.description = str(data["description"] or "").strip() or None
    if "active" in data:
        role.active = bool(data["active"])
    if "permission_ids" in data:
        ids = [int(x) for x in data.get("permission_ids", [])]
        role.permissions = Permission.query.filter(Permission.id.in_(ids)).all() if ids else []
    audit("role_updated", "role", role.id, {"name": role.name})
    db.session.commit()
    return jsonify({"id": role.id, "name": role.name, "description": role.description, "active": role.active,
                    "permissions": [p.key for p in role.permissions]})


@auth_bp.get("/permissions")
@permission_required("roles.manage")
def list_permissions():
    permissions = Permission.query.order_by(Permission.key).all()
    return jsonify({"items": [{"id": p.id, "key": p.key, "name": p.name, "description": p.description} for p in permissions]})


@auth_bp.get("/profile")
@login_required
def profile():
    return jsonify({"user": user_json(current_user())})


@auth_bp.patch("/profile")
@login_required
def update_profile():
    user = current_user()
    data = request.get_json(silent=True) or {}
    if "email" in data:
        user.email = str(data["email"] or "").strip() or None
    if data.get("password"):
        if len(str(data["password"])) < 8:
            return jsonify({"error": "password_too_short"}), 400
        user.password_hash = generate_password_hash(str(data["password"]))
    audit("profile_updated", "user", user.id)
    db.session.commit()
    return jsonify({"user": user_json(user)})
