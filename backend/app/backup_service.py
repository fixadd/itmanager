import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.engine import make_url

from .extensions import db
from .models import ConnectionSetting

logger = logging.getLogger(__name__)
_scheduler = None
_scheduler_lock = Lock()
_schedule_signature = None


def _backup_root(app):
    return Path(str(app.config.get("BACKUP_DIR") or os.environ.get("BACKUP_DIR") or "/backups")).resolve()


def _resolve_backup_directory(app, configured_path=None):
    root = _backup_root(app)
    raw_path = str(configured_path or root)
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError("Backup directory must be inside the configured backup root")
    return resolved


def get_backup_settings():
    setting = ConnectionSetting.query.filter_by(kind="backup_schedule").first()
    options = setting.options if setting and isinstance(setting.options, dict) else {}
    app = __import__("flask").current_app
    try:
        directory = str(_resolve_backup_directory(app, options.get("directory")))
    except (OSError, ValueError):
        directory = str(_backup_root(app))
    return {
        "enabled": bool(options.get("enabled", False)),
        "frequency": options.get("frequency", "daily") if options.get("frequency") in {"daily", "weekly"} else "daily",
        "hour": int(options.get("hour", 2)),
        "minute": int(options.get("minute", 0)),
        "weekday": int(options.get("weekday", 0)),
        "directory": directory,
        "last_run_at": options.get("last_run_at"),
        "last_result": options.get("last_result", "never"),
        "last_error": options.get("last_error"),
    }


def create_backup(app):
    with app.app_context():
        settings = get_backup_settings()
        backup_dir = _resolve_backup_directory(app, settings.get("directory"))
        backup_dir.mkdir(parents=True, exist_ok=True)
        now = datetime.now(timezone.utc)
        stamp = now.strftime("%Y%m%d-%H%M%S")
        final_path = backup_dir / f"itmanager-{stamp}.dump"
        temp_path = backup_dir / f".{final_path.name}.partial"
        db_url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
        if db_url.drivername not in {"postgresql", "postgresql+psycopg", "postgresql+psycopg2"}:
            raise RuntimeError("Backup requires a PostgreSQL database")
        env = os.environ.copy()
        if db_url.password:
            env["PGPASSWORD"] = db_url.password
        command = ["pg_dump", "--no-password", "--format=custom", "--file", str(temp_path)]
        if db_url.host:
            command.extend(["--host", db_url.host])
        if db_url.port:
            command.extend(["--port", str(db_url.port)])
        if db_url.username:
            command.extend(["--username", db_url.username])
        command.append(db_url.database or "")
        try:
            completed = subprocess.run(command, env=env, capture_output=True, text=True, timeout=3600, check=False)
            if completed.returncode != 0:
                raise RuntimeError("pg_dump failed")
            if not temp_path.is_file() or temp_path.stat().st_size == 0:
                raise RuntimeError("pg_dump produced an empty backup")
            temp_path.replace(final_path)
            return {"name": final_path.name, "size_bytes": final_path.stat().st_size,
                    "created_at": datetime.fromtimestamp(final_path.stat().st_mtime, timezone.utc).isoformat()}
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Could not remove incomplete backup temporary file")


def _run_scheduled_backup(app):
    with app.app_context():
        setting = ConnectionSetting.query.filter_by(kind="backup_schedule").first()
        if not setting or not isinstance(setting.options, dict) or not setting.options.get("enabled"):
            return
        options = dict(setting.options)
        options["last_run_at"] = datetime.now(timezone.utc).isoformat()
        try:
            result = create_backup(app)
            options["last_result"] = "success"
            options["last_error"] = None
            options["last_backup"] = result
        except Exception as exc:
            logger.exception("Scheduled database backup failed (%s)", type(exc).__name__)
            options["last_result"] = "failed"
            options["last_error"] = "Yedek oluşturulamadı. Sunucu loglarını kontrol edin."
        setting.options = options
        db.session.commit()


def _apply_schedule(app, settings):
    global _schedule_signature
    signature = (settings["enabled"], settings["frequency"], settings["hour"], settings["minute"], settings["weekday"])
    if signature == _schedule_signature:
        return
    scheduler = _scheduler
    if not scheduler:
        return
    if scheduler.get_job("itmanager_database_backup"):
        scheduler.remove_job("itmanager_database_backup")
    if settings["enabled"]:
        timezone_name = os.environ.get("BACKUP_TIMEZONE", "Europe/Istanbul")
        try:
            zone = ZoneInfo(timezone_name)
        except Exception:
            zone = ZoneInfo("UTC")
        trigger_args = {"hour": settings["hour"], "minute": settings["minute"], "timezone": zone}
        if settings["frequency"] == "weekly":
            trigger_args["day_of_week"] = settings["weekday"]
        scheduler.add_job(_run_scheduled_backup, CronTrigger(**trigger_args), args=[app],
                          id="itmanager_database_backup", replace_existing=True, max_instances=1,
                          coalesce=True, misfire_grace_time=3600)
    _schedule_signature = signature


def refresh_backup_schedule(app):
    try:
        with app.app_context():
            settings = get_backup_settings()
        _apply_schedule(app, settings)
    except Exception as exc:
        logger.warning("Backup schedule could not be loaded (%s)", type(exc).__name__)


def start_backup_scheduler(app):
    global _scheduler
    if app.config.get("TESTING") or os.environ.get("BACKUP_SCHEDULER_DISABLED", "").lower() == "true":
        return
    with _scheduler_lock:
        if _scheduler is None:
            _scheduler = BackgroundScheduler(timezone=os.environ.get("BACKUP_TIMEZONE", "Europe/Istanbul"), daemon=True)
            _scheduler.add_job(refresh_backup_schedule, "interval", seconds=60, args=[app],
                               id="itmanager_backup_schedule_refresh", replace_existing=True)
            _scheduler.start()
    refresh_backup_schedule(app)


def update_backup_schedule(app, settings):
    _apply_schedule(app, settings)
