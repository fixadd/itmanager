import os
import secrets
from pathlib import Path

from flask_migrate import stamp, upgrade
from sqlalchemy import inspect

from .app import create_app
from .app.extensions import db
from .app.models import Brand, Department, Factory, LicenseName, Permission, ProductType, Role, User
from werkzeug.security import generate_password_hash

DEFAULTS = {
    Factory: ["Merkez", "Fabrika 1", "Fabrika 2"],
    Department: ["Bilgi İşlem", "Üretim", "Finans", "Satın Alma", "İnsan Kaynakları"],
    ProductType: ["Laptop", "Masaüstü Bilgisayar", "Monitör", "Yazıcı", "El Terminali", "Telefon", "Kamera", "Sunucu", "Network Cihazı", "Diğer"],
    Brand: ["Dell", "HP", "Lenovo", "Asus", "Acer", "Canon", "Kyocera", "Xerox", "Hikvision", "Aruba", "Samsung", "Zebra", "Logitech", "Ugreen", "Microsoft", "Diğer"],
    LicenseName: ["Windows 11 Pro", "Office 2021", "Microsoft 365", "Adobe Creative Cloud", "AutoCAD", "Antivirus", "VPN", "Diğer"],
}

PERMISSIONS = [
    ("dashboard.view", "Dashboard Görüntüleme"),
    ("inventory.manage", "Envanter Yönetimi"),
    ("licenses.manage", "Lisans Yönetimi"),
    ("stock.manage", "Stok Yönetimi"),
    ("maintenance.manage", "Bakım Yönetimi"),
    ("requests.manage", "Satın Alma Talepleri"),
    ("people.manage", "Personel Yönetimi"),
    ("knowledge.manage", "Bilgi Bankası"),
    ("scrap.manage", "Hurda Yönetimi"),
    ("reports.view", "Rapor Görüntüleme"),
    ("users.manage", "Kullanıcı Yönetimi"),
    ("roles.manage", "Rol ve Yetki Yönetimi"),
    ("settings.manage", "Sistem Ayarları"),
    ("logs.view", "Kayıtları Görüntüleme"),
]


def seed(model, names):
    existing = {row.name for row in model.query.all()}
    for name in names:
        if name not in existing:
            db.session.add(model(name=name))


def seed_auth():
    for key, name in PERMISSIONS:
        if not Permission.query.filter_by(key=key).first():
            db.session.add(Permission(key=key, name=name))
    db.session.flush()

    admin = Role.query.filter_by(name="Sistem Yöneticisi").first()
    if not admin:
        admin = Role(name="Sistem Yöneticisi", description="Tüm sistem yetkilerine sahip yönetici rolü")
        db.session.add(admin)
        db.session.flush()
    admin.permissions = Permission.query.all()

    auth_disabled = os.environ.get("AUTH_DISABLED", "false").strip().lower() == "true"
    username = os.environ.get("ADMIN_USERNAME", "admin").strip() or "admin"

    # UI development mode still needs a real database user because the API
    # session/permission layer uses the current user for every endpoint.
    # A random password is generated and never exposed while AUTH_DISABLED is on.
    if auth_disabled:
        user = User.query.filter_by(username=username).first()
        if not user:
            user = User(
                username=username,
                password_hash=generate_password_hash(secrets.token_urlsafe(32)),
                role=admin,
                active=True,
            )
            db.session.add(user)
        elif user.role_id != admin.id or not user.active:
            user.role = admin
            user.active = True
        return

    password = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not password or len(password) < 12:
        raise RuntimeError("ADMIN_PASSWORD must be explicitly configured and contain at least 12 characters")

    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username, password_hash=generate_password_hash(password), role=admin, active=True)
        db.session.add(user)


def bootstrap(app):
    migrations_dir = Path(__file__).resolve().parent / "migrations"
    with app.app_context():
        inspector = inspect(db.engine)
        has_schema = inspector.has_table("roles")
        has_version_table = inspector.has_table("alembic_version")

        if has_schema and not has_version_table:
            stamp(directory=str(migrations_dir), revision="0001_baseline")
        else:
            upgrade(directory=str(migrations_dir))

        for model, names in DEFAULTS.items():
            seed(model, names)
        seed_auth()
        db.session.commit()


if __name__ == "__main__":
    bootstrap(create_app())
    print("IT Manager PostgreSQL migrationları, master veriler ve yönetici hazır.")
