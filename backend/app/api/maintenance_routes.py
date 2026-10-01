from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import AuditLog, Inventory, MaintenanceRecord
from .auth_routes import current_user, login_required

maintenance_bp = Blueprint("maintenance", __name__)

ALLOWED_STATUS = {"pending", "in_progress", "service", "completed", "cancelled"}
ALLOWED_TYPES = {"internal", "service", "periodic"}


def _dt(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise ValueError("Geçersiz tarih formatı")


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
    user = current_user()
    db.session.add(AuditLog(action=action, entity_type="maintenance", entity_id=entity_id, actor_user_id=user.id if user else None, details=details or {}))


def _payload(data, existing=None):
    inventory_id = data.get("inventory_id", existing.inventory_id if existing else None)
    try:
        inventory = db.session.get(Inventory, int(inventory_id)) if inventory_id not in (None, "") else None
    except (TypeError, ValueError):
        inventory = None
    if not inventory:
        raise ValueError("Geçerli bir envanter seçilmelidir")
    if inventory.status == "scrapped":
        raise ValueError("Hurda durumundaki envanter için bakım kaydı oluşturulamaz")

    status = str(data.get("status", existing.status if existing else "pending")).strip().lower()
    if status not in ALLOWED_STATUS:
        raise ValueError("Geçersiz bakım durumu")
    maintenance_type = str(data.get("type", data.get("maintenance_type", existing.maintenance_type if existing else "internal"))).strip().lower() or "internal"
    if maintenance_type not in ALLOWED_TYPES:
        raise ValueError("Geçersiz bakım türü")
    fault = str(data.get("fault", existing.fault if existing else "")).strip()
    if not fault:
        raise ValueError("Arıza / konu zorunludur")

    # Bakım zamanları kullanıcıdan alınmaz; durum geçişi backend tarafından belirlenir.
    # Mevcut kayıt düzenlenirken daha önce oluşmuş başlangıç zamanı korunur.
    started_at = existing.started_at if existing else None
    completed_at = existing.completed_at if existing and status == "completed" else None
    now = datetime.now(timezone.utc)
    if status in {"in_progress", "service"} and not started_at:
        started_at = now
    if status == "completed":
        if not started_at:
            started_at = now
        if not completed_at:
            completed_at = now

    cost_value = data.get("cost", existing.cost if existing else None)
    if cost_value not in (None, ""):
        try:
            from decimal import Decimal, InvalidOperation
            cost_value = Decimal(str(cost_value))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Geçersiz maliyet")
        if cost_value < 0:
            raise ValueError("Maliyet 0'dan küçük olamaz")

    return {
        "inventory_id": inventory.id,
        "maintenance_type": maintenance_type,
        "fault": fault,
        "description": data.get("description", existing.description if existing else None),
        "service": data.get("service", existing.service if existing else None),
        "technician": data.get("technician", existing.technician if existing else None),
        "started_at": started_at,
        "completed_at": completed_at,
        "status": status,
        "cost": cost_value,
        "note": data.get("note", existing.note if existing else None),
    }


@maintenance_bp.get("/maintenance")
@login_required
def list_maintenance():
    q = MaintenanceRecord.query.join(Inventory).options(joinedload(MaintenanceRecord.inventory).joinedload(Inventory.personnel))
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    if search:
        term = f"%{search}%"
        q = q.filter(or_(Inventory.inventory_no.ilike(term), Inventory.computer_name.ilike(term), Inventory.serial_no.ilike(term), MaintenanceRecord.fault.ilike(term), MaintenanceRecord.description.ilike(term), MaintenanceRecord.note.ilike(term), MaintenanceRecord.technician.ilike(term), MaintenanceRecord.service.ilike(term)))
    if status:
        q = q.filter(MaintenanceRecord.status == status)
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    p = q.order_by(MaintenanceRecord.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [_dict(x) for x in p.items], "pagination": {"page": page, "per_page": per_page, "total": p.total, "pages": p.pages}})


@maintenance_bp.get("/maintenance/summary")
@login_required
def maintenance_summary():
    rows = db.session.query(MaintenanceRecord.status, db.func.count(MaintenanceRecord.id)).group_by(MaintenanceRecord.status).all()
    counts = {status: int(total) for status, total in rows}
    return jsonify({
        "total": sum(counts.values()),
        "pending": counts.get("pending", 0),
        "in_progress": counts.get("in_progress", 0),
        "service": counts.get("service", 0),
        "completed": counts.get("completed", 0),
        "cancelled": counts.get("cancelled", 0),
    })


@maintenance_bp.get("/maintenance/<int:maintenance_id>")
@login_required
def get_maintenance(maintenance_id):
    x = db.session.get(MaintenanceRecord, maintenance_id)
    if not x:
        return jsonify({"error": "Bakım kaydı bulunamadı"}), 404
    return jsonify(_dict(x))


@maintenance_bp.post("/maintenance")
@login_required
def create_maintenance():
    try:
        x = MaintenanceRecord(**_payload(request.get_json(silent=True) or {}))
        db.session.add(x)
        db.session.flush()
        _audit("maintenance.created", x.id, {"inventory_id": x.inventory_id})
        db.session.commit()
        return jsonify(_dict(x)), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Bakım kaydı oluşturulamadı"}), 409


@maintenance_bp.route("/maintenance/<int:maintenance_id>", methods=["PATCH", "PUT"])
@login_required
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
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Bakım kaydı güncellenemedi"}), 409


@maintenance_bp.post("/maintenance/<int:maintenance_id>/status")
@login_required
def change_status(maintenance_id):
    x = db.session.get(MaintenanceRecord, maintenance_id)
    data = request.get_json(silent=True) or {}
    if not x:
        return jsonify({"error": "Bakım kaydı bulunamadı"}), 404
    status = str(data.get("status", "")).strip().lower()
    if status not in ALLOWED_STATUS:
        return jsonify({"error": "Geçersiz bakım durumu"}), 400
    now = datetime.now(timezone.utc)
    try:
        old_status = x.status
        x.status = status
        if status in {"in_progress", "service"} and not x.started_at:
            x.started_at = now
        if status == "completed":
            if not x.started_at:
                x.started_at = now
            if not x.completed_at:
                x.completed_at = now
        else:
            x.completed_at = None
        _audit("maintenance.status_changed", x.id, {
            "from_status": old_status,
            "status": status,
            "note": data.get("note"),
        })
        db.session.commit()
        return jsonify(_dict(x))
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Bakım durumu güncellenemedi"}), 409
