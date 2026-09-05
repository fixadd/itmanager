from flask import Blueprint, jsonify
from ..models import Brand, Department, Factory, LicenseName, Personnel, ProductModel, ProductType

api_bp = Blueprint("api", __name__)


def _items(model):
    return [{"id": x.id, "name": x.name} for x in model.query.filter_by(active=True).order_by(model.name).all()]


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
