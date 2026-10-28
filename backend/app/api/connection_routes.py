import base64
import hashlib
import ssl
import os
import smtplib
import re
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from ldap3 import BASE, Connection, NONE, Server, Tls
from ldap3.core.exceptions import LDAPException

from ..extensions import db
from ..models import AuditLog, ConnectionSetting
from .auth_routes import current_user, permission_required
from ..backup_service import create_backup, get_backup_settings, update_backup_schedule, _resolve_backup_directory

connections_bp = Blueprint("connections", __name__)
AD_KIND = "active_directory"
AD_NAME = "Baylan Active Directory"
AD_DOMAIN = "baylan.local"
DEFAULT_BASE_DN = "DC=baylan,DC=local"
SMTP_KIND = "smtp"
BACKUP_EXTENSIONS = (".dump", ".sql", ".sql.gz", ".tar.gz", ".zip", ".backup", ".pgdump")


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


def _safe_smtp_options(value):
    value = value if isinstance(value, dict) else {}
    return {
        "use_ssl": bool(value.get("use_ssl", False)),
        "starttls": bool(value.get("starttls", True)),
        "from_email": str(value.get("from_email") or "").strip()[:254],
        "test_recipient": str(value.get("test_recipient") or "").strip()[:254],
        "last_test_ok": bool(value.get("last_test_ok", False)),
        "last_test_at": value.get("last_test_at"),
    }


def _valid_email(value):
    value = str(value or "").strip()
    if not value or len(value) > 254 or parseaddr(value)[1] != value or value.count("@") != 1:
        return False
    local, domain = value.rsplit("@", 1)
    return bool(local and "." in domain and not any(ch.isspace() for ch in value))


def item(connection):
    options = connection.options if isinstance(connection.options, dict) else {}
    if connection.kind == AD_KIND:
        options = _safe_ad_options(options)
    elif connection.kind == SMTP_KIND:
        options = _safe_smtp_options(options)
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


def _validate_ad_dn(value):
    value = str(value or "").strip()
    normalized = re.sub(r"\s+", "", value).casefold()
    return bool(value and len(value) <= 512 and "\n" not in value and "\r" not in value and (normalized == "dc=baylan,dc=local" or normalized.endswith(",dc=baylan,dc=local")))


def _validate_ad_host(host):
    host = str(host or "").strip().rstrip(".").lower()
    if not host or "://" in host or "/" in host or ":" in host:
        return None
    # Keep the test target within Baylan's declared AD DNS domain.
    if host != AD_DOMAIN and not host.endswith("." + AD_DOMAIN):
        return None
    labels = host.split(".")
    if len(labels) < 3 or labels[-2:] != ["baylan", "local"]:
        return None
    if any(not label or len(label) > 63 or not label[0].isalnum() or not label[-1].isalnum() or any(not (ch.isalnum() or ch == "-") for ch in label) for label in labels):
        return None
    return host


def _decrypt_secret(connection):
    if not connection.secret_encrypted:
        return ""
    return crypt().decrypt(connection.secret_encrypted.encode()).decode()


