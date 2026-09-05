from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from ..extensions import db
from ..models import Personnel, Inventory, License, AssignmentHistory, StockMovement, AuditLog
from .auth_routes import current_user

personnel_bp = Blueprint("personnel", __name__)


def person_json(p):
    return {"id": p.id, "employee_no": p.employee_no, "name": p.name, "email": p.email,
            "active": p.active, "department": {"id": p.department.id, "name": p.department.name} if p.department else None}


def asset_json(p):
    inventory = Inventory.query.filter_by(personnel_id=p.id).order_by(Inventory.id.desc()).all()

    # A license has no personnel_id. The latest assignment event for each
    # license is therefore the source of truth for its current owner.
    all_license_history = AssignmentHistory.query.filter_by(asset_type="license").order_by(AssignmentHistory.id.desc()).all()
    latest_owner = {}
    for h in all_license_history:
        latest_owner.setdefault(h.asset_id, h.personnel_id)
    current_license_ids = [license_id for license_id, owner_id in latest_owner.items() if owner_id == p.id]
    licenses = License.query.filter(License.id.in_(current_license_ids)).all() if current_license_ids else []
    license_map = {x.id: x for x in licenses}
    licenses = [license_map[x] for x in current_license_ids if x in license_map]

    stock = StockMovement.query.filter_by(personnel_id=p.id).order_by(StockMovement.id.desc()).all()
    return {
        "inventory": [{"id": x.id, "inventory_no": x.inventory_no, "computer_name": x.computer_name,
                       "serial_no": x.serial_no, "status": x.status,
                       "type": x.product_type.name if x.product_type else None,
                       "brand": x.brand.name if x.brand else None,
                       "model": x.model.name if x.model else None} for x in inventory],
        "licenses": [{"id": x.id, "name": x.license_name.name if x.license_name else None,
                      "expires_at": x.expires_at.isoformat() if x.expires_at else None} for x in licenses],
        "stock_movements": [{"id": x.id, "stock_item_id": x.stock_item_id, "movement_type": x.movement_type,
                             "quantity": float(x.quantity), "unit": x.unit, "note": x.note,
                             "created_at": x.created_at.isoformat()} for x in stock],
    }


def audit(action, entity_id, details=None):
    actor = current_user()
    db.session.add(AuditLog(action=action, entity_type="personnel", entity_id=entity_id,
                            actor_user_id=actor.id if actor else None, details=details or {}))


@personnel_bp.get("/personnel")
def list_personnel():
    q = (request.args.get("q") or "").strip()
    status = request.args.get("status")
    query = Personnel.query
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Personnel.name.ilike(like), Personnel.employee_no.ilike(like), Personnel.email.ilike(like)))
    if status in ("active", "inactive"):
        query = query.filter_by(active=status == "active")
    rows = query.order_by(Personnel.name.asc()).all()
    return jsonify({"items": [person_json(x) | {"asset_count": Inventory.query.filter_by(personnel_id=x.id).count()} for x in rows], "total": len(rows)})


@personnel_bp.get("/personnel/<int:person_id>")
def get_personnel(person_id):
    p = db.get_or_404(Personnel, person_id)
    data = person_json(p)
    data["assets"] = asset_json(p)
    data["history"] = [{"id": h.id, "asset_type": h.asset_type, "asset_id": h.asset_id, "action": h.action,
                        "note": h.note, "created_at": h.created_at.isoformat()} for h in AssignmentHistory.query.filter_by(personnel_id=p.id).order_by(AssignmentHistory.id.desc()).all()]
    return jsonify(data)


@personnel_bp.post("/personnel")
def create_personnel():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Personel adı zorunludur."}), 400
    p = Personnel(employee_no=data.get("employee_no") or None, name=name, email=data.get("email"),
                  department_id=data.get("department_id") or None, active=bool(data.get("active", True)))
    db.session.add(p)
    db.session.flush()
    audit("personnel.created", p.id, {"name": p.name})
    db.session.commit()
    return jsonify(person_json(p)), 201


@personnel_bp.route("/personnel/<int:person_id>", methods=["PATCH", "PUT"])
def update_personnel(person_id):
    p = db.get_or_404(Personnel, person_id)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"] or "").strip()
        if not name:
            return jsonify({"error": "Personel adı zorunludur."}), 400
        p.name = name
    for key in ("employee_no", "email", "department_id", "active"):
        if key in data:
            setattr(p, key, data[key])
    audit("personnel.updated", p.id, {"fields": sorted(data.keys())})
    db.session.commit()
    return jsonify(person_json(p))


@personnel_bp.post("/personnel/<int:person_id>/toggle")
def toggle_personnel(person_id):
    p = db.get_or_404(Personnel, person_id)
    p.active = not p.active
    audit("personnel.status_changed", p.id, {"active": p.active})
    db.session.commit()
    return jsonify(person_json(p))


@personnel_bp.get("/personnel/<int:person_id>/assets")
def personnel_assets(person_id):
    p = db.get_or_404(Personnel, person_id)
    return jsonify(asset_json(p))
