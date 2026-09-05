from werkzeug.security import generate_password_hash

from backend.app.extensions import db
from backend.app.models import Permission, Role, User, AuditLog


def seed_user(role_name, permission_keys=(), username="tester", password="TestPassword123!"):
    permissions = []
    for key in permission_keys:
        permission = Permission(key=key, name=key)
        db.session.add(permission)
        permissions.append(permission)
    role = Role(name=role_name, active=True, permissions=permissions)
    user = User(username=username, password_hash=generate_password_hash(password), role=role, active=True)
    db.session.add_all([role, user])
    db.session.commit()
    return user, password


def test_api_requires_authentication(client):
    response = client.get("/api/master-data")
    assert response.status_code == 401
    assert response.json["error"] == "authentication_required"


def test_login_and_me(client, app):
    with app.app_context():
        user, password = seed_user("Reader", ["dashboard.view"], username="reader")

    response = client.post("/api/auth/login", json={"username": user.username, "password": password})
    assert response.status_code == 200
    assert response.json["user"]["username"] == "reader"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json["user"]["username"] == "reader"


def test_permission_boundary_returns_403(client, app):
    with app.app_context():
        user, password = seed_user("Reader", ["dashboard.view"], username="reader2")

    assert client.post("/api/auth/login", json={"username": user.username, "password": password}).status_code == 200
    response = client.post("/api/settings/brands", json={"name": "Blocked Brand"})
    assert response.status_code == 403
    assert response.json["permission"] == "settings.manage"


def test_logs_permission_is_enforced(client, app):
    with app.app_context():
        user, password = seed_user("Reader", ["dashboard.view"], username="reader3")

    client.post("/api/auth/login", json={"username": user.username, "password": password})
    response = client.get("/api/logs")
    assert response.status_code == 403


def test_successful_login_creates_audit_record(client, app):
    with app.app_context():
        user, password = seed_user("Reader", ["dashboard.view"], username="reader4")

    client.post("/api/auth/login", json={"username": user.username, "password": password})
    with app.app_context():
        log = AuditLog.query.filter_by(action="login", actor_user_id=user.id).order_by(AuditLog.id.desc()).first()
        assert log is not None
