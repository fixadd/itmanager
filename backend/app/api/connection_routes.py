import base64
import hashlib
import ssl

from cryptography.fernet import Fernet, InvalidToken
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from ldap3 import BASE, Connection, NONE, Server, Tls
from ldap3.core.exceptions import LDAPException

from ..extensions import db
from ..models import AuditLog, ConnectionSetting
from .auth_routes import current_user, permission_required

connections_bp = Blueprint("connections", __name__)
AD_KIND = "active_directory"
AD_NAME = "Baylan Active Directory"
AD_DOMAIN = "baylan.local"
DEFAULT_BASE_DN = "DC=baylan,DC=local"


def crypt():
    secret_key = current_app.config.get("SECRET_KEY")
    if not secret_key or len(str(secret_key)) < 32:
        raise RuntimeError("A valid SECRET_KEY is required to encrypt connection secrets")
    key = base64.urlsafe_b64encode(hashlib.sha256(str(secret_key).encode()).digest())
    return Fernet(key)


def _safe_ad_options(value):
    value = value if isinstance(value, dict) else {}
    # Explicit allow-list: arbitrary client options must never be able to echo secrets.
    return {
        "domain": AD_DOMAIN,
        "base_dn": str(value.get("base_dn") or DEFAULT_BASE_DN).strip(),
        "search_base": str(value.get("search_base") or "").strip(),
        "tls_validate": True,
        "enabled": bool(value.get("enabled", False)),
        "last_test_ok": bool(value.get("last_test_ok", False)),
        "last_test_at": value.get("last_test_at"),
    }


def item(connection):
    options = connection.options if isinstance(connection.options, dict) else {}
    if connection.kind == AD_KIND:
        options = _safe_ad_options(options)
    # Never return secret_encrypted or decrypted secret to the browser.
    return {
        "id": connection.id,
        "name": connection.name,
        "kind": connection.kind,
        "host": connection.host,
        "port": connection.port,
        "username": connection.username,
        "active": connection.active,
        "options": options,
        "has_secret": bool(connection.secret_encrypted),
    }


def audit(action, connection, details):
    user = current_user()
    db.session.add(AuditLog(
        action=action,
        entity_type="connection",
        entity_id=connection.id,
        actor_user_id=user.id if user else None,
        details=details,
    ))


def _clean_options(value):
    return value if isinstance(value, dict) else {}


def _validate_ad_host(host):
    host = str(host or "").strip().rstrip(".").lower()
    if not host or "://" in host or "/" in host or ":" in host:
        return None
    # Keep the test target within Baylan's declared AD DNS domain.
    if host != AD_DOMAIN and not host.endswith("." + AD_DOMAIN):
        return None
    labels = host.split(".")
    if len(labels) < 2 or labels[-2:] != ["baylan", "local"]:
        return None
    if any(not label or len(label) > 63 or not label[0].isalnum() or not label[-1].isalnum() or any(not (ch.isalnum() or ch == "-") for ch in label) for label in labels):
        return None
    return host


def _decrypt_secret(connection):
    if not connection.secret_encrypted:
        return ""
    return crypt().decrypt(connection.secret_encrypted.encode()).decode()


@connections_bp.get("/connections")
@permission_required("settings.manage")
def list_connections():
    connections = ConnectionSetting.query.filter(
        ConnectionSetting.kind != "branding"
    ).order_by(ConnectionSetting.name).all()
    return jsonify({"items": [item(connection) for connection in connections]})


@connections_bp.post("/connections")
@permission_required("settings.manage")
def create_connection():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    kind = str(data.get("kind") or "").strip().lower()
    if not name or not kind:
        return jsonify({"error": "name ve kind zorunludur"}), 400
    if ConnectionSetting.query.filter(db.func.lower(ConnectionSetting.name) == name.lower()).first():
        return jsonify({"error": "connection_exists"}), 409

    options = _clean_options(data.get("options"))
    host = data.get("host")
    active = bool(data.get("active", True))
    if kind == AD_KIND:
        host = _validate_ad_host(host)
        # New AD configurations are never enabled on creation.
        active = False
        options = _safe_ad_options(options)
        options["enabled"] = False
        options["last_test_ok"] = False
        options["last_test_at"] = None
        if data.get("host") and not host:
            return jsonify({"error": "ad_host_must_be_in_baylan_domain"}), 400

    connection = ConnectionSetting(
        name=name,
        kind=kind,
        host=host,
        port=data.get("port") or (636 if kind == AD_KIND else None),
        username=str(data.get("username") or "").strip() or None,
        options=options,
        active=active,
    )
    if data.get("secret"):
        connection.secret_encrypted = crypt().encrypt(str(data["secret"]).encode()).decode()
    db.session.add(connection)
    db.session.flush()
    audit("connection.created", connection, {"name": connection.name, "kind": connection.kind})
    db.session.commit()
    return jsonify(item(connection)), 201


