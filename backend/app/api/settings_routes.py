from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import AuditLog, Brand, Department, Factory, LicenseName, ProductModel, ProductType
from .auth_routes import permission_required

settings_bp = Blueprint("settings", __name__)

RESOURCES = {
    "factories": (Factory, "fabrika"),
    "departments": (Department, "departman"),
    "product-types": (ProductType, "donanım tipi"),
    "brands": (Brand, "marka"),
    "license-names": (LicenseName, "lisans adı"),
}


def _audit(action, entity_type, entity_id, details=None):
    from .auth_routes import current_user
    user = current_user()
    db.session.add(AuditLog(action=action, entity_type=entity_type, entity_id=entity_id,
                            actor_user_id=user.id if user else None, details=details or {}))


def _basic(obj):
    return {"id": obj.id, "name": obj.name, "active": obj.active,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
            "updated_at": obj.updated_at.isoformat() if obj.updated_at else None}


def _model_json(obj):
    return {**_basic(obj), "brand_id": obj.brand_id, "product_type_id": obj.product_type_id,
            "brand": {"id": obj.brand.id, "name": obj.brand.name} if obj.brand else None,
            "product_type": {"id": obj.product_type.id, "name": obj.product_type.name} if obj.product_type else None}


def _name_payload(data, model, obj=None):
    name = str(data.get("name", obj.name if obj else "")).strip()
    if not name:
        raise ValueError("name_required")
    query = model.query.filter(db.func.lower(model.name) == name.lower())
    if obj:
        query = query.filter(model.id != obj.id)
    if query.first():
        raise ValueError("name_exists")
    return name


@settings_bp.get("/settings/summary")
def settings_summary():
    result = {}
    for key, (model, _) in RESOURCES.items():
        result[key] = {"total": model.query.count(), "active": model.query.filter_by(active=True).count(),
                       "inactive": model.query.filter_by(active=False).count()}
    result["models"] = {"total": ProductModel.query.count(), "active": ProductModel.query.filter_by(active=True).count(),
                         "inactive": ProductModel.query.filter_by(active=False).count()}
    return jsonify(result)


@settings_bp.get("/settings/<string:resource>")
def list_settings(resource):
    entry = RESOURCES.get(resource)
    if not entry:
        return jsonify({"error": "unknown_resource"}), 404
    model, _ = entry
    return jsonify({"items": [_basic(x) for x in model.query.order_by(model.name).all()]})


@settings_bp.post("/settings/<string:resource>")
@permission_required("settings.manage")
def create_setting(resource):
    entry = RESOURCES.get(resource)
    if not entry:
        return jsonify({"error": "unknown_resource"}), 404
    model, label = entry
    data = request.get_json(silent=True) or {}
    try:
        obj = model(name=_name_payload(data, model), active=bool(data.get("active", True)))
        db.session.add(obj)
        db.session.flush()
        _audit("settings.created", resource, obj.id, {"name": obj.name, "active": obj.active})
        db.session.commit()
        return jsonify(_basic(obj)), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc), "field": label}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "name_exists"}), 409


@settings_bp.patch("/settings/<string:resource>/<int:item_id>")
@permission_required("settings.manage")
def update_setting(resource, item_id):
    entry = RESOURCES.get(resource)
    if not entry:
        return jsonify({"error": "unknown_resource"}), 404
    model, label = entry
    obj = db.session.get(model, item_id)
    if not obj:
        return jsonify({"error": "not_found"}), 404
    data = request.get_json(silent=True) or {}
    before = _basic(obj)
    try:
        if "name" in data:
            obj.name = _name_payload(data, model, obj)
        if "active" in data:
            obj.active = bool(data["active"])
        db.session.flush()
        _audit("settings.updated", resource, obj.id, {"before": before, "after": _basic(obj)})
        db.session.commit()
        return jsonify(_basic(obj))
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc), "field": label}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "name_exists"}), 409


@settings_bp.get("/settings/models")
def list_models():
    query = ProductModel.query
    brand_id = request.args.get("brand_id", type=int)
    product_type_id = request.args.get("product_type_id", type=int)
    if brand_id:
        query = query.filter(ProductModel.brand_id == brand_id)
    if product_type_id:
        query = query.filter(ProductModel.product_type_id == product_type_id)
    return jsonify({"items": [_model_json(x) for x in query.order_by(ProductModel.name).all()]})


@settings_bp.post("/settings/models")
@permission_required("settings.manage")
def create_model():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    brand_id = data.get("brand_id")
    if not name or not brand_id:
        return jsonify({"error": "name_and_brand_required"}), 400
    brand = db.session.get(Brand, int(brand_id))
    if not brand or not brand.active:
        return jsonify({"error": "invalid_brand"}), 400
    product_type_id = data.get("product_type_id") or None
    product_type = db.session.get(ProductType, int(product_type_id)) if product_type_id else None
    if product_type_id and (not product_type or not product_type.active):
        return jsonify({"error": "invalid_product_type"}), 400
    if ProductModel.query.filter(db.func.lower(ProductModel.name) == name.lower(), ProductModel.brand_id == brand.id).first():
        return jsonify({"error": "model_exists_for_brand"}), 409
    obj = ProductModel(name=name, brand_id=brand.id, product_type_id=product_type.id if product_type else None,
                       active=bool(data.get("active", True)))
    db.session.add(obj)
    db.session.flush()
    _audit("settings.model_created", "product_model", obj.id, {"name": obj.name, "brand_id": obj.brand_id,
                                                                   "product_type_id": obj.product_type_id})
    db.session.commit()
    return jsonify(_model_json(obj)), 201


@settings_bp.patch("/settings/models/<int:model_id>")
@permission_required("settings.manage")
def update_model(model_id):
    obj = db.session.get(ProductModel, model_id)
    if not obj:
        return jsonify({"error": "not_found"}), 404
    data = request.get_json(silent=True) or {}
    before = _model_json(obj)
    if "name" in data:
        name = str(data["name"] or "").strip()
        if not name:
            return jsonify({"error": "name_required"}), 400
        obj.name = name
    if "brand_id" in data:
        brand = db.session.get(Brand, int(data["brand_id"])) if data["brand_id"] else None
        if not brand or not brand.active:
            return jsonify({"error": "invalid_brand"}), 400
        obj.brand_id = brand.id
    if "product_type_id" in data:
        value = data["product_type_id"]
        product_type = db.session.get(ProductType, int(value)) if value else None
        if value and (not product_type or not product_type.active):
            return jsonify({"error": "invalid_product_type"}), 400
        obj.product_type_id = product_type.id if product_type else None
    if "active" in data:
        obj.active = bool(data["active"])
    conflict = ProductModel.query.filter(db.func.lower(ProductModel.name) == obj.name.lower(),
                                         ProductModel.brand_id == obj.brand_id,
                                         ProductModel.id != obj.id).first()
    if conflict:
        db.session.rollback()
        return jsonify({"error": "model_exists_for_brand"}), 409
    try:
        db.session.flush()
        _audit("settings.model_updated", "product_model", obj.id, {"before": before, "after": _model_json(obj)})
        db.session.commit()
        return jsonify(_model_json(obj))
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "model_exists_for_brand"}), 409


@settings_bp.get("/settings/connections")
def connections():
    from flask import current_app
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    return jsonify({"database": {"type": "PostgreSQL", "configured": bool(uri), "host": "hidden", "credentials_exposed": False},
                    "backend": {"status": "ok"}, "environment": current_app.config.get("ENV", "production")})
