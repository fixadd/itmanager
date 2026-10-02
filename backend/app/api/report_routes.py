from flask import Blueprint, jsonify
from sqlalchemy import func

from ..extensions import db
from ..models import Inventory, License, StockItem, StockMovement, MaintenanceRecord, PurchaseRequest, Personnel, ScrapRecord, ProductType, AuditLog, User
from .auth_routes import permission_required, login_required

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
    def status_counts(model, status_column):
        rows = db.session.query(status_column, func.count(model.id)).group_by(status_column).all()
        return {str(label or "Bilinmiyor"): int(count) for label, count in rows}

    def inventory_faulty_count():
        return db.session.query(func.count(Inventory.id)).filter(
            Inventory.status.in_(["faulty", "arizali", "broken"])
        ).scalar() or 0

    inventory_status = status_counts(Inventory, Inventory.status)
    license_status = status_counts(License, License.status)
    stock_status = status_counts(StockItem, StockItem.status)
    maintenance_status = status_counts(MaintenanceRecord, MaintenanceRecord.status)
    request_status = status_counts(PurchaseRequest, PurchaseRequest.status)

    return jsonify({
        "inventory": {
            "total": sum(inventory_status.values()),
            "active": inventory_status.get("active", 0),
            "faulty": sum(inventory_status.get(k, 0) for k in ["faulty", "arizali", "broken"]),
            "maintenance": sum(inventory_status.get(k, 0) for k in ["maintenance", "service", "bakim"]),
            "scrapped": inventory_status.get("scrapped", 0),
            "by_status": [{"label": k, "count": v} for k, v in sorted(inventory_status.items(), key=lambda x: x[1], reverse=True)],
            "by_type": inventory_type_counts(),
        },
        "licenses": {
            "total": sum(license_status.values()),
            "active": license_status.get("active", 0),
            "expiring": license_status.get("expiring", 0),
            "expired": license_status.get("expired", 0),
            "scrapped": license_status.get("scrapped", 0),
            "by_status": [{"label": k, "count": v} for k, v in sorted(license_status.items(), key=lambda x: x[1], reverse=True)],
        },
        "stock": {
            "items": sum(stock_status.values()),
            "total_quantity": float(db.session.query(func.coalesce(func.sum(StockItem.quantity), 0)).scalar() or 0),
            "available": stock_status.get("available", 0),
            "by_status": [{"label": k, "count": v} for k, v in sorted(stock_status.items(), key=lambda x: x[1], reverse=True)],
        },
        "maintenance": {
            "total": sum(maintenance_status.values()),
            "pending": maintenance_status.get("pending", 0),
            "in_progress": maintenance_status.get("in_progress", 0),
            "completed": maintenance_status.get("completed", 0),
            "total_cost": float(db.session.query(func.coalesce(func.sum(MaintenanceRecord.cost), 0)).scalar() or 0),
            "by_status": [{"label": k, "count": v} for k, v in sorted(maintenance_status.items(), key=lambda x: x[1], reverse=True)],
        },
        "requests": {
            "total": sum(request_status.values()),
            "pending": request_status.get("pending", 0),
            "approved": request_status.get("approved", 0),
            "ordered": request_status.get("ordered", 0),
            "completed": request_status.get("completed", 0),
            "rejected": request_status.get("rejected", 0),
            "by_status": [{"label": k, "count": v} for k, v in sorted(request_status.items(), key=lambda x: x[1], reverse=True)],
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


@reports_bp.get("/dashboard/summary")
@login_required
def dashboard_summary():
    type_rows = inventory_type_counts()[:5]
    status_rows = counts(Inventory.query, Inventory.status)
    monthly_rows = (
        db.session.query(func.date_trunc("month", AuditLog.created_at), func.count(AuditLog.id))
        .group_by(func.date_trunc("month", AuditLog.created_at))
        .order_by(func.date_trunc("month", AuditLog.created_at).desc())
        .limit(4).all()
    )
    recent = (
        db.session.query(AuditLog, User.username)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(6).all()
    )
    inventory_status = {str(label or "Bilinmiyor"): int(count) for label, count in db.session.query(Inventory.status, func.count(Inventory.id)).group_by(Inventory.status).all()}
    request_status = {str(label or "Bilinmiyor"): int(count) for label, count in db.session.query(PurchaseRequest.status, func.count(PurchaseRequest.id)).group_by(PurchaseRequest.status).all()}
    maintenance_status = {str(label or "Bilinmiyor"): int(count) for label, count in db.session.query(MaintenanceRecord.status, func.count(MaintenanceRecord.id)).group_by(MaintenanceRecord.status).all()}
    movement_totals = dict(db.session.query(StockMovement.movement_type, func.coalesce(func.sum(StockMovement.quantity), 0)).group_by(StockMovement.movement_type).all())

    return jsonify({
        "inventory": {
            "total": sum(inventory_status.values()),
            "active": inventory_status.get("active", 0),
            "faulty": sum(inventory_status.get(k, 0) for k in ["faulty", "arizali", "broken"]),
            "maintenance": sum(inventory_status.get(k, 0) for k in ["maintenance", "service", "bakim"]),
            "scrapped": inventory_status.get("scrapped", 0),
            "by_status": status_rows,
            "by_type": type_rows,
        },
        "requests": {
            "pending": request_status.get("pending", 0),
            "approved": request_status.get("approved", 0),
            "ordered": request_status.get("ordered", 0),
            "completed": request_status.get("completed", 0),
        },
        "maintenance": {
            "pending": maintenance_status.get("pending", 0),
            "in_progress": maintenance_status.get("in_progress", 0),
            "service": maintenance_status.get("service", 0),
            "completed": maintenance_status.get("completed", 0),
        },
        "stock": {
            "total_quantity": float(db.session.query(func.coalesce(func.sum(StockItem.quantity), 0)).scalar() or 0),
            "in": float(movement_totals.get("in", 0) or 0),
            "out": float(movement_totals.get("out", 0) or 0),
        },
        "monthly_activity": [
            {"month": month.isoformat() if month else None, "count": int(count)}
            for month, count in reversed(monthly_rows)
        ],
        "recent_activity": [
            {"action": row.action, "entity_type": row.entity_type, "entity_id": row.entity_id,
             "actor": username or "Sistem", "created_at": row.created_at.isoformat() if row.created_at else None}
            for row, username in recent
        ],
    })
