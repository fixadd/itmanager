from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import License, Personnel, AssignmentHistory, AuditLog
from .auth_routes import current_user, login_required

license_owner_bp = Blueprint("license_owner", __name__)


def _audit(action, license_id, details):
    user = current_user()
    db.session.add(AuditLog(action=action, entity_type="license", entity_id=license_id,
                            actor_user_id=user.id if user else None, details=details))


@license_owner_bp.get("/license-owners")
@login_required
def owners():
    raw_ids = request.args.get("license_ids", "")
    ids = [int(v) for v in raw_ids.split(",") if v.strip().isdigit() and int(v) > 0]
    query = License.query.filter(License.id.in_(ids)) if ids else License.query
    return jsonify({"items": [{"license_id": x.id, "personnel": {"id": x.personnel.id, "name": x.personnel.name} if x.personnel else None} for x in rows]})


@license_owner_bp.post("/license-owners/<int:license_id>")
@login_required
def assign_owner(license_id):
    license_obj = db.session.get(License, license_id)
    if not license_obj:
        return jsonify({"error": "Lisans kaydı bulunamadı"}), 404
    data = request.get_json(silent=True) or {}
    personnel_id = data.get("personnel_id")
    if personnel_id in (None, ""):
        return jsonify({"error": "personnel_id zorunludur"}), 400
    person = db.session.get(Personnel, int(personnel_id))
    if not person or not person.active:
        return jsonify({"error": "Geçersiz personel"}), 400
    old = license_obj.personnel_id
    license_obj.personnel_id = person.id
    db.session.add(AssignmentHistory(personnel_id=person.id, asset_type="license", asset_id=license_obj.id, action="assign", note=data.get("note")))
    _audit("license.owner_changed", license_obj.id, {"from_personnel_id": old, "to_personnel_id": person.id, "note": data.get("note")})
    db.session.commit()
    return jsonify({"license_id": license_obj.id, "personnel": {"id": person.id, "name": person.name}})


@license_owner_bp.get("/license-owners/<int:license_id>/history")
@login_required
def owner_history(license_id):
    license_obj=db.session.get(License,license_id)
    if not license_obj:
        return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    rows=AssignmentHistory.query.filter_by(asset_type="license",asset_id=license_id).order_by(AssignmentHistory.id.desc()).all()
    person_ids={r.personnel_id for r in rows if r.personnel_id}
    people={p.id:p.name for p in Personnel.query.filter(Personnel.id.in_(person_ids)).all()} if person_ids else {}
    return jsonify({"items":[{"id":r.id,"personnel":{"id":r.personnel_id,"name":people.get(r.personnel_id,"—")},"action":r.action,"note":r.note,"created_at":r.created_at.isoformat() if r.created_at else None} for r in rows]})

@license_owner_bp.post("/license-owners/<int:license_id>/clear")
@login_required
def clear_owner(license_id):
    license_obj = db.session.get(License, license_id)
    if not license_obj:
        return jsonify({"error": "Lisans kaydı bulunamadı"}), 404
    old = license_obj.personnel_id
    license_obj.personnel_id = None
    _audit("license.owner_cleared", license_obj.id, {"from_personnel_id": old, "note": (request.get_json(silent=True) or {}).get("note")})
    db.session.commit()
    return jsonify({"license_id": license_obj.id, "personnel": None})