@connections_bp.patch("/connections/<int:connection_id>")
@permission_required("settings.manage")
def update_connection(connection_id):
    connection = db.get_or_404(ConnectionSetting, connection_id)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name_required"}), 400
        duplicate = ConnectionSetting.query.filter(
            db.func.lower(ConnectionSetting.name) == name.lower(),
            ConnectionSetting.id != connection.id,
        ).first()
        if duplicate:
            return jsonify({"error": "connection_exists"}), 409
        connection.name = name
    if "kind" in data:
        connection.kind = str(data.get("kind") or "").strip().lower()
    if "host" in data:
        host = data.get("host")
        if connection.kind == AD_KIND and host:
            host = _validate_ad_host(host)
            if not host:
                db.session.rollback()
                return jsonify({"error": "ad_host_must_be_in_baylan_domain"}), 400
        connection.host = host or None
    if "port" in data:
        connection.port = data["port"] or None
    if "username" in data:
        connection.username = str(data.get("username") or "").strip() or None
    ad_config_changed = any(key in data for key in ("host", "port", "username", "options", "secret", "kind"))
    if "options" in data:
        options = _clean_options(data["options"])
        if connection.kind == AD_KIND:
            options = _safe_ad_options(options)
        connection.options = options
    if data.get("secret"):
        connection.secret_encrypted = crypt().encrypt(str(data["secret"]).encode()).decode()
    if connection.kind == AD_KIND:
        options = _safe_ad_options(connection.options)
        if ad_config_changed:
            options["last_test_ok"] = False
            options["last_test_at"] = None
        requested_active = bool(data.get("active", connection.active))
        if requested_active and not options.get("last_test_ok"):
            db.session.rollback()
            return jsonify({"error": "ad_connection_must_pass_test_before_enable"}), 400
        if requested_active and (not connection.host or not connection.username or not connection.secret_encrypted):
            db.session.rollback()
            return jsonify({"error": "ad_bind_credentials_required_before_enable"}), 400
        connection.active = requested_active
        options["enabled"] = requested_active
        options["tls_validate"] = True
        connection.options = options
    elif "active" in data:
        connection.active = bool(data["active"])

    audit("connection.updated", connection, {"fields": sorted(data.keys()), "kind": connection.kind})
    db.session.commit()
    return jsonify(item(connection))


@connections_bp.post("/connections/<int:connection_id>/test")
@permission_required("settings.manage")
def test_connection(connection_id):
    connection = db.get_or_404(ConnectionSetting, connection_id)
    if connection.kind != AD_KIND:
        return jsonify({"error": "unsupported_connection_test"}), 400
    host = _validate_ad_host(connection.host)
    if not host:
        return jsonify({"ok": False, "error": "ad_server_fqdn_required"}), 400
    if int(connection.port or 636) != 636:
        return jsonify({"ok": False, "error": "ldaps_636_required"}), 400

    options = _safe_ad_options(connection.options)
    if not connection.username or not connection.secret_encrypted:
        return jsonify({
            "ok": False,
            "error": "ad_bind_credentials_required",
            "message": "Bağlantı testi için Bind kullanıcı hesabı ve parolası gereklidir.",
        }), 400
    try:
        tls = Tls(validate=ssl.CERT_REQUIRED, version=ssl.PROTOCOL_TLS_CLIENT)
        server = Server(
            host,
            port=636,
            use_ssl=True,
            tls=tls,
            connect_timeout=5,
            get_info=NONE,
        )
        bind_user = connection.username
        bind_password = _decrypt_secret(connection)
        ldap_connection = Connection(
            server,
            user=bind_user or None,
            password=bind_password or None,
            receive_timeout=5,
            auto_bind=False,
            raise_exceptions=True,
        )
        try:
            if not ldap_connection.open():
                raise LDAPException("LDAPS connection could not be opened")
            if not ldap_connection.bind():
                raise LDAPException("LDAP bind failed")
            base_dn = options.get("base_dn") or DEFAULT_BASE_DN
            if not ldap_connection.search(
                search_base=base_dn,
                search_filter="(objectClass=*)",
                search_scope=BASE,
                attributes=["distinguishedName"],
            ) or not ldap_connection.entries:
                raise LDAPException("Configured Base DN could not be searched")
        finally:
            try:
                ldap_connection.unbind()
            except Exception:
                pass
    except (LDAPException, OSError, ssl.SSLError, InvalidToken, ValueError) as exc:
        current_app.logger.warning("AD connection test failed for connection id=%s (%s)", connection.id, type(exc).__name__)
        return jsonify({
            "ok": False,
            "error": "ad_connection_test_failed",
            "message": "LDAPS bağlantısı, sertifika doğrulaması veya hesap doğrulaması başarısız. Sunucu, sertifika ve hesap ayarlarını kontrol edin.",
        }), 502
    except Exception as exc:
        current_app.logger.warning("Unexpected AD test error for connection id=%s (%s)", connection.id, type(exc).__name__)
        return jsonify({"ok": False, "error": "ad_connection_test_failed", "message": "Bağlantı testi tamamlanamadı."}), 502

    options["last_test_ok"] = True
    options["last_test_at"] = datetime.now(timezone.utc).isoformat()
    options["enabled"] = False
    connection.options = options
    connection.active = False
    audit("connection.test_succeeded", connection, {"kind": AD_KIND, "tls": "verified", "credentials_checked": True})
    db.session.commit()
    return jsonify({
        "ok": True,
        "tls": "verified",
        "credentials_checked": True,
        "message": "LDAPS, sertifika, Bind hesabı ve Base DN doğrulandı. AD girişi otomatik açılmadı; etkinleştirme için ayrıca onay gerekir.",
    })
