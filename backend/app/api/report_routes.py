from flask import Blueprint, jsonify
from sqlalchemy import func

from ..extensions import db
from ..models import Inventory, License, StockItem, MaintenanceRecord, PurchaseRequest, Personnel, ScrapRecord, ProductType
from .auth_routes import permission_required

reports_bp = Blueprint("reports", __name__)


def counts(query, column):
    return [
        {"label": str(label or "Bilinmiyor"), "count": int(count)}
        for label, count in query.with_entities(column, func.count())
        .group_by(column).order_by(func.count().desc()).all()
    ]


def inventory_type_counts():
    rows = (
        db.session.query(ProductType.name, func.count(Inventory.id))
        .outerjoin(Inventory, Inventory.product_type_id == ProductType.id)
        .group_by(ProductType.id, ProductType.name)
        .order_by(func.count(Inventory.id).desc(), ProductType.name.asc())
        .all()
    )
    return [{"label": str(name or "Bilinmiyor"), "count": int(count)} for name, count in rows if count]


@reports_bp.get("/reports/summary")
@permission_required("reports.view")
def report_summary():
    return jsonify({
        "inventory": {
            "total": Inventory.query.count(),
            "active": Inventory.query.filter_by(status="active").count(),
            "faulty": Inventory.query.filter(Inventory.status.in_(["faulty", "arizali", "broken"])).count(),
            "maintenance": Inventory.query.filter(Inventory.status.in_(["maintenance", "service", "bakim"])).count(),
            "scrapped": Inventory.query.filter_by(status="scrapped").count(),
            "by_status": counts(Inventory.query, Inventory.status),
            "by_type": inventory_type_counts(),
        },
        "licenses": {
            "total": License.query.count(),
            "active": License.query.filter_by(status="active").count(),
            "expiring": License.query.filter_by(status="expiring").count(),
            "expired": License.query.filter_by(status="expired").count(),
            "scrapped": License.query.filter_by(status="scrapped").count(),
            "by_status": counts(License.query, License.status),
        },
        "stock": {
            "items": StockItem.query.count(),
            "total_quantity": float(db.session.query(func.coalesce(func.sum(StockItem.quantity), 0)).scalar() or 0),
            "available": StockItem.query.filter_by(status="available").count(),
            "by_status": counts(StockItem.query, StockItem.status),
        },
        "maintenance": {
            "total": MaintenanceRecord.query.count(),
            "pending": MaintenanceRecord.query.filter_by(status="pending").count(),
            "in_progress": MaintenanceRecord.query.filter_by(status="in_progress").count(),
            "completed": MaintenanceRecord.query.filter_by(status="completed").count(),
            "total_cost": float(db.session.query(func.coalesce(func.sum(MaintenanceRecord.cost), 0)).scalar() or 0),
            "by_status": counts(MaintenanceRecord.query, MaintenanceRecord.status),
        },
        "requests": {
            "total": PurchaseRequest.query.count(),
            "pending": PurchaseRequest.query.filter_by(status="pending").count(),
            "approved": PurchaseRequest.query.filter_by(status="approved").count(),
            "ordered": PurchaseRequest.query.filter_by(status="ordered").count(),
            "completed": PurchaseRequest.query.filter_by(status="completed").count(),
            "rejected": PurchaseRequest.query.filter_by(status="rejected").count(),
            "by_status": counts(PurchaseRequest.query, PurchaseRequest.status),
        },
        "people": {
            "total": Personnel.query.count(),
            "active": Personnel.query.filter_by(active=True).count(),
            "inactive": Personnel.query.filter_by(active=False).count(),
        },
        "scrap": {
            "total": ScrapRecord.query.count(),
            "inventory": ScrapRecord.query.filter_by(source_type="inventory").count(),
            "license": ScrapRecord.query.filter_by(source_type="license").count(),
            "stock": ScrapRecord.query.filter_by(source_type="stock").count(),
        },
    })
