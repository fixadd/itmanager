from unittest.mock import patch

from werkzeug.security import generate_password_hash

from backend.app.extensions import db
from backend.app.models import ConnectionSetting, Permission, Role, User


def _login_settings_admin(client, app, username="ad_admin"):
    with app.app_context():
        permission = Permission(key="settings.manage", name="Ayarları Yönet")
        role = Role(name="AD Settings Admin", active=True, permissions=[permission])
        password = "TestPassword123!"
        user = User(username=username, password_hash=generate_password_hash(password), role=role, active=True)
        db.session.add_all([permission, role, user])
        db.session.commit()
    response = client.post(
        "/api/auth/login",
        json={"username": user.username, "password": password},
    )
    assert response.status_code == 200


def test_ad_connection_is_saved_disabled_and_secret_is_not_returned(client, app):
    _login_settings_admin(client, app)
    response = client.post(
        "/api/connections",
        json={
            "name": "Baylan Active Directory",
            "kind": "active_directory",
            "host": None,
            "port": 636,
            "username": "svc-itmanager",
            "secret": "do-not-return-this",
            "options": {"domain": "baylan.local", "base_dn": "DC=baylan,DC=local"},
            "active": True,
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload["active"] is False
    assert payload["has_secret"] is True
    assert "secret" not in payload
    assert "secret_encrypted" not in payload
    assert "do-not-return-this" not in response.get_data(as_text=True)
    with app.app_context():
        row = ConnectionSetting.query.filter_by(kind="active_directory").one()
        assert row.secret_encrypted
        assert row.secret_encrypted != "do-not-return-this"
        assert row.options["enabled"] is False


def test_ad_connection_rejects_host_outside_baylan_domain(client, app):
    _login_settings_admin(client, app, username="ad_admin_bad_host")
    response = client.post(
        "/api/connections",
        json={
            "name": "Bad AD",
            "kind": "active_directory",
            "host": "example.com",
            "port": 636,
            "options": {"base_dn": "DC=baylan,DC=local"},
        },
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "ad_host_must_be_in_baylan_domain"


def test_ad_ldaps_test_uses_certificate_validation(client, app):
    _login_settings_admin(client, app, username="ad_admin_test")
    create = client.post(
        "/api/connections",
        json={
            "name": "Baylan Active Directory",
            "kind": "active_directory",
            "host": "dc01.baylan.local",
            "port": 636,
            "username": "",
            "options": {"domain": "baylan.local", "base_dn": "DC=baylan,DC=local"},
        },
    )
    assert create.status_code == 201
    connection_id = create.get_json()["id"]

    with patch("backend.app.api.connection_routes.Server") as server_factory, patch(
        "backend.app.api.connection_routes.Connection"
    ) as ldap_connection_factory:
        ldap_connection_factory.return_value.open.return_value = True
        response = client.post(f"/api/connections/{connection_id}/test")

    assert response.status_code == 200
    assert response.get_json()["ok"] is True
    assert response.get_json()["credentials_checked"] is False
    server_kwargs = server_factory.call_args.kwargs
    assert server_kwargs["use_ssl"] is True
    assert server_kwargs["port"] == 636
    assert server_kwargs["tls"].validate == __import__("ssl").CERT_REQUIRED
