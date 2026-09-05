from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import (
    AssignmentHistory,
    AuditLog,
    Brand,
    Department,
    Factory,
    Inventory,
    LicenseName,
    Personnel,
    ProductModel,
    ProductType,
    ScrapRecord,
)

api_bp = Blueprint("api", __name__)


def _items(model):
    return [{"id": x.id, "name": x.name} for x in model.query.filter_by(active=True).order_by(model.name).all()]


def _audit(action, entity_type, entity_id, details=None, actor_user_id=None):
    db.session.add(AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        details=details or {},
    ))


def _find_by_name(model, value):
    if value is None or value == "":
        return None
    return model.query.filter(db.func.lower(model.name) == str(value).strip().lower()).first()


def _inventory_dict(x):
    return {
        "id": x.id,
        "inventory_no": x.inventory_no,
        "computer_name": x.computer_name,
        "serial_no": x.serial_no,
        "machine_no": x.machine_no,
        "ifs_no": x.ifs_no,
        "note": x.note,
        "status": x.status,
        "factory": {"id": x.factory_id, "name": x.factory.name} if x.factory else None,
        "department": {"id": x.department_id, "name": x.department.name} if x.department else None,
        "device_type": {"id": x.product_type_id, "name": x.product_type.name} if x.product_type else None,
        "brand": {"id": x.brand_id, "name": x.brand.name} if x.brand else None,
        "model": {"id": x.model_id, "name": x.model.name} if x.model else None,
        "personnel": {"id": x.personnel_id, "name": x.personnel.name} if x.personnel else None,
        "created_at": x.created_at.isoformat() if x.created_at else None,
        "updated_at": x.updated_at.isoformat() if x.updated_at else None,
    }


def _resolve_id(model, value, field):
    if value in (None, ""):
        return None, None
    if isinstance(value, int) or (isinstance(value, str) and value.isdigit()):
        obj = db.session.get(model, int(value))
    else:
        obj = _find_by_name(model, value)
    if not obj or getattr(obj, "active", True) is False:
        return None, jsonify({"error": f"Geçersiz {field}"}),
    return obj.id, None


@api_bp.get("/master-data")
def master_data():
    return jsonify({
        "factories": _items(Factory),
        "departments": _items(Department),
        "personnel": _items(Personnel),
        "hardware_types": _items(ProductType),
        "brands": _items(Brand),
        "models": [
            {"id": x.id, "name": x.name, "brand_id": x.brand_id, "product_type_id": x.product_type_id}
            for x in ProductModel.query.filter_by(active=True).order_by(ProductModel.name).all()
        ],
        "licenses": _items(LicenseName),
    })


@api_bp.get("/master-data/<string:resource>")
def master_resource(resource):
    resources = {
        "factories": Factory,
        "departments": Department,
        "personnel": Personnel,
        "hardware-types": ProductType,
        "brands": Brand,
        "licenses": LicenseName,
    }
    model = resources.get(resource)
    if not model:
        return jsonify({"error": "Bilinmeyen master veri kaynağı"}), 404
    return jsonify(_items(model))


@api_bp.get("/brands/<int:brand_id>/models")
def brand_models(brand_id):
    rows = ProductModel.query.filter_by(brand_id=brand_id, active=True).order_by(ProductModel.name).all()
    return jsonify([{"id": x.id, "name": x.name, "product_type_id": x.product_type_id} for x in rows])


@api_bp.get("/inventory")
def list_inventory():
    query = Inventory.query
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    factory_id = request.args.get("factory_id", "").strip()
    department_id = request.args.get("department_id", "").strip()
    product_type_id = request.args.get("product_type_id", "").strip()
    brand_id = request.args.get("brand_id", "").strip()
    model_id = request.args.get("model_id", "").strip()
    personnel_id = request.args.get("personnel_id", "").strip()

    if search:
        term = f"%{search}%"
        query = query.outerjoin(ProductModel, Inventory.model_id == ProductModel.id).outerjoin(Personnel, Inventory.personnel_id == Personnel.id).filter(
            or_(Inventory.inventory_no.ilike(term), Inventory.serial_no.ilike(term), Inventory.computer_name.ilike(term),
                ProductModel.name.ilike(term), Personnel.name.ilike(term))
        )
    for field, value in ((Inventory.status, status), (Inventory.factory_id, factory_id),
                         (Inventory.department_id, department_id), (Inventory.product_type_id, product_type_id),
                         (Inventory.brand_id, brand_id), (Inventory.model_id, model_id),
                         (Inventory.personnel_id, personnel_id)):
        if value:
            try:
                query = query.filter(field == (value if field is Inventory.status else int(value)))
            except ValueError:
                return jsonify({"error": "Filtre parametresi geçersiz"}), 400

    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    pagination = query.order_by(Inventory.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": [_inventory_dict(x) for x in pagination.items],
        "pagination": {"page": page, "per_page": per_page, "total": pagination.total, "pages": pagination.pages},
    })


