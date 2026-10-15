from types import SimpleNamespace
from unittest.mock import Mock, patch

from werkzeug.security import generate_password_hash

from backend.app.api.auth_routes import _ad_secret_cipher
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
        json={"username": username, "password": password},
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
            "username": "svc-itmanager",
            "secret": "test-bind-password",
            "options": {"domain": "baylan.local", "base_dn": "DC=baylan,DC=local", "bind_password": "must-not-be-returned"},
        },
    )
    assert create.status_code == 201
    connection_id = create.get_json()["id"]

    with patch("backend.app.api.connection_routes.Server") as server_factory, patch(
        "backend.app.api.connection_routes.Connection"
    ) as ldap_connection_factory:
        ldap_connection_factory.return_value.open.return_value = True
        ldap_connection_factory.return_value.bind.return_value = True
        ldap_connection_factory.return_value.search.return_value = True
        ldap_connection_factory.return_value.entries = [object()]
        response = client.post(f"/api/connections/{connection_id}/test")

    assert response.status_code == 200
    assert response.get_json()["ok"] is True
    assert response.get_json()["credentials_checked"] is True
    assert response.get_json()["connection"]["options"]["last_test_ok"] is True
    assert response.get_json()["connection"]["active"] is False
    assert "bind_password" not in response.get_data(as_text=True)
    assert "test-bind-password" not in response.get_data(as_text=True)
    server_kwargs = server_factory.call_args.kwargs
    assert server_kwargs["use_ssl"] is True
    assert server_kwargs["port"] == 636
    assert server_kwargs["tls"].validate == __import__("ssl").CERT_REQUIRED
    activation = client.patch(
        f"/api/connections/{connection_id}",
        json={"active": True},
    )
    assert activation.status_code == 200
    assert activation.get_json()["active"] is True
    assert activation.get_json()["options"]["enabled"] is True



def test_ad_login_is_unavailable_until_explicitly_enabled(client):
    response = client.post(
        "/api/auth/ad-login",
        json={"username": "someone", "password": "not-a-real-password"},
    )
    assert response.status_code == 503
    assert response.get_json()["error"] == "ad_login_unavailable"