def _disable_after_failed_test(connection, reason):
    options = _safe_ad_options(connection.options)
    options["last_test_ok"] = False
    options["last_test_at"] = datetime.now(timezone.utc).isoformat()
    options["enabled"] = False
    connection.options = options
    connection.active = False
    audit("connection.test_failed", connection, {"kind": AD_KIND, "reason": reason})
    db.session.commit()


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
    if kind == SMTP_KIND:
        host = str(host or "").strip().lower()
        try:
            smtp_port = int(data.get("port") or 587)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid_port"}), 400
        if not host or len(host) > 253 or "://" in host or "/" in host or ":" in host or any(not part or len(part) > 63 or not part[0].isalnum() or not part[-1].isalnum() or any(not (ch.isalnum() or ch == "-") for ch in part) for part in host.rstrip(".").split(".")):
            return jsonify({"error": "smtp_host_required"}), 400
        if smtp_port not in (465, 587):
            return jsonify({"error": "smtp_port_must_be_465_or_587"}), 400
        options = _safe_smtp_options(options)
        if (options["use_ssl"] and (smtp_port != 465 or options["starttls"])) or (smtp_port == 587 and (options["use_ssl"] or not options["starttls"])):
            return jsonify({"error": "smtp_tls_mode_invalid"}), 400
        if not options["use_ssl"] and smtp_port == 465:
            return jsonify({"error": "smtp_port_465_requires_ssl"}), 400
    active = bool(data.get("active", True))
    if kind == AD_KIND:
        host = _validate_ad_host(host)
        try:
            requested_port = int(data.get("port") or 636)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid_port"}), 400
        if requested_port != 636:
            return jsonify({"error": "ldaps_636_required"}), 400
        # New AD configurations are never enabled on creation.
        active = False
        options = _safe_ad_options(options)
        if not _validate_ad_dn(options.get("base_dn")) or (options.get("search_base") and not _validate_ad_dn(options.get("search_base"))):
            return jsonify({"error": "ad_base_dn_must_be_within_baylan_domain"}), 400
        options["enabled"] = False
        options["last_test_ok"] = False
        options["last_test_at"] = None
        if data.get("host") and not host:
            return jsonify({"error": "ad_host_must_be_in_baylan_domain"}), 400

    connection = ConnectionSetting(
        name=name,
        kind=kind,
        host=host,
        port=data.get("port") or (636 if kind == AD_KIND else (587 if kind == SMTP_KIND else None)),
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
    was_ad = connection.kind == AD_KIND
    old_host, old_port, old_username, old_secret = connection.host, connection.port, connection.username, connection.secret_encrypted
    old_options = _safe_ad_options(connection.options) if was_ad else {}
    was_smtp = connection.kind == SMTP_KIND
    config_changed = False

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
        new_kind = str(data.get("kind") or "").strip().lower()
        if new_kind != connection.kind:
            config_changed = True
        connection.kind = new_kind

    if "host" in data:
        host = data.get("host")
        if connection.kind == AD_KIND and host:
            host = _validate_ad_host(host)
            if not host:
                db.session.rollback()
                return jsonify({"error": "ad_host_must_be_in_baylan_domain"}), 400
        normalized_host = host or None
        if normalized_host != connection.host:
            config_changed = True
        connection.host = normalized_host

    if "port" in data:
        try:
            port = int(data["port"]) if data["port"] else None
        except (TypeError, ValueError):
            return jsonify({"error": "invalid_port"}), 400
        if connection.kind == AD_KIND and port not in (None, 636):
            return jsonify({"error": "ldaps_636_required"}), 400
        if port != connection.port:
            config_changed = True
        connection.port = port

    if "username" in data:
        username = str(data.get("username") or "").strip() or None
        if username != connection.username:
            config_changed = True
        connection.username = username

    incoming_options = None
    if "options" in data:
        incoming_options = _clean_options(data["options"])
        if connection.kind == AD_KIND:
            incoming_options = _safe_ad_options(incoming_options)
            if not _validate_ad_dn(incoming_options.get("base_dn")) or (incoming_options.get("search_base") and not _validate_ad_dn(incoming_options.get("search_base"))):
                db.session.rollback()
                return jsonify({"error": "ad_base_dn_must_be_within_baylan_domain"}), 400
            old_ad_options = _safe_ad_options(connection.options) if was_ad else {}
            if (
                incoming_options.get("base_dn") != old_ad_options.get("base_dn")
                or incoming_options.get("search_base") != old_ad_options.get("search_base")
            ):
                config_changed = True
        elif connection.kind == SMTP_KIND:
            incoming_options = _safe_smtp_options(incoming_options)
            old_smtp_options = _safe_smtp_options(connection.options) if was_smtp else {}
            if any(incoming_options.get(k) != old_smtp_options.get(k) for k in ("use_ssl", "starttls", "from_email", "test_recipient")):
                config_changed = True
        connection.options = incoming_options

    if data.get("secret"):
        connection.secret_encrypted = crypt().encrypt(str(data["secret"]).encode()).decode()
        if connection.secret_encrypted != old_secret:
            config_changed = True

    if connection.kind == AD_KIND:
        options = _safe_ad_options(connection.options)
        if not config_changed and was_ad:
            options["last_test_ok"] = old_options.get("last_test_ok", False)
            options["last_test_at"] = old_options.get("last_test_at")
        else:
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
    elif connection.kind == SMTP_KIND:
        if "host" in data or "port" in data:
            host_value = str(connection.host or "").strip()
            if not host_value or "://" in host_value or "/" in host_value or ":" in host_value:
                db.session.rollback()
                return jsonify({"error": "smtp_host_required"}), 400
            if connection.port not in (465, 587):
                db.session.rollback()
                return jsonify({"error": "smtp_port_must_be_465_or_587"}), 400
        smtp_options = _safe_smtp_options(connection.options)
        if (smtp_options["use_ssl"] and (int(connection.port or 587) != 465 or smtp_options["starttls"])) or (int(connection.port or 587) == 587 and (smtp_options["use_ssl"] or not smtp_options["starttls"])):
            db.session.rollback()
            return jsonify({"error": "smtp_tls_mode_invalid"}), 400
        if "active" in data:
            connection.active = bool(data["active"])
        connection.options = smtp_options
        if config_changed:
            smtp_options["last_test_ok"] = False
            smtp_options["last_test_at"] = None
            connection.options = smtp_options
    elif "active" in data:
        connection.active = bool(data["active"])

    audit("connection.updated", connection, {"fields": sorted(data.keys()), "kind": connection.kind})
    db.session.commit()
    return jsonify(item(connection))


@connections_bp.post("/connections/<int:connection_id>/test")
@permission_required("settings.manage")
def test_connection(connection_id):
    connection = db.get_or_404(ConnectionSetting, connection_id)
    if connection.kind == SMTP_KIND:
        return _test_smtp_connection(connection)
    if connection.kind != AD_KIND:
        return jsonify({"error": "unsupported_connection_test"}), 400
    host = _validate_ad_host(connection.host)
    if not host:
        return jsonify({"ok": False, "error": "ad_server_fqdn_required"}), 400
    if int(connection.port or 636) != 636:
        return jsonify({"ok": False, "error": "ldaps_636_required"}), 400

    options = _safe_ad_options(connection.options)
    if not _validate_ad_dn(options.get("base_dn")) or (options.get("search_base") and not _validate_ad_dn(options.get("search_base"))):
        return jsonify({"ok": False, "error": "ad_base_dn_must_be_within_baylan_domain"}), 400
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
            search_bases = [base_dn]
            configured_search_base = options.get("search_base")
            if configured_search_base and configured_search_base.casefold() != base_dn.casefold():
                search_bases.append(configured_search_base)
            for search_base in search_bases:
                if not ldap_connection.search(
                    search_base=search_base,
                    search_filter="(objectClass=*)",
                    search_scope=BASE,
                    attributes=["distinguishedName"],
                ) or not ldap_connection.entries:
                    raise LDAPException("Configured search base could not be searched")
        finally:
            try:
                ldap_connection.unbind()
            except Exception:
                pass
    except (LDAPException, OSError, ssl.SSLError, InvalidToken, ValueError) as exc:
        current_app.logger.warning("AD connection test failed for connection id=%s (%s)", connection.id, type(exc).__name__)
        _disable_after_failed_test(connection, type(exc).__name__)
        return jsonify({
            "ok": False,
            "error": "ad_connection_test_failed",
            "message": "LDAPS bağlantısı, sertifika doğrulaması veya hesap doğrulaması başarısız. Sunucu, sertifika ve hesap ayarlarını kontrol edin.",
        }), 502
    except Exception as exc:
        current_app.logger.warning("Unexpected AD test error for connection id=%s (%s)", connection.id, type(exc).__name__)
        _disable_after_failed_test(connection, type(exc).__name__)
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
        "connection": item(connection),
    })


