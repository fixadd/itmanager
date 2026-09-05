from .app import create_app
from .app.extensions import db
from .app.models import Brand, Department, Factory, LicenseName, ProductType

DEFAULTS = {
    Factory: ["Merkez", "Fabrika 1", "Fabrika 2"],
    Department: ["Bilgi İşlem", "Üretim", "Finans", "Satın Alma", "İnsan Kaynakları"],
    ProductType: ["Laptop", "Masaüstü Bilgisayar", "Monitör", "Yazıcı", "El Terminali", "Telefon", "Kamera", "Sunucu", "Network Cihazı", "Diğer"],
    Brand: ["Dell", "HP", "Lenovo", "Asus", "Acer", "Canon", "Kyocera", "Xerox", "Hikvision", "Aruba", "Samsung", "Zebra", "Logitech", "Ugreen", "Microsoft", "Diğer"],
    LicenseName: ["Windows 11 Pro", "Office 2021", "Microsoft 365", "Adobe Creative Cloud", "AutoCAD", "Antivirus", "VPN", "Diğer"],
}


def seed(model, names):
    existing = {row.name for row in model.query.all()}
    for name in names:
        if name not in existing:
            db.session.add(model(name=name))


app = create_app()
with app.app_context():
    db.create_all()
    for model, names in DEFAULTS.items():
        seed(model, names)
    db.session.commit()
    print("IT Manager PostgreSQL tabloları ve temel master verileri hazır.")
