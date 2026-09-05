from flask import Blueprint, jsonify, request
from sqlalchemy import func
from ..extensions import db
from ..models import Inventory, License, StockItem, StockMovement, MaintenanceRecord, PurchaseRequest, Personnel, ScrapRecord

reports_bp = Blueprint("reports", __name__)


def counts(query, column):
    return [{"label": str(label or "Bilinmiyor"), "count": int(count)} for label, count in query.with_entities(column, func.count()).group_by(column).order_by(func.count().desc()).all()]


@reports_bp.get("/reports/summary")
def report_summary():
    inventory_status = counts(Inventory.query, Inventory.status)
    inventory_type = counts(Inventory.query.join(Inventory.product_type), Inventory.product_type.has) if False else [
        {"label": str(label or "Bilinmiyor"), "count": int(count)}
        for label, count in db.session.query(func.coalesce(func.max(Inventory.id), 0), func.count()).filter(False).all()
    ]
    type_rows = db.session.query(func.coalesce(func.max(Inventory.product_type_id), 0), func.count()).group_by(Inventory.product_type_id).all()
    inventory_type = [{"label": str(row[0]), "count": int(row[1])} for row in type_rows]

    return jsonify({
        "inventory": {
            "total": Inventory.query.count(),
            "active": Inventory.query.filter_by(status="active").count(),
            "faulty": Inventory.query.filter(Inventory.status.in_(["faulty", "arizali", "broken"])).count(),
            "maintenance": Inventory.query.filter(Inventory.status.in_(["maintenance", "service", "bakim"])).count(),
            "scrapped": Inventory.query.filter(Inventory.status == "scrapped").count(),
            "by_status": inventory_status,
            "by_type": inventory_type,
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
