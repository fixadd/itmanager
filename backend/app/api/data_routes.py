import io
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from flask import Blueprint, current_app, jsonify, request, send_file, session
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import AuditLog
from .auth_routes import current_user, permission_required

data_bp = Blueprint("data", __name__)


def _database_url():
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not uri.startswith("postgresql"):
        raise RuntimeError("PostgreSQL bağlantısı gerekli")
    return urlparse(uri.replace("postgresql+psycopg://", "postgresql://", 1))


def _pg_connection(url):
    return url.hostname or "localhost", str(url.port or 5432), unquote(url.username or ""), unquote((url.path or "").lstrip("/"))


def _pg_env(url):
    env = os.environ.copy()
    env["PGPASSWORD"] = unquote(url.password or "")
    return env


def _verify_account_password(data):
    user = current_user()
    password = str((data or {}).get("password") or "")
    if not user or not password or not check_password_hash(user.password_hash, password):
        return None
    return user


def _reset_public_schema(url):
    # Only the application's public schema is reset; the PostgreSQL volume and uploaded files remain untouched.
    db.session.remove()
    with db.engine.begin() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public AUTHORIZATION CURRENT_USER"))
        connection.execute(text("GRANT ALL ON SCHEMA public TO CURRENT_USER"))


def _restore_toc_without_managed_objects(listing):
    """Keep public schema and pg_trgm extension out of pg_restore --clean.

    The target schema/extension are prepared additively before the restore.
    Excluding these TOC entries prevents --clean from dropping public while
    later archive entries still need it.
    """
    managed_object_patterns = (
        re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+public(?:\s|$)"),
        re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+EXTENSION\s+-\s+pg_trgm(?:\s|$)"),
        re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+COMMENT(?:\s+-)?\s+SCHEMA\s+public(?:\s|$)"),
    )
    filtered = []
    for line in listing.splitlines():
        if any(pattern.search(line) for pattern in managed_object_patterns):
            filtered.append("; " + line)
        else:
            filtered.append(line)
    return "\n".join(filtered) + "\n"
def _write_database_audit(action, actor_name, details=None):
    db.session.add(AuditLog(
        action=action,
        entity_type="database",
        actor_user_id=None,
        details={"actor_username": actor_name, **(details or {})},
    ))
    db.session.commit()


@data_bp.post("/data/backup")
@permission_required("settings.manage")
def backup():
    data = request.get_json(silent=True) or {}
    actor = _verify_account_password(data)
    if not actor:
        return jsonify({"error": "Hesap şifresi hatalı"}), 401
    actor_name = actor.username
    try:
        url = _database_url()
        host, port, username, database = _pg_connection(url)
        env = _pg_env(url)
        result = subprocess.run(
            ["pg_dump", "--no-password", "--format=custom", "--no-owner", "--no-privileges",
             "--host", host, "--port", port, "--username", username, database],
            capture_output=True, check=True, env=env, timeout=3600,
        )
        if not result.stdout:
            raise RuntimeError("pg_dump boş çıktı üretti")
        _write_database_audit("database.backup", actor_name, {"format": "custom"})
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        return send_file(
            io.BytesIO(result.stdout), as_attachment=True,
            download_name=f"itmanager-{stamp}.dump", mimetype="application/octet-stream",
        )
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Database export failed (%s)", type(exc).__name__)
        return jsonify({"error": "Veritabanı dışa aktarılamadı"}), 500


@data_bp.post("/data/reset")
@permission_required("settings.manage")
def reset_database():
    data = request.get_json(silent=True) or {}
    actor = _verify_account_password(data)
    if not actor:
        return jsonify({"error": "Hesap şifresi hatalı"}), 401
    if str(data.get("confirmation") or "").strip() != "SIFIRLA":
        return jsonify({"error": "Onay için SIFIRLA yazılmalıdır"}), 400

    actor_name = actor.username
    password = str(data.get("password") or "")
    previous_auth_disabled = os.environ.get("AUTH_DISABLED")
    previous_admin_username = os.environ.get("ADMIN_USERNAME")
    try:
        url = _database_url()
        _reset_public_schema(url)
        # Reuse the project's Alembic migrations and initial-data bootstrap, not create_all/drop_all.
        # Seed a temporary admin using the current account name, then set its hash to the
        # already-verified password so the operator can log back in after the reset.
        os.environ["AUTH_DISABLED"] = "true"
        os.environ["ADMIN_USERNAME"] = actor_name
        from backend.init_db import bootstrap
        bootstrap(current_app._get_current_object())
        from ..models import User
        new_admin = User.query.filter_by(username=actor_name).first()
        if not new_admin:
            raise RuntimeError("Initial administrator was not created")
        new_admin.password_hash = generate_password_hash(password)
        new_admin.active = True
        db.session.commit()
        _write_database_audit("database.reset", actor_name, {"method": "public_schema_recreated"})
        session.clear()
        return jsonify({"message": "Veritabanı sıfırlandı. Yönetici hesabı aynı kullanıcı adı ve şifreyle yeniden oluşturuldu; tekrar giriş yapın."})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Database reset failed (%s)", type(exc).__name__)
        session.clear()
        return jsonify({"error": "Veritabanı sıfırlanamadı. Sunucu loglarını kontrol edin."}), 500
    finally:
        if previous_auth_disabled is None:
            os.environ.pop("AUTH_DISABLED", None)
        else:
            os.environ["AUTH_DISABLED"] = previous_auth_disabled
        if previous_admin_username is None:
            os.environ.pop("ADMIN_USERNAME", None)
        else:
            os.environ["ADMIN_USERNAME"] = previous_admin_username