def _test_smtp_connection(connection):
    options = _safe_smtp_options(connection.options)
    host = str(connection.host or "").strip()
    port = int(connection.port or 587)
    recipient = options["test_recipient"]
    sender = options["from_email"]
    if not host or port not in (465, 587):
        return jsonify({"ok": False, "error": "smtp_host_or_port_invalid"}), 400
    if not _valid_email(sender) or not _valid_email(recipient):
        return jsonify({"ok": False, "error": "smtp_sender_and_test_recipient_required", "message": "Gönderen ve test alıcısı için geçerli e-posta adresi girin."}), 400
    if (options["use_ssl"] and (port != 465 or options["starttls"])) or (port == 587 and (options["use_ssl"] or not options["starttls"])):
        return jsonify({"ok": False, "error": "smtp_tls_mode_invalid"}), 400
    if not options["use_ssl"] and port == 465:
        return jsonify({"ok": False, "error": "smtp_port_465_requires_ssl"}), 400
    try:
        password = _decrypt_secret(connection) if connection.secret_encrypted else ""
        timeout = 8
        if options["use_ssl"]:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
        with server:
            server.ehlo()
            if options["starttls"] and not options["use_ssl"]:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if connection.username:
                if not password:
                    return jsonify({"ok": False, "error": "smtp_password_required", "message": "Kullanıcı adı tanımlı; SMTP parolası kaydedilmelidir."}), 400
                server.login(connection.username, password)
            message = EmailMessage()
            message["Subject"] = "Baylan IT Manager - SMTP bağlantı testi"
            message["From"] = sender
            message["To"] = recipient
            message.set_content("Bu ileti, Baylan IT Manager SMTP bağlantı testinin başarılı olduğunu doğrulamak için gönderilmiştir.")
            server.send_message(message)
    except (OSError, smtplib.SMTPException, ssl.SSLError, ValueError) as exc:
        current_app.logger.warning("SMTP connection test failed for connection id=%s (%s)", connection.id, type(exc).__name__)
        options["last_test_ok"] = False
        options["last_test_at"] = datetime.now(timezone.utc).isoformat()
        connection.options = options
        audit("connection.test_failed", connection, {"kind": SMTP_KIND, "reason": type(exc).__name__})
        db.session.commit()
        return jsonify({"ok": False, "error": "smtp_connection_test_failed", "message": "SMTP bağlantısı veya test e-postası başarısız. Sunucu, TLS ve hesap ayarlarını kontrol edin."}), 502
    options["last_test_ok"] = True
    options["last_test_at"] = datetime.now(timezone.utc).isoformat()
    connection.options = options
    audit("connection.test_succeeded", connection, {"kind": SMTP_KIND, "tls": "verified", "test_email_sent": True})
    db.session.commit()
    return jsonify({"ok": True, "message": "SMTP bağlantısı doğrulandı ve test e-postası gönderildi.", "connection": item(connection)})


