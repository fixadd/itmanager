from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import AuditLog, Inventory, License, StockItem, ScrapRecord

scrap_bp = Blueprint("scrap", __name__)


def record_json(r):
    source = None
    if r.source_type == "inventory":
        source = Inventory.query.get(r.source_id)
        name = source.inventory_no if source else f"Envanter #{r.source_id}"
        detail = " / ".join(filter(None, [source.computer_name, source.serial_no])) if source else ""
    elif r.source_type == "license":
        source = License.query.get(r.source_id)
        name = source.license_name.name if source and source.license_name else f"Lisans #{r.source_id}"
        detail = source.license_key if source else ""
    elif r.source_type == "stock":
        source = StockItem.query.get(r.source_id)
        name = " ".join(filter(None, [source.brand.name if source and source.brand else "", source.model.name if source and source.model else ""])) if source else f"Stok #{r.source_id}"
        detail = f"Miktar: {source.quantity}" if source else ""
    else:
        name = f"{r.source_type} #{r.source_id}"
        detail = ""
    return {
        "id": r.id,
        "source_type": r.source_type,
        "source_id": r.source_id,
        "name": name or f"{r.source_type} #{r.source_id}",
        "detail": detail,
        "reason": r.reason,
        "note": r.note,
        "scrapped_at": r.scrapped_at.isoformat() if r.scrapped_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@scrap_bp.get("/scrap")
def list_scrap():
    q = (request.args.get("q") or "").strip().lower()
    source_type = (request.args.get("source_type") or "").strip()
    reason = (request.args.get("reason") or "").strip()
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)

    query = ScrapRecord.query
    if source_type:
        query = query.filter(ScrapRecord.source_type == source_type)
    if reason:
        query = query.filter(ScrapRecord.reason == reason)
    if q:
        query = query.filter(or_(ScrapRecord.reason.ilike(f"%{q}%"), ScrapRecord.note.ilike(f"%{q}%")))

    pagination = query.order_by(ScrapRecord.scrapped_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    items = [record_json(r) for r in pagination.items]
    if q:
        items = [x for x in items if q in x["name"].lower() or q in x["detail"].lower() or q in x["reason"].lower() or q in (x["note"] or "").lower()]
    return jsonify({
        "items": items,
        "pagination": {"page": pagination.page, "per_page": pagination.per_page, "total": pagination.total, "pages": pagination.pages},
    })


@scrap_bp.get("/scrap/<int:scrap_id>")
def get_scrap(scrap_id):
    return jsonify(record_json(db.get_or_404(ScrapRecord, scrap_id)))


@scrap_bp.get("/scrap/reasons")
def reasons():
    rows = db.session.query(ScrapRecord.reason).distinct().order_by(ScrapRecord.reason.asc()).all()
    return jsonify([x[0] for x in rows if x[0]])


@scrap_bp.delete("/scrap/<int:scrap_id>")
def delete_scrap(scrap_id):
    r = db.get_or_404(ScrapRecord, scrap_id)
    audit = AuditLog(action="scrap_deleted", entity_type="scrap_record", entity_id=r.id, details={"source_type": r.source_type, "source_id": r.source_id})
    db.session.add(audit)
    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Hurda kaydı silindi"})