@data_bp.post("/data/restore")
@permission_required("settings.manage")
def restore():
    actor = _verify_account_password(request.form)
    if not actor:
        return jsonify({"error": "Hesap şifresi hatalı"}), 401
    if str(request.form.get("confirmation") or "").strip() != "GERIYUKLE":
        return jsonify({"error": "Onay için GERIYUKLE yazılmalıdır"}), 400
    if "file" not in request.files:
        return jsonify({"error": "Veritabanı yedek dosyası gerekli"}), 400

    upload = request.files["file"]
    filename = Path(upload.filename or "").name
    suffix = Path(filename).suffix.lower()
    if not filename or suffix not in {".dump", ".backup"}:
        return jsonify({"error": "Yalnızca IT Manager PostgreSQL .dump veya .backup dosyaları kabul edilir"}), 400

    temp_path = None
    actor_name = actor.username
    try:
        url = _database_url()
        host, port, username, database = _pg_connection(url)
        env = _pg_env(url)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
            upload.save(temp.name)
            temp_path = temp.name
        if os.path.getsize(temp_path) == 0:
            return jsonify({"error": "Yedek dosyası boş"}), 400

        listing = subprocess.run(
            ["pg_restore", "--list", temp_path], capture_output=True, text=True,
            check=True, env=env, timeout=60,
        ).stdout
        has_public_schema = any("SCHEMA - public" in line for line in listing.splitlines())
        if not has_public_schema:
            return jsonify({"error": "Yedek dosyasında public şeması bulunamadı; veritabanı değiştirilmedi"}), 400

        # Keep public and pg_trgm outside pg_restore's --clean list. Some dumps
        # place extension/schema comments and dependencies in an order that can
        # leave later entries referencing a missing public schema.
        db.session.remove()
        subprocess.run(
            ["psql", "--no-password", "--set", "ON_ERROR_STOP=1",
             "--host", host, "--port", port, "--username", username,
             "--dbname", database, "--command",
             "CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION CURRENT_USER; "
             "GRANT ALL ON SCHEMA public TO CURRENT_USER; "
             "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;"],
            capture_output=True, text=True, check=True, env=env, timeout=60,
        )

        toc_path = None
        try:
            filtered_listing = _restore_toc_without_managed_objects(listing)
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", suffix=".list", delete=False
            ) as toc_file:
                toc_file.write(filtered_listing)
                toc_path = toc_file.name

            # The restore itself remains atomic. If any archive entry fails,
            # PostgreSQL rolls back table drops and partial data/object restores.
            command = ["pg_restore", "--exit-on-error", "--single-transaction",
                       "--no-owner", "--no-privileges", "--clean", "--if-exists",
                       "--use-list", toc_path, "--host", host, "--port", port,
                       "--username", username, "--dbname", database, temp_path]
            completed = subprocess.run(
                command, capture_output=True, text=True, env=env, timeout=3600
            )
        finally:
            if toc_path:
                try:
                    os.unlink(toc_path)
                except OSError:
                    current_app.logger.warning("Could not remove temporary restore TOC file")
        if completed.returncode != 0:
            stderr_tail = (completed.stderr or "")[-4000:]
            current_app.logger.error(
                "Database restore command failed (exit %s): %s",
                completed.returncode, stderr_tail,
            )
            raise RuntimeError("Yedek dosyası geri yüklenemedi")
        db.session.remove()
        _write_database_audit("database.restore", actor_name, {"filename": filename})
        session.clear()
        return jsonify({"message": "Veritabanı içe aktarıldı. Yeniden giriş yapın."})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Database import failed (%s)", type(exc).__name__)
        session.clear()
        return jsonify({"error": "Veritabanı içe aktarılamadı. Yedek formatını ve sunucu loglarını kontrol edin."}), 500
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                current_app.logger.warning("Could not remove temporary database import file")
