import base64
import hashlib
import re
import ssl

from cryptography.fernet import Fernet, InvalidToken
from flask import Blueprint, current_app, jsonify, request
from ldap3 import Connection, NONE, Server, Tls
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


def item(connection):
    options = connection.options if isinstance(connection.options, dict) else {}
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
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)*baylan\\.local", host):
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
        # AD must remain disabled until the real DC and the login flow are verified.
        active = False
        options.update({
            "domain": AD_DOMAIN,
            "base_dn": str(options.get("base_dn") or DEFAULT_BASE_DN).strip(),
            "search_base": str(options.get("search_base") or "").strip(),
            "tls_validate": True,
            "enabled": False,
        })
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
    if "options" in data:
        options = _clean_options(data["options"])
        if connection.kind == AD_KIND:
            options.update({
                "domain": AD_DOMAIN,
                "base_dn": str(options.get("base_dn") or DEFAULT_BASE_DN).strip(),
                "search_base": str(options.get("search_base") or "").strip(),
                "tls_validate": True,
                "enabled": False,
            })
        connection.options = options
    if data.get("secret"):
        connection.secret_encrypted = crypt().encrypt(str(data["secret"]).encode()).decode()
    # The AD login flow is not enabled by configuration alone.
    if connection.kind == AD_KIND:
        connection.active = False
        options = _clean_options(connection.options)
        options["enabled"] = False
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

    options = _clean_options(connection.options)
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
            if bind_user and bind_password:
                if not ldap_connection.bind():
                    raise LDAPException("LDAP bind failed")
            else:
                return jsonify({
                    "ok": True,
                    "tls": "verified",
                    "credentials_checked": False,
                    "message": "LDAPS bağlantısı ve sertifika doğrulaması başarılı; bind hesabı/parolası tanımlanmadığı için kimlik doğrulaması test edilmedi.",
                })
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

    return jsonify({
        "ok": True,
        "tls": "verified",
        "credentials_checked": True,
        "message": "LDAPS sertifikası ve bağlantı hesabı doğrulandı. Kurumsal giriş, ayrıca uygulama tarafında etkinleştirilmelidir.",
    })