@api_bp.get("/inventory/<int:inventory_id>")
def get_inventory(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    return jsonify(_inventory_dict(item))


def _inventory_payload(data, item=None):
    required = (("inventory_no", Inventory.inventory_no), ("factory", Factory), ("department", Department),
                ("device_type", ProductType), ("brand", Brand))
    values = {}
    for key, model in required:
        value = data.get(key) if key in data else (getattr(item, key) if item and key == "inventory_no" else None)
        if value in (None, ""):
            raise ValueError(f"{key} alanı zorunludur")
        if key == "inventory_no":
            values["inventory_no"] = str(value).strip()
        else:
            obj = db.session.get(model, int(value)) if isinstance(value, int) or str(value).isdigit() else _find_by_name(model, value)
            if not obj or getattr(obj, "active", True) is False:
                raise ValueError(f"Geçersiz {key}")
            values[{"factory":"factory_id","department":"department_id","device_type":"product_type_id","brand":"brand_id"}[key]] = obj.id

    model_value = data.get("model")
    if model_value not in (None, ""):
        model_obj = db.session.get(ProductModel, int(model_value)) if str(model_value).isdigit() else None
        if not model_obj or not model_obj.active or model_obj.brand_id != values["brand_id"]:
            raise ValueError("Geçersiz model veya model markayla eşleşmiyor")
        values["model_id"] = model_obj.id
    else:
        values["model_id"] = None

    person_value = data.get("person") if "person" in data else data.get("personnel_id")
    if person_value not in (None, ""):
        person = db.session.get(Personnel, int(person_value)) if str(person_value).isdigit() else _find_by_name(Personnel, person_value)
        if not person or not person.active:
            raise ValueError("Geçersiz personel")
        values["personnel_id"] = person.id
    else:
        values["personnel_id"] = None

    for key in ("computer_name", "serial_no", "machine_no", "ifs_no", "note", "status"):
        if key in data:
            values[key] = data[key] if data[key] not in ("", None) else None
    return values


@api_bp.post("/inventory")
def create_inventory():
    data = request.get_json(silent=True) or {}
    try:
        values = _inventory_payload(data)
        item = Inventory(**values)
        db.session.add(item)
        db.session.flush()
        _audit("inventory.created", "inventory", item.id, {"inventory_no": item.inventory_no})
        db.session.commit()
        return jsonify(_inventory_dict(item)), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "Envanter kaydı oluşturulamadı", "detail": str(exc)}), 409


@api_bp.patch("/inventory/<int:inventory_id>")
@api_bp.put("/inventory/<int:inventory_id>")
def update_inventory(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    data = request.get_json(silent=True) or {}
    try:
        values = _inventory_payload(data, item)
        before = _inventory_dict(item)
        for key, value in values.items():
            setattr(item, key, value)
        db.session.flush()
        _audit("inventory.updated", "inventory", item.id, {"before": before, "after": _inventory_dict(item)})
        db.session.commit()
        return jsonify(_inventory_dict(item))
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "Envanter kaydı güncellenemedi", "detail": str(exc)}), 409


@api_bp.post("/inventory/<int:inventory_id>/assign")
def assign_inventory(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    data = request.get_json(silent=True) or {}
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    person_value = data.get("personnel_id", data.get("person"))
    person = db.session.get(Personnel, int(person_value)) if str(person_value).isdigit() else _find_by_name(Personnel, person_value)
    if not person or not person.active:
        return jsonify({"error": "Geçerli bir personel seçilmelidir"}), 400
    old_person_id = item.personnel_id
    item.personnel_id = person.id
    history = AssignmentHistory(personnel_id=person.id, asset_type="inventory", asset_id=item.id, action="assign", note=data.get("note"))
    db.session.add(history)
    _audit("inventory.assigned", "inventory", item.id, {"from_personnel_id": old_person_id, "to_personnel_id": person.id, "note": data.get("note")})
    db.session.commit()
    return jsonify(_inventory_dict(item))


@api_bp.post("/inventory/<int:inventory_id>/mark-faulty")
def mark_inventory_faulty(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    data = request.get_json(silent=True) or {}
    old_status = item.status
    item.status = "faulty"
    if data.get("note"):
        item.note = data["note"]
    _audit("inventory.mark_faulty", "inventory", item.id, {"from_status": old_status, "to_status": item.status, "note": data.get("note")})
    db.session.commit()
    return jsonify(_inventory_dict(item))


@api_bp.post("/inventory/<int:inventory_id>/send-to-it")
def send_inventory_to_it(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    data = request.get_json(silent=True) or {}
    old_person_id, old_status = item.personnel_id, item.status
    item.personnel_id = None
    item.status = "it"
    if data.get("note"):
        item.note = data["note"]
    _audit("inventory.sent_to_it", "inventory", item.id, {"from_personnel_id": old_person_id, "from_status": old_status, "note": data.get("note")})
    db.session.commit()
    return jsonify(_inventory_dict(item))


@api_bp.post("/inventory/<int:inventory_id>/scrap")
def scrap_inventory(inventory_id):
    item = db.session.get(Inventory, inventory_id)
    data = request.get_json(silent=True) or {}
    if not item:
        return jsonify({"error": "Envanter kaydı bulunamadı"}), 404
    reason = str(data.get("reason", "")).strip()
    if not reason:
        return jsonify({"error": "Hurda nedeni zorunludur"}), 400
    old_status = item.status
    item.status = "scrapped"
    item.personnel_id = None
    db.session.add(ScrapRecord(source_type="inventory", source_id=item.id, reason=reason, note=data.get("note")))
    _audit("inventory.scrapped", "inventory", item.id, {"from_status": old_status, "reason": reason, "note": data.get("note")})
    db.session.commit()
    return jsonify(_inventory_dict(item))
