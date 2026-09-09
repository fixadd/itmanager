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

@catalog_bp.get("/settings/license-catalog")
def list_license_catalog():
    rows=db.session.execute(text("SELECT ln.id AS license_name_id,ln.name AS license_name,ln.active AS license_name_active,lm.id AS model_id,lm.name AS model_name,lm.active AS model_active FROM license_names ln LEFT JOIN license_models lm ON lm.license_name_id=ln.id ORDER BY ln.name,lm.name" )).mappings().all()
    items={}
    for r in rows:
        item=items.setdefault(r["license_name_id"],{"id":r["license_name_id"],"name":r["license_name"],"active":r["license_name_active"],"models":[]})
        if r["model_id"] is not None:item["models"].append({"id":r["model_id"],"name":r["model_name"],"active":r["model_active"]})
    return jsonify({"items":list(items.values())})

@catalog_bp.post("/settings/license-catalog/name")
@permission_required("settings.manage")
def create_license_catalog_name():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip()
    if not name:return jsonify({"error":"name_required"}),400
    row=db.session.execute(text("SELECT id,name,active FROM license_names WHERE lower(name)=lower(:name)"),{"name":name}).mappings().first()
    if row:return jsonify(dict(row)),200
    try:
        row=db.session.execute(text("INSERT INTO license_names(name,active,created_at,updated_at) VALUES(:name,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id,name,active"),{"name":name}).mappings().first()
        _audit("settings.license_name_created","license_name",row["id"],{"name":name});db.session.commit();return jsonify(dict(row)),201
    except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.post("/settings/license-catalog/model")
@permission_required("settings.manage")
def create_license_catalog_model():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); license_name_id=data.get("license_name_id")
    if not name or not license_name_id:return jsonify({"error":"license_name_and_model_required"}),400
    try:license_name_id=int(license_name_id)
    except (TypeError,ValueError):return jsonify({"error":"invalid_license_name"}),400
    if not db.session.execute(text("SELECT 1 FROM license_names WHERE id=:id AND active=true"),{"id":license_name_id}).first():return jsonify({"error":"invalid_license_name"}),400
    try:
        row=db.session.execute(text("SELECT id,name,active FROM license_models WHERE license_name_id=:lid AND lower(name)=lower(:name)"),{"lid":license_name_id,"name":name}).mappings().first()
        if row:return jsonify(dict(row)),200
        row=db.session.execute(text("INSERT INTO license_models(license_name_id,name,active,created_at,updated_at) VALUES(:lid,:name,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id,name,active"),{"lid":license_name_id,"name":name}).mappings().first()
        _audit("settings.license_model_created","license_model",row["id"],{"license_name_id":license_name_id,"name":name});db.session.commit();return jsonify(dict(row)),201
    except IntegrityError:db.session.rollback();return jsonify({"error":"model_exists"}),409
