from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import AuditLog, Inventory, MaintenanceRecord

maintenance_bp = Blueprint("maintenance", __name__)


def _dict(x):
    return {
        "id": x.id,
        "inventory": {"id": x.inventory_id, "inventory_no": x.inventory.inventory_no, "computer_name": x.inventory.computer_name} if x.inventory else None,
        "personnel": {"id": x.inventory.personnel.id, "name": x.inventory.personnel.name} if x.inventory and x.inventory.personnel else None,
        "type": x.maintenance_type,
        "fault": x.fault,
        "description": x.description,
        "service": x.service,
        "technician": x.technician,
        "started_at": x.started_at.isoformat() if x.started_at else None,
        "completed_at": x.completed_at.isoformat() if x.completed_at else None,
        "status": x.status,
        "cost": float(x.cost) if x.cost is not None else None,
        "note": x.note,
        "created_at": x.created_at.isoformat() if x.created_at else None,
        "updated_at": x.updated_at.isoformat() if x.updated_at else None,
    }


def _audit(action, entity_id, details=None):
    db.session.add(AuditLog(action=action, entity_type="maintenance", entity_id=entity_id, details=details or {}))


@maintenance_bp.get("/maintenance")
def list_maintenance():
    q = MaintenanceRecord.query.join(Inventory)
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    if search:
        term = f"%{search}%"
        q = q.filter(db.or_(Inventory.inventory_no.ilike(term), Inventory.computer_name.ilike(term), MaintenanceRecord.fault.ilike(term), MaintenanceRecord.technician.ilike(term)))
    if status:
        q = q.filter(MaintenanceRecord.status == status)
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    p = q.order_by(MaintenanceRecord.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [_dict(x) for x in p.items], "pagination": {"page": page, "per_page": per_page, "total": p.total, "pages": p.pages}})


@maintenance_bp.get("/maintenance/<int:maintenance_id>")
def get_maintenance(maintenance_id):
    x = db.session.get(MaintenanceRecord, maintenance_id)
    if not x:
        return jsonify({"error": "Bakım kaydı bulunamadı"}), 404
    return jsonify(_dict(x))


def _payload(data, existing=None):
    inventory_id = data.get("inventory_id", existing.inventory_id if existing else None)
    inventory = db.session.get(Inventory, int(inventory_id)) if inventory_id not in (None, "") else None
    if not inventory:
        raise ValueError("Geçerli bir envanter seçilmelidir")
    status = str(data.get("status", existing.status if existing else "pending")).strip().lower()
    allowed = {"pending", "in_progress", "service", "completed", "cancelled"}
    if status not in allowed:
        raise ValueError("Geçersiz bakım durumu")
    return {
        "inventory_id": inventory.id,
        "maintenance_type": str(data.get("type", data.get("maintenance_type", existing.maintenance_type if existing else "internal"))).strip() or "internal",
        "fault": str(data.get("fault", existing.fault if existing else "")).strip(),
        "description": data.get("description", existing.description if existing else None),
        "service": data.get("service", existing.service if existing else None),
        "technician": data.get("technician", existing.technician if existing else None),
        "started_at": data.get("started_at", existing.started_at if existing else None),
        "completed_at": data.get("completed_at", existing.completed_at if existing else None),
        "status": status,
        "cost": data.get("cost", existing.cost if existing else None),
        "note": data.get("note", existing.note if existing else None),
    }


@maintenance_bp.post("/maintenance")
def create_maintenance():
    data = request.get_json(silent=True) or {}
    try:
        x = MaintenanceRecord(**_payload(data))
        db.session.add(x)
        db.session.flush()
        _audit("maintenance.created", x.id, {"inventory_id": x.inventory_id})
        db.session.commit()
        return jsonify(_dict(x)), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Bakım kaydı oluşturulamadı", "detail": str(e)}), 409


@maintenance_bp.patch("/maintenance/<int:maintenance_id>")
@maintenance_bp.put("/maintenance/<int:maintenance_id>")
def update_maintenance(maintenance_id):
    x = db.session.get(MaintenanceRecord, maintenance_id)
    if not x:
        return jsonify({"error": "Bakım kaydı bulunamadı"}), 404
    try:
        before = _dict(x)
        for k, v in _payload(request.get_json(silent=True) or {}, x).items():
            setattr(x, k, v)
        _audit("maintenance.updated", x.id, {"before": before, "after": _dict(x)})
        db.session.commit()
        return jsonify(_dict(x))
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Bakım kaydı güncellenemedi", "detail": str(e)}), 409


@maintenance_bp.post("/maintenance/<int:maintenance_id>/status")
def change_status(maintenance_id):
    x = db.session.get(MaintenanceRecord, maintenance_id)
    data = request.get_json(silent=True) or {}
    if not x:
        return jsonify({"error": "Bakım kaydı bulunamadı"}), 404
    status = str(data.get("status", "")).strip().lower()
    if status not in {"pending", "in_progress", "service", "completed", "cancelled"}:
        return jsonify({"error": "Geçersiz bakım durumu"}), 400
    x.status = status
    if status == "completed" and not x.completed_at:
        from datetime import datetime, timezone
        x.completed_at = datetime.now(timezone.utc)
    _audit("maintenance.status_changed", x.id, {"status": status, "note": data.get("note")})
    db.session.commit()
    return jsonify(_dict(x))
