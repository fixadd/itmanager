from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..extensions import db
from ..models import AuditLog, Brand, Department, Factory, ProductModel, ProductType, product_type_brands
from .auth_routes import login_required, permission_required, current_user
product_bp = Blueprint("products", __name__)
def _audit(action, entity_type, entity_id, details=None):
 user=current_user();db.session.add(AuditLog(action=action,entity_type=entity_type,entity_id=entity_id,actor_user_id=user.id if user else None,details=details or {}))
def _name_exists(model,name,exclude_id=None):
 q=model.query.filter(db.func.lower(model.name)==name.lower());return q.filter(model.id!=exclude_id).first() if exclude_id else q.first()
def _scope_ids(entity_type,scope="inventory"):
 return [r[0] for r in db.session.execute(
     text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type=:t AND scope=:scope"),
     {"t":entity_type,"scope":scope}
 ).all()]
def _type_json(x):return {"id":x.id,"name":x.name,"active":x.active,"brand_ids":[b.id for b in x.brands if b.active]}
def _brand_json(x):return {"id":x.id,"name":x.name,"active":x.active,"product_type_ids":[t.id for t in x.product_types if t.active]}
def _model_json(x):return {"id":x.id,"name":x.name,"active":x.active,"image_path":x.image_path,"brand_id":x.brand_id,"product_type_id":x.product_type_id,"brand":{"id":x.brand.id,"name":x.brand.name} if x.brand else None,"product_type":{"id":x.product_type.id,"name":x.product_type.name} if x.product_type else None}
@product_bp.get("/settings/product-hierarchy")
@login_required
def hierarchy():
 tids,bids,mids=_scope_ids("type"),_scope_ids("brand"),_scope_ids("model")
 types=ProductType.query.filter(ProductType.active.is_(True),ProductType.id.in_(tids) if tids else False).order_by(ProductType.name).all();brands=Brand.query.filter(Brand.active.is_(True),Brand.id.in_(bids) if bids else False).order_by(Brand.name).all();models=ProductModel.query.filter(ProductModel.active.is_(True),ProductModel.id.in_(mids) if mids else False).order_by(ProductModel.name).all();factories=Factory.query.filter_by(active=True).order_by(Factory.name).all();departments=Department.query.filter_by(active=True).order_by(Department.name).all()
 return jsonify({"hardware_types":[_type_json(x) for x in types],"brands":[_brand_json(x) for x in brands],"models":[_model_json(x) for x in models],"factories":[{"id":x.id,"name":x.name} for x in factories],"departments":[{"id":x.id,"name":x.name} for x in departments]})
@product_bp.post("/settings/product-hierarchy/brand")
@permission_required("settings.manage")
def create_brand_for_types():
 data=request.get_json(silent=True) or {};name=str(data.get("name") or "").strip();type_ids=data.get("product_type_ids") or []
 if not name or not type_ids:return jsonify({"error":"brand_name_and_product_types_required"}),400
 if _name_exists(Brand,name):return jsonify({"error":"name_exists"}),409
 try:ids={int(x) for x in type_ids}
 except (TypeError,ValueError):return jsonify({"error":"invalid_product_types"}),400
 types=ProductType.query.filter(ProductType.id.in_(ids),ProductType.active.is_(True)).all()
 if len(types)!=len(ids):return jsonify({"error":"invalid_product_types"}),400
 brand=Brand(name=name,active=bool(data.get("active",True)));brand.product_types=types;db.session.add(brand)
 try:
  db.session.flush()
  db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('brand',:id,'inventory') ON CONFLICT DO NOTHING"),{"id":brand.id})
  for t in types: db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('type',:id,'inventory') ON CONFLICT DO NOTHING"),{"id":t.id})
  _audit("settings.brand_created","brand",brand.id,{"name":brand.name,"product_type_ids":sorted(ids)});db.session.commit();return jsonify(_brand_json(brand)),201
 except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409
@product_bp.patch("/settings/product-hierarchy/brand/<int:brand_id>")
@permission_required("settings.manage")
def update_brand_types(brand_id):
 brand=db.session.get(Brand,brand_id)
 if not brand:return jsonify({"error":"not_found"}),404
 data=request.get_json(silent=True) or {};name=str(data.get("name",brand.name)).strip();type_ids=data.get("product_type_ids",[t.id for t in brand.product_types])
 if not name or not type_ids:return jsonify({"error":"brand_name_and_product_types_required"}),400
 if _name_exists(Brand,name,brand.id):return jsonify({"error":"name_exists"}),409
 try:ids={int(x) for x in type_ids}
 except (TypeError,ValueError):return jsonify({"error":"invalid_product_types"}),400
 types=ProductType.query.filter(ProductType.id.in_(ids),ProductType.active.is_(True)).all()
 if len(types)!=len(ids):return jsonify({"error":"invalid_product_types"}),400
 brand.name=name;brand.product_types=types
 try:db.session.flush();_audit("settings.brand_updated","brand",brand.id,{"name":brand.name,"product_type_ids":sorted(ids)});db.session.commit();return jsonify(_brand_json(brand))
 except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409
@product_bp.post("/settings/product-hierarchy/model")
@permission_required("settings.manage")
def create_model_in_hierarchy():
 data=request.get_json(silent=True) or {};name=str(data.get("name") or "").strip();brand_id=data.get("brand_id");product_type_id=data.get("product_type_id")
 if not name or not brand_id or not product_type_id:return jsonify({"error":"model_name_brand_and_product_type_required"}),400
 brand=db.session.get(Brand,int(brand_id));product_type=db.session.get(ProductType,int(product_type_id))
 if not brand or not brand.active or not product_type or not product_type.active:return jsonify({"error":"invalid_brand_or_product_type"}),400
 if product_type not in brand.product_types:return jsonify({"error":"brand_not_linked_to_product_type"}),400
 if ProductModel.query.filter(db.func.lower(ProductModel.name)==name.lower(),ProductModel.brand_id==brand.id,ProductModel.product_type_id==product_type.id).first():return jsonify({"error":"model_exists"}),409
 obj=ProductModel(name=name,brand_id=brand.id,product_type_id=product_type.id,active=bool(data.get("active",True)));db.session.add(obj)
 try:
  db.session.flush()
  db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('model',:id,'inventory') ON CONFLICT DO NOTHING"),{"id":obj.id})
  db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('brand',:id,'inventory') ON CONFLICT DO NOTHING"),{"id":brand.id})
  db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('type',:id,'inventory') ON CONFLICT DO NOTHING"),{"id":product_type.id})
  _audit("settings.model_created","product_model",obj.id,{"name":name,"brand_id":brand.id,"product_type_id":product_type.id});db.session.commit();return jsonify(_model_json(obj)),201
 except IntegrityError:db.session.rollback();return jsonify({"error":"model_exists_for_brand"}),409
