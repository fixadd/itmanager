from decimal import Decimal, InvalidOperation
from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import AssignmentHistory, AuditLog, Brand, Inventory, Personnel, ProductModel, ProductType, ScrapRecord, StockItem, StockMovement

stock_bp = Blueprint("stock", __name__)


def _audit(action, entity_id, details=None):
    db.session.add(AuditLog(action=action, entity_type="stock", entity_id=entity_id, details=details or {}))


def _resolve(model, value, field):
    if value in (None, ""):
        raise ValueError(f"{field} alanı zorunludur")
    obj = db.session.get(model, int(value)) if str(value).isdigit() else model.query.filter(db.func.lower(model.name) == str(value).strip().lower()).first()
    if not obj or getattr(obj, "active", True) is False:
        raise ValueError(f"Geçersiz {field}")
    return obj


def _decimal(value, field="miktar"):
    try:
        n = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"Geçersiz {field}")
    if n <= 0:
        raise ValueError(f"{field} 0'dan büyük olmalıdır")
    return n


def _dict(x):
    return {
        "id": x.id,
        "product_type": {"id": x.product_type_id, "name": x.product_type.name} if x.product_type else None,
        "brand": {"id": x.brand_id, "name": x.brand.name} if x.brand else None,
        "model": {"id": x.model_id, "name": x.model.name} if x.model else None,
        "quantity": float(x.quantity or 0),
        "unit": x.unit,
        "note": x.note,
        "status": x.status,
        "created_at": x.created_at.isoformat() if x.created_at else None,
        "updated_at": x.updated_at.isoformat() if x.updated_at else None,
    }


def _movement_dict(m):
    return {
        "id": m.id,
        "type": m.movement_type,
        "quantity": float(m.quantity),
        "unit": m.unit,
        "personnel": {"id": m.personnel_id, "name": m.personnel.name} if m.personnel else None,
        "inventory": {"id": m.inventory_id, "inventory_no": m.inventory.inventory_no} if m.inventory else None,
        "note": m.note,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _payload(data, item=None):
    type_value = data.get("device_type", data.get("product_type", item.product_type_id if item else None))
    brand_value = data.get("brand", item.brand_id if item else None)
    product_type = _resolve(ProductType, type_value, "donanım tipi")
    brand = _resolve(Brand, brand_value, "marka")
    model_value = data.get("model", item.model_id if item else None)
    model = _resolve(ProductModel, model_value, "model") if model_value not in (None, "") else None
    if model and model.brand_id != brand.id:
        raise ValueError("Model markayla eşleşmiyor")
    return {
        "product_type_id": product_type.id,
        "brand_id": brand.id,
        "model_id": model.id if model else None,
        "quantity": _decimal(data.get("quantity", item.quantity if item else 0)),
        "unit": str(data.get("unit", item.unit if item else "Adet") or "Adet").strip(),
        "note": data.get("note", item.note if item else None),
    }


@stock_bp.get("/stock")
def list_stock():
    q = StockItem.query
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    if search:
        term = f"%{search}%"
        q = q.join(ProductType).join(Brand).outerjoin(ProductModel).filter(or_(ProductType.name.ilike(term), Brand.name.ilike(term), ProductModel.name.ilike(term)))
    if status:
        q = q.filter(StockItem.status == status)
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    p = q.order_by(StockItem.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [_dict(x) for x in p.items], "pagination": {"page": page, "per_page": per_page, "total": p.total, "pages": p.pages}})


@stock_bp.get("/stock/<int:stock_id>")
def get_stock(stock_id):
    x = db.session.get(StockItem, stock_id)
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    return jsonify(_dict(x))


@stock_bp.get("/stock/<int:stock_id>/movements")
def stock_movements(stock_id):
    x = db.session.get(StockItem, stock_id)
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    return jsonify({"items": [_movement_dict(m) for m in x.movements.order_by(StockMovement.id.desc()).all()]})


@stock_bp.post("/stock")
def create_stock():
    data = request.get_json(silent=True) or {}
    try:
        vals = _payload(data)
        quantity = vals.pop("quantity")
        x = StockItem(**vals, quantity=Decimal("0"))
        db.session.add(x)
        db.session.flush()
        x.quantity = quantity
        db.session.add(StockMovement(stock_item_id=x.id, movement_type="in", quantity=quantity, unit=x.unit, note=data.get("note")))
        _audit("stock.created", x.id, {"quantity": float(quantity)})
        db.session.commit()
        return jsonify(_dict(x)), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Stok kaydı oluşturulamadı", "detail": str(e)}), 409