@connections_bp.get("/connections/backup-settings")
@permission_required("settings.manage")
def backup_settings():
    return jsonify(get_backup_settings())


@connections_bp.post("/connections/backup-settings")
@permission_required("settings.manage")
def save_backup_settings():
    data = request.get_json(silent=True) or {}
    frequency = str(data.get("frequency") or "daily").lower()
    try:
        hour = int(data.get("hour", 2))
        minute = int(data.get("minute", 0))
        weekday = int(data.get("weekday", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "backup_schedule_values_invalid"}), 400
    if frequency not in {"daily", "weekly"} or not 0 <= hour <= 23 or not 0 <= minute <= 59 or not 0 <= weekday <= 6:
        return jsonify({"error": "backup_schedule_values_invalid"}), 400
    requested_directory = str(data.get("directory") or get_backup_settings().get("directory") or "/backups").strip()
    try:
        resolved_directory = _resolve_backup_directory(current_app._get_current_object(), requested_directory)
    except (OSError, ValueError):
        return jsonify({"error": "backup_directory_invalid",
                        "message": "Yedek klasörü, sunucuda Docker'a bağlanan yedek kök klasörünün içinde olmalıdır (ör. /backups veya /backups/arsiv)."}), 400
    setting = ConnectionSetting.query.filter_by(kind="backup_schedule").first()
    if not setting:
        setting = ConnectionSetting(name="IT Manager Database Backup Schedule", kind="backup_schedule", active=True, options={})
        db.session.add(setting)
    old = setting.options if isinstance(setting.options, dict) else {}
    setting.options = {
        "enabled": bool(data.get("enabled", False)), "frequency": frequency, "hour": hour,
        "minute": minute, "weekday": weekday, "directory": str(resolved_directory),
        "last_run_at": old.get("last_run_at"), "last_result": old.get("last_result", "never"),
        "last_error": old.get("last_error"), "last_backup": old.get("last_backup"),
    }
    setting.active = bool(data.get("enabled", False))
    audit("backup.schedule_updated", setting, {"enabled": setting.options["enabled"],
          "frequency": frequency, "hour": hour, "minute": minute, "weekday": weekday})
    db.session.commit()
    update_backup_schedule(current_app._get_current_object(), get_backup_settings())
    return jsonify(get_backup_settings())


