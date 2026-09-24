from flask import Blueprint, jsonify, request
from sqlalchemy import and_, or_

from ..extensions import db
from ..models import Inventory, License, StockItem, StockMovement, ScrapRecord
from .auth_routes import permission_required

scrap_bp = Blueprint("scrap", __name__)


def record_json(r):
    source = None
    brand_id = model_id = None
    brand_name = model_name = None
    if r.source_type == "inventory":
        source = db.session.get(Inventory, r.source_id)
        name = source.inventory_no if source else f"Envanter #{r.source_id}"
        detail = " / ".join(filter(None, [source.computer_name, source.serial_no])) if source else ""
        brand_id = source.brand_id if source else None
        model_id = source.model_id if source else None
        brand_name = source.brand.name if source and source.brand else None
        model_name = source.model.name if source and source.model else None
    elif r.source_type == "license":
        source = db.session.get(License, r.source_id)
        name = source.license_name.name if source and source.license_name else f"Lisans #{r.source_id}"
        detail = "Lisans kaydı" if source else ""
    elif r.source_type == "stock":
        source = db.session.get(StockItem, r.source_id)
        name = " ".join(filter(None, [source.brand.name if source and source.brand else "", source.model.name if source and source.model else ""])) if source else f"Stok #{r.source_id}"
        scrap_movement = (StockMovement.query.filter_by(stock_item_id=r.source_id, movement_type="scrap").order_by(StockMovement.id.desc()).first() if source else None)
        detail = f"Miktar: {scrap_movement.quantity} {scrap_movement.unit}" if scrap_movement else (f"Miktar: {source.quantity}" if source else "")
        brand_id = source.brand_id if source else None
        model_id = source.model_id if source else None
        brand_name = source.brand.name if source and source.brand else None
        model_name = source.model.name if source and source.model else None
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
        "brand_id": brand_id,
        "model_id": model_id,
        "brand_name": brand_name,
        "model_name": model_name,
        "scrapped_at": r.scrapped_at.isoformat() if r.scrapped_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _source_ids_for_search(term):
    pattern = f"%{term}%"
    inventory_ids = db.session.query(Inventory.id).filter(
        or_(
            Inventory.inventory_no.ilike(pattern),
            Inventory.serial_no.ilike(pattern),
            Inventory.computer_name.ilike(pattern),
        )
    )
    from ..models import Brand, ProductModel, LicenseModel, LicenseName

    stock_ids = (
        db.session.query(StockItem.id)
        .outerjoin(Brand, StockItem.brand_id == Brand.id)
        .outerjoin(ProductModel, StockItem.model_id == ProductModel.id)
        .filter(or_(
            Brand.name.ilike(pattern),
            ProductModel.name.ilike(pattern),
            StockItem.note.ilike(pattern),
        ))
    )
    license_ids = (
        db.session.query(License.id)
        .outerjoin(LicenseName, License.license_name_id == LicenseName.id)
        .outerjoin(LicenseModel, License.license_model_id == LicenseModel.id)
        .filter(or_(
            LicenseName.name.ilike(pattern),
            LicenseModel.name.ilike(pattern),
            License.email.ilike(pattern),
            License.note.ilike(pattern),
        ))
    )
    return inventory_ids, stock_ids, license_ids


@scrap_bp.get("/scrap")
def list_scrap():
    q = (request.args.get("q") or "").strip()
    source_type = (request.args.get("source_type") or "").strip()
    reason = (request.args.get("reason") or "").strip()
    brand_id = request.args.get("brand_id", type=int)
    model_id = request.args.get("model_id", type=int)
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    query = ScrapRecord.query
    if source_type:
        query = query.filter(ScrapRecord.source_type == source_type)
    if reason:
        query = query.filter(ScrapRecord.reason == reason)
    if brand_id is not None:
        query = query.filter(or_(
            and_(ScrapRecord.source_type == "inventory", ScrapRecord.source_id.in_(db.session.query(Inventory.id).filter(Inventory.brand_id == brand_id))),
            and_(ScrapRecord.source_type == "stock", ScrapRecord.source_id.in_(db.session.query(StockItem.id).filter(StockItem.brand_id == brand_id))),
        ))
    if model_id is not None:
        query = query.filter(or_(
            and_(ScrapRecord.source_type == "inventory", ScrapRecord.source_id.in_(db.session.query(Inventory.id).filter(Inventory.model_id == model_id))),
            and_(ScrapRecord.source_type == "stock", ScrapRecord.source_id.in_(db.session.query(StockItem.id).filter(StockItem.model_id == model_id))),
        ))
    if q:
        inventory_ids, stock_ids, license_ids = _source_ids_for_search(q)
        term = f"%{q}%"
        query = query.filter(or_(
            ScrapRecord.reason.ilike(term),
            ScrapRecord.note.ilike(term),
            and_(ScrapRecord.source_type == "inventory", ScrapRecord.source_id.in_(inventory_ids)),
            and_(ScrapRecord.source_type == "stock", ScrapRecord.source_id.in_(stock_ids)),
            and_(ScrapRecord.source_type == "license", ScrapRecord.source_id.in_(license_ids)),
        ))
    pagination = query.order_by(ScrapRecord.scrapped_at.desc(), ScrapRecord.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [record_json(r) for r in pagination.items], "pagination": {"page": pagination.page, "per_page": pagination.per_page, "total": pagination.total, "pages": pagination.pages}})


@scrap_bp.get("/scrap/<int:scrap_id>")
def get_scrap(scrap_id):
    return jsonify(record_json(db.get_or_404(ScrapRecord, scrap_id)))


@scrap_bp.get("/scrap/summary")
def scrap_summary():
    from sqlalchemy import func
    rows = db.session.query(ScrapRecord.source_type, func.count(ScrapRecord.id)).group_by(ScrapRecord.source_type).all()
    by_type = {k: int(v) for k, v in rows}
    reasons = db.session.query(ScrapRecord.reason, func.count(ScrapRecord.id)).group_by(ScrapRecord.reason).order_by(func.count(ScrapRecord.id).desc()).all()
    return jsonify({"total": ScrapRecord.query.count(), "inventory": by_type.get("inventory", 0), "stock": by_type.get("stock", 0), "license": by_type.get("license", 0), "reasons": [{"reason": r, "count": int(n)} for r, n in reasons if r]})


@scrap_bp.get("/scrap/reasons")
def reasons():
    rows = db.session.query(ScrapRecord.reason).distinct().order_by(ScrapRecord.reason.asc()).all()
    return jsonify([x[0] for x in rows if x[0]])


@scrap_bp.delete("/scrap/<int:scrap_id>")
@permission_required("scrap.manage")
def delete_scrap(scrap_id):
    r = db.get_or_404(ScrapRecord, scrap_id)
    return jsonify({"error": "Hurda geçmiş kayıtları silinemez", "scrap_id": r.id}), 409