def test_ad_connection_cannot_be_enabled_before_successful_test(client, app):
    _login_settings_admin(client, app, username="ad_admin_enable_gate")
    create = client.post(
        "/api/connections",
        json={
            "name": "Baylan Active Directory",
            "kind": "active_directory",
            "host": "dc01.baylan.local",
            "port": 636,
            "username": "svc-itmanager",
            "secret": "test-bind-password",
            "options": {"base_dn": "DC=baylan,DC=local"},
        },
    )
    assert create.status_code == 201
    response = client.patch(
        f"/api/connections/{create.get_json()['id']}",
        json={"active": True},
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "ad_connection_must_pass_test_before_enable"



def test_ad_login_maps_only_to_an_existing_active_app_user(client, app):
    with app.app_context():
        user = User(username="jdoe", password_hash=generate_password_hash("unused-local-password"), active=True)
        setting = ConnectionSetting(
            name="Baylan Active Directory",
            kind="active_directory",
            host="dc01.baylan.local",
            port=636,
            username="svc-itmanager",
            secret_encrypted=_ad_secret_cipher().encrypt(b"test-bind-password").decode(),
            options={
                "domain": "baylan.local",
                "base_dn": "DC=baylan,DC=local",
                "search_base": "",
                "enabled": True,
                "last_test_ok": True,
                "tls_validate": True,
            },
            active=True,
        )
        db.session.add_all([user, setting])
        db.session.commit()

    service_connection = Mock()
    service_connection.open.return_value = True
    service_connection.bind.return_value = True
    service_connection.search.return_value = True
    service_connection.entries = [
        SimpleNamespace(
            entry_dn="CN=John Doe,OU=Users,DC=baylan,DC=local",
            entry_attributes_as_dict={
                "sAMAccountName": ["jdoe"],
                "userPrincipalName": ["jdoe@baylan.local"],
            },
        )
    ]
    user_connection = Mock()
    user_connection.open.return_value = True
    user_connection.bind.return_value = True

    with patch("backend.app.api.auth_routes.Server") as server_factory, patch(
        "backend.app.api.auth_routes.Connection",
        side_effect=[service_connection, user_connection],
    ):
        response = client.post(
            "/api/auth/ad-login",
            json={"username": "BAYLAN\\jdoe", "password": "valid-ad-password"},
        )

    assert response.status_code == 200
    assert response.get_json()["user"]["username"] == "jdoe"
    assert service_connection.search.call_args.kwargs["search_scope"] is not None
    assert server_factory.call_args.kwargs["use_ssl"] is True


def test_smtp_connection_hides_secret_and_sends_test_email(client, app):
    _login_settings_admin(client, app, username="smtp_admin")
    created = client.post(
        "/api/connections",
        json={
            "name": "Baylan SMTP",
            "kind": "smtp",
            "host": "smtp.example.com",
            "port": 587,
            "username": "mailer@example.com",
            "secret": "smtp-secret-not-for-response",
            "options": {"starttls": True, "use_ssl": False, "from_email": "it@example.com", "test_recipient": "admin@example.com", "private_option": "must-not-leak"},
        },
    )
    assert created.status_code == 201
    payload = created.get_json()
    assert payload["has_secret"] is True
    assert "smtp-secret-not-for-response" not in created.get_data(as_text=True)
    assert "private_option" not in created.get_data(as_text=True)
    connection_id = payload["id"]

    with patch("backend.app.api.connection_routes.smtplib.SMTP") as smtp_factory:
        smtp = smtp_factory.return_value.__enter__.return_value
        response = client.post(f"/api/connections/{connection_id}/test")

    assert response.status_code == 200
    assert response.get_json()["ok"] is True
    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("mailer@example.com", "smtp-secret-not-for-response")
    smtp.send_message.assert_called_once()
    assert "smtp-secret-not-for-response" not in response.get_data(as_text=True)


def test_smtp_rejects_unsafe_tls_configuration(client, app):
    _login_settings_admin(client, app, username="smtp_admin_tls")
    response = client.post(
        "/api/connections",
        json={
            "name": "Invalid SMTP TLS",
            "kind": "smtp",
            "host": "smtp.example.com",
            "port": 587,
            "options": {"use_ssl": True, "starttls": True},
        },
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "smtp_tls_mode_invalid"


def test_backup_status_reports_latest_backup_without_changing_files(client, app, tmp_path, monkeypatch):
    _login_settings_admin(client, app, username="backup_admin")
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path))
    backup_file = tmp_path / "itmanager-2026-10-15.sql.gz"
    backup_file.write_bytes(b"backup-data")
    response = client.get("/api/connections/backup-status")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["latest_backup"]["name"] == backup_file.name
    assert payload["latest_backup"]["size_bytes"] == len(b"backup-data")
    assert backup_file.read_bytes() == b"backup-data"


def test_backup_status_does_not_claim_success_when_directory_missing(client, app, monkeypatch, tmp_path):
    _login_settings_admin(client, app, username="backup_admin_missing")
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path / "not-mounted"))
    response = client.get("/api/connections/backup-status")
    assert response.status_code == 200
    assert response.get_json()["status"] == "not_configured"


def test_api_health_endpoint_requires_login_and_reports_backend_ok(client, app):
    _login_settings_admin(client, app, username="health_admin")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_ad_base_dn_must_belong_to_baylan_domain(client, app):
    _login_settings_admin(client, app, username="ad_admin_dn_check")
    response = client.post("/api/connections", json={
        "name": "Invalid AD DN", "kind": "active_directory",
        "host": "dc01.baylan.local", "port": 636,
        "username": "svc-itmanager", "secret": "test-password",
        "options": {"base_dn": "DC=example,DC=com"},
    })
    assert response.status_code == 400
    assert response.get_json()["error"] == "ad_base_dn_must_be_within_baylan_domain"