@connections_bp.post("/connections/backup-now")
@permission_required("settings.manage")
def backup_now():
    setting = ConnectionSetting.query.filter_by(kind="backup_schedule").first()
    if not setting:
        setting = ConnectionSetting(name="IT Manager Database Backup Schedule", kind="backup_schedule",
                                    active=False, options={"enabled": False, "frequency": "daily", "hour": 2,
                                                           "minute": 0, "weekday": 0})
        db.session.add(setting)
        db.session.flush()
    options = dict(setting.options) if isinstance(setting.options, dict) else {}
    options["last_run_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = create_backup(current_app._get_current_object())
        options["last_result"] = "success"
        options["last_error"] = None
        options["last_backup"] = result
        setting.options = options
        audit("backup.manual_succeeded", setting, {"file": result["name"], "size_bytes": result["size_bytes"]})
        db.session.commit()
        return jsonify({"ok": True, "message": "Veritabanı yedeği başarıyla oluşturuldu.",
                        "backup": result, "schedule": get_backup_settings()})
    except Exception as exc:
        current_app.logger.warning("Manual database backup failed (%s)", type(exc).__name__)
        options["last_result"] = "failed"
        options["last_error"] = "Yedek oluşturulamadı. Sunucu loglarını kontrol edin."
        setting.options = options
        audit("backup.manual_failed", setting, {"reason": type(exc).__name__})
        db.session.commit()
        return jsonify({"ok": False, "error": "backup_failed", "message": options["last_error"]}), 502


@connections_bp.get("/connections/backup-status")
@permission_required("settings.manage")
def backup_status():
    configured_path = get_backup_settings().get("directory") or str(current_app.config.get("BACKUP_DIR") or os.environ.get("BACKUP_DIR") or "/backups")
    directory = Path(configured_path)
    if not directory.is_dir():
        return jsonify({"status": "not_configured", "directory": configured_path, "latest_backup": None,
                        "message": "Yedek klasörü erişilebilir değil. BACKUP_DIR ayarını ve salt okunur volume bağlantısını kontrol edin."})
    try:
        files = [p for p in directory.iterdir() if p.is_file() and p.name.lower().endswith(BACKUP_EXTENSIONS)]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            return jsonify({"status": "missing", "directory": configured_path, "latest_backup": None,
                            "message": "Klasörde tanınan bir yedek dosyası bulunamadı."})
        latest = files[0]
        stat = latest.stat()
        age_seconds = max(0, int(datetime.now(timezone.utc).timestamp() - stat.st_mtime))
        status = "ok" if age_seconds <= 24 * 60 * 60 else "stale"
        return jsonify({"status": status, "directory": configured_path,
                        "latest_backup": {"name": latest.name, "size_bytes": stat.st_size,
                                          "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                                          "age_seconds": age_seconds},
                        "recognized_files": len(files),
                        "message": "Son 24 saat içinde yedek dosyası bulundu." if status == "ok" else "En son yedek 24 saatten eski; yedekleme görevini kontrol edin."})
    except OSError as exc:
        current_app.logger.warning("Backup status check failed (%s)", type(exc).__name__)
        return jsonify({"status": "error", "directory": configured_path, "latest_backup": None,
                        "message": "Yedek klasörü okunamadı."}), 503
