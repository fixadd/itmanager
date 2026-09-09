from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..extensions import db
from ..models import AuditLog, Brand, ProductModel, ProductType
from .auth_routes import permission_required, current_user

catalog_bp = Blueprint("catalog", __name__)
SCOPES = {"inventory", "stock"}

def _scope(value):
    value = str(value or "inventory").strip().lower()
    return value if value in SCOPES else None

def _audit(action, entity_type, entity_id, details=None):
    user = current_user()
    db.session.add(AuditLog(action=action, entity_type=entity_type, entity_id=entity_id,
                            actor_user_id=user.id if user else None, details=details or {}))

def _ids(entity_type, scope):
    rows = db.session.execute(text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type=:t AND scope=:s"), {"t": entity_type, "s": scope}).all()
    return [r[0] for r in rows]

def _type(x): return {"id":x.id,"name":x.name,"active":x.active}
def _brand(x): return {"id":x.id,"name":x.name,"active":x.active,"product_type_ids":[t.id for t in x.product_types if t.active]}
def _model(x): return {"id":x.id,"name":x.name,"active":x.active,"brand_id":x.brand_id,"product_type_id":x.product_type_id}

@catalog_bp.get("/settings/product-catalog")
def list_catalog():
    scope = _scope(request.args.get("scope"))
    if not scope: return jsonify({"error":"invalid_scope"}),400
    tids,bids,mids=_ids("type",scope),_ids("brand",scope),_ids("model",scope)
    types=ProductType.query.filter(ProductType.active.is_(True),ProductType.id.in_(tids) if tids else False).order_by(ProductType.name).all()
    brands=Brand.query.filter(Brand.active.is_(True),Brand.id.in_(bids) if bids else False).order_by(Brand.name).all()
    models=ProductModel.query.filter(ProductModel.active.is_(True),ProductModel.id.in_(mids) if mids else False).order_by(ProductModel.name).all()
    return jsonify({"scope":scope,"hardware_types":[_type(x) for x in types],"brands":[_brand(x) for x in brands],"models":[_model(x) for x in models]})

@catalog_bp.post("/settings/product-catalog/type")
@permission_required("settings.manage")
def create_type():
    scope=_scope(request.args.get("scope")); data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip()
    if not scope or not name:return jsonify({"error":"scope_and_name_required"}),400
    obj=ProductType.query.filter(db.func.lower(ProductType.name)==name.lower()).first()
    try:
        if not obj: obj=ProductType(name=name,active=True); db.session.add(obj); db.session.flush()
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('type',:id,:scope) ON CONFLICT DO NOTHING"),{"id":obj.id,"scope":scope})
        _audit("settings.catalog_type_created","product_type",obj.id,{"scope":scope,"name":obj.name});db.session.commit();return jsonify(_type(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.post("/settings/product-catalog/brand")
@permission_required("settings.manage")
def create_brand():
    scope=_scope(request.args.get("scope")); data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); tid=data.get("product_type_id")
    if not scope or not name or not tid:return jsonify({"error":"scope_name_and_product_type_required"}),400
    typ=db.session.get(ProductType,int(tid))
    if not typ:return jsonify({"error":"invalid_product_type"}),400
    try:
        obj=Brand.query.filter(db.func.lower(Brand.name)==name.lower()).first()
        if not obj: obj=Brand(name=name,active=True);db.session.add(obj);db.session.flush()
        if typ not in obj.product_types: obj.product_types.append(typ)
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('brand',:id,:scope) ON CONFLICT DO NOTHING"),{"id":obj.id,"scope":scope})
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('type',:id,:scope) ON CONFLICT DO NOTHING"),{"id":typ.id,"scope":scope})
        _audit("settings.catalog_brand_created","brand",obj.id,{"scope":scope,"product_type_id":typ.id});db.session.commit();return jsonify(_brand(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.post("/settings/product-catalog/model")
@permission_required("settings.manage")
def create_model():
    scope=_scope(request.args.get("scope")); data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); bid=data.get("brand_id"); tid=data.get("product_type_id")
    if not scope or not name or not bid or not tid:return jsonify({"error":"scope_name_brand_and_product_type_required"}),400
    brand=db.session.get(Brand,int(bid));typ=db.session.get(ProductType,int(tid))
    if not brand or not typ or typ not in brand.product_types:return jsonify({"error":"invalid_brand_or_product_type"}),400
    try:
        obj=ProductModel.query.filter(db.func.lower(ProductModel.name)==name.lower(),ProductModel.brand_id==brand.id,ProductModel.product_type_id==typ.id).first()
        if not obj:obj=ProductModel(name=name,brand_id=brand.id,product_type_id=typ.id,active=True);db.session.add(obj);db.session.flush()
        for et,eid in (("type",typ.id),("brand",brand.id),("model",obj.id)):
            db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES(:t,:id,:scope) ON CONFLICT DO NOTHING"),{"t":et,"id":eid,"scope":scope})
        _audit("settings.catalog_model_created","product_model",obj.id,{"scope":scope,"brand_id":brand.id,"product_type_id":typ.id});db.session.commit();return jsonify(_model(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"model_exists"}),409