@stock_bp.patch("/stock/<int:stock_id>")
@stock_bp.put("/stock/<int:stock_id>")
def update_stock(stock_id):
    x = db.session.get(StockItem, stock_id)
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    try:
        before = _dict(x)
        vals = _payload(request.get_json(silent=True) or {}, x)
        for k, v in vals.items():
            setattr(x, k, v)
        _audit("stock.updated", x.id, {"before": before, "after": _dict(x)})
        db.session.commit()
        return jsonify(_dict(x))
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Stok güncellenemedi", "detail": str(e)}), 409


@stock_bp.post("/stock/<int:stock_id>/movement")
def stock_movement(stock_id):
    x = db.session.get(StockItem, stock_id)
    data = request.get_json(silent=True) or {}
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    try:
        movement_type = str(data.get("type", "")).lower().strip()
        if movement_type not in ("in", "out"):
            raise ValueError("Hareket tipi in veya out olmalıdır")
        quantity = _decimal(data.get("quantity"))
        if movement_type == "out" and quantity > x.quantity:
            raise ValueError("Yetersiz stok miktarı")
        personnel_id = None
        inventory_id = None
        if data.get("personnel_id") not in (None, ""):
            personnel_id = _resolve(Personnel, data.get("personnel_id"), "personel").id
        if data.get("inventory_id") not in (None, ""):
            inventory = db.session.get(Inventory, int(data["inventory_id"]))
            if not inventory:
                raise ValueError("Geçersiz envanter")
            inventory_id = inventory.id
        x.quantity = x.quantity + quantity if movement_type == "in" else x.quantity - quantity
        db.session.add(StockMovement(stock_item_id=x.id, movement_type=movement_type, quantity=quantity, unit=x.unit, personnel_id=personnel_id, inventory_id=inventory_id, note=data.get("note")))
        _audit(f"stock.{movement_type}", x.id, {"quantity": float(quantity), "personnel_id": personnel_id, "inventory_id": inventory_id, "note": data.get("note")})
        db.session.commit()
        return jsonify(_dict(x))
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@stock_bp.post("/stock/<int:stock_id>/assign")
def assign_stock(stock_id):
    x = db.session.get(StockItem, stock_id)
    data = request.get_json(silent=True) or {}
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    try:
        p = _resolve(Personnel, data.get("personnel_id", data.get("person")), "personel")
        quantity = _decimal(data.get("quantity", 1))
        if quantity > x.quantity:
            raise ValueError("Yetersiz stok miktarı")
        x.quantity -= quantity
        db.session.add(StockMovement(stock_item_id=x.id, movement_type="out", quantity=quantity, unit=x.unit, personnel_id=p.id, note=data.get("note")))
        db.session.add(AssignmentHistory(personnel_id=p.id, asset_type="stock", asset_id=x.id, action="assign", note=f"{quantity} {x.unit}: {data.get('note') or ''}".strip()))
        _audit("stock.assigned", x.id, {"to_personnel_id": p.id, "quantity": float(quantity), "note": data.get("note")})
        db.session.commit()
        return jsonify(_dict(x))
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@stock_bp.post("/stock/<int:stock_id>/send-to-it")
def send_stock_to_it(stock_id):
    x = db.session.get(StockItem, stock_id)
    data = request.get_json(silent=True) or {}
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    x.status = "it"
    x.note = data.get("note", x.note)
    _audit("stock.sent_to_it", x.id, {"note": data.get("note")})
    db.session.commit()
    return jsonify(_dict(x))


@stock_bp.post("/stock/<int:stock_id>/scrap")
def scrap_stock(stock_id):
    x = db.session.get(StockItem, stock_id)
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()
    if not x:
        return jsonify({"error": "Stok kaydı bulunamadı"}), 404
    if not reason:
        return jsonify({"error": "Hurda nedeni zorunludur"}), 400
    old = x.quantity
    x.quantity = Decimal("0")
    x.status = "scrapped"
    db.session.add(ScrapRecord(source_type="stock", source_id=x.id, reason=reason, note=data.get("note")))
    _audit("stock.scrapped", x.id, {"quantity": float(old), "reason": reason, "note": data.get("note")})
    db.session.commit()
    return jsonify(_dict(x))
