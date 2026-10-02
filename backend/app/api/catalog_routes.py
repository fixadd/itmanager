import os, uuid
from flask import Blueprint, jsonify, request, send_from_directory, current_app
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..extensions import db
from ..models import AuditLog, Brand, ProductModel, ProductType
from .auth_routes import login_required, permission_required, current_user

catalog_bp = Blueprint("catalog", __name__)
SCOPES = {"inventory", "stock"}
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024

def _product_image_dir():
    path = os.path.join(current_app.instance_path, "product_images")
    os.makedirs(path, exist_ok=True)
    return path

def _image_url(model_id):
    return f"/api/settings/product-catalog/model/{model_id}/image"

def _license_image_url(model_id):
    return f"/api/settings/license-catalog/model/{model_id}/image"

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
def _model(x): return {"id":x.id,"name":x.name,"active":x.active,"brand_id":x.brand_id,"product_type_id":x.product_type_id,"image_path":x.image_path}

def _scoped(entity_type, entity_id, scope):
    return db.session.execute(text("SELECT 1 FROM product_catalog_scopes WHERE entity_type=:t AND entity_id=:id AND scope=:scope"),
                              {"t":entity_type,"id":entity_id,"scope":scope}).first() is not None

@catalog_bp.get("/settings/product-catalog")
@login_required
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
        obj.active=True
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('type',:id,:scope) ON CONFLICT DO NOTHING"),{"id":obj.id,"scope":scope})
        _audit("settings.catalog_type_created","product_type",obj.id,{"scope":scope,"name":obj.name});db.session.commit();return jsonify(_type(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.patch("/settings/product-catalog/type/<int:type_id>")
@permission_required("settings.manage")
def update_type(type_id):
    scope=_scope(request.args.get("scope")); obj=db.session.get(ProductType,type_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("type",type_id,scope):return jsonify({"error":"not_found"}),404
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or obj.name).strip()
    if not name:return jsonify({"error":"name_required"}),400
    conflict=ProductType.query.filter(db.func.lower(ProductType.name)==name.lower(),ProductType.id!=obj.id).first()
    if conflict:return jsonify({"error":"name_exists"}),409
    before=_type(obj);obj.name=name;obj.active=True
    try:
        db.session.flush();_audit("settings.catalog_type_updated","product_type",obj.id,{"scope":scope,"before":before,"after":_type(obj)});db.session.commit();return jsonify(_type(obj))
    except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.delete("/settings/product-catalog/type/<int:type_id>")
@permission_required("settings.manage")
def delete_type(type_id):
    scope=_scope(request.args.get("scope")); obj=db.session.get(ProductType,type_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("type",type_id,scope):return jsonify({"error":"not_found"}),404
    db.session.execute(text("DELETE FROM product_catalog_scopes WHERE entity_type='type' AND entity_id=:id AND scope=:scope"),{"id":type_id,"scope":scope})
    db.session.execute(text("DELETE FROM product_catalog_scopes WHERE entity_type='model' AND entity_id IN (SELECT id FROM product_models WHERE product_type_id=:id) AND scope=:scope"),{"id":type_id,"scope":scope})
    db.session.execute(text("""
        DELETE FROM product_catalog_scopes
        WHERE entity_type='brand'
          AND scope=:scope
          AND entity_id IN (
              SELECT b.id
              FROM brands b
              WHERE NOT EXISTS (
                  SELECT 1
                  FROM product_type_brands ptb
                  JOIN product_catalog_scopes pts
                    ON pts.entity_type='type' AND pts.entity_id=ptb.product_type_id AND pts.scope=:scope
                  WHERE ptb.brand_id=b.id
              )
          )
    """),{"scope":scope})
    other=db.session.execute(text("SELECT 1 FROM product_catalog_scopes WHERE entity_type='type' AND entity_id=:id LIMIT 1"),{"id":type_id}).first()
    if not other:obj.active=False
    _audit("settings.catalog_type_deleted","product_type",obj.id,{"scope":scope,"name":obj.name});db.session.commit();return jsonify({"ok":True})

@catalog_bp.post("/settings/product-catalog/brand")
@permission_required("settings.manage")
def create_brand():
    scope=_scope(request.args.get("scope")); data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); tid=data.get("product_type_id")
    if not scope or not name or not tid:return jsonify({"error":"scope_name_and_product_type_required"}),400
    typ=db.session.get(ProductType,int(tid))
    if not typ or not _scoped("type",typ.id,scope):return jsonify({"error":"invalid_product_type"}),400
    try:
        obj=Brand.query.filter(db.func.lower(Brand.name)==name.lower()).first()
        if not obj: obj=Brand(name=name,active=True);db.session.add(obj);db.session.flush()
        obj.active=True
        if typ not in obj.product_types: obj.product_types.append(typ)
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('brand',:id,:scope) ON CONFLICT DO NOTHING"),{"id":obj.id,"scope":scope})
        db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES('type',:id,:scope) ON CONFLICT DO NOTHING"),{"id":typ.id,"scope":scope})
        _audit("settings.catalog_brand_created","brand",obj.id,{"scope":scope,"product_type_id":typ.id});db.session.commit();return jsonify(_brand(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.patch("/settings/product-catalog/brand/<int:brand_id>")
@permission_required("settings.manage")
def update_brand(brand_id):
    scope=_scope(request.args.get("scope")); obj=db.session.get(Brand,brand_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("brand",brand_id,scope):return jsonify({"error":"not_found"}),404
    data=request.get_json(silent=True) or {};name=str(data.get("name") or obj.name).strip();tid=data.get("product_type_id")
    if not name:return jsonify({"error":"name_required"}),400
    conflict=Brand.query.filter(db.func.lower(Brand.name)==name.lower(),Brand.id!=obj.id).first()
    if conflict:return jsonify({"error":"name_exists"}),409
    if tid:
        typ=db.session.get(ProductType,int(tid))
        if not typ or not _scoped("type",typ.id,scope):return jsonify({"error":"invalid_product_type"}),400
        if typ not in obj.product_types:obj.product_types.append(typ)
    before=_brand(obj);obj.name=name;obj.active=True
    try:
        db.session.flush();_audit("settings.catalog_brand_updated","brand",obj.id,{"scope":scope,"before":before,"after":_brand(obj)});db.session.commit();return jsonify(_brand(obj))
    except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.delete("/settings/product-catalog/brand/<int:brand_id>")
@permission_required("settings.manage")
def delete_brand(brand_id):
    scope=_scope(request.args.get("scope"));obj=db.session.get(Brand,brand_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("brand",brand_id,scope):return jsonify({"error":"not_found"}),404
    db.session.execute(text("DELETE FROM product_catalog_scopes WHERE entity_type='brand' AND entity_id=:id AND scope=:scope"),{"id":brand_id,"scope":scope})
    db.session.execute(text("DELETE FROM product_catalog_scopes WHERE entity_type='model' AND entity_id IN (SELECT id FROM product_models WHERE brand_id=:id) AND scope=:scope"),{"id":brand_id,"scope":scope})
    other=db.session.execute(text("SELECT 1 FROM product_catalog_scopes WHERE entity_type='brand' AND entity_id=:id LIMIT 1"),{"id":brand_id}).first()
    if not other:obj.active=False
    _audit("settings.catalog_brand_deleted","brand",obj.id,{"scope":scope,"name":obj.name});db.session.commit();return jsonify({"ok":True})

@catalog_bp.post("/settings/product-catalog/model")
@permission_required("settings.manage")
def create_model():
    scope=_scope(request.args.get("scope")); data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); bid=data.get("brand_id"); tid=data.get("product_type_id")
    if not scope or not name or not bid or not tid:return jsonify({"error":"scope_name_brand_and_product_type_required"}),400
    brand=db.session.get(Brand,int(bid));typ=db.session.get(ProductType,int(tid))
    if not brand or not typ or not _scoped("brand",brand.id,scope) or not _scoped("type",typ.id,scope) or typ not in brand.product_types:return jsonify({"error":"invalid_brand_or_product_type"}),400
    try:
        obj=ProductModel.query.filter(db.func.lower(ProductModel.name)==name.lower(),ProductModel.brand_id==brand.id,ProductModel.product_type_id==typ.id).first()
        if not obj:obj=ProductModel(name=name,brand_id=brand.id,product_type_id=typ.id,active=True);db.session.add(obj);db.session.flush()
        obj.active=True
        for et,eid in (("type",typ.id),("brand",brand.id),("model",obj.id)):
            db.session.execute(text("INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) VALUES(:t,:id,:scope) ON CONFLICT DO NOTHING"),{"t":et,"id":eid,"scope":scope})
        _audit("settings.catalog_model_created","product_model",obj.id,{"scope":scope,"brand_id":brand.id,"product_type_id":typ.id});db.session.commit();return jsonify(_model(obj)),201
    except IntegrityError: db.session.rollback();return jsonify({"error":"model_exists"}),409

@catalog_bp.post("/settings/product-catalog/model/<int:model_id>/image")
@permission_required("settings.manage")
def upload_model_image(model_id):
    obj = db.session.get(ProductModel, model_id)
    if not obj or not obj.active:
        return jsonify({"error": "not_found"}), 404
    f = request.files.get("image")
    if not f or not f.filename:
        return jsonify({"error": "image_required"}), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    mimetype = (f.mimetype or "").lower()
    # Bazı istemciler doğru dosya uzantısına rağmen MIME bilgisini boş/generic gönderebilir.
    if ext not in IMAGE_EXTENSIONS:
        return jsonify({"error": "Sadece PNG, JPG ve WEBP görseller kabul edilir"}), 400
    if mimetype and mimetype not in IMAGE_MIMES and mimetype != "application/octet-stream":
        return jsonify({"error": "Desteklenmeyen görsel türü"}), 400
    f.stream.seek(0, 2)
    size = f.stream.tell()
    f.stream.seek(0)
    if size <= 0 or size > MAX_IMAGE_SIZE:
        return jsonify({"error": "Görsel 10 MB sınırını aşamaz"}), 400
    old_path = obj.image_path
    # Model başına deterministik dosya adı kullanılır. Böylece image_path yalnızca
    # API adresini taşısa bile GET endpoint hangi dosyayı servis edeceğini bilir.
    filename = f"product_model_{obj.id}.{ext}"
    path = os.path.join(_product_image_dir(), filename)
    f.save(path)
    obj.image_path = _image_url(obj.id)
    try:
        _audit("settings.product_model_image_updated", "product_model", obj.id, {"filename": filename, "size": size})
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(path):
            os.remove(path)
        raise
    if old_path and old_path.startswith("/api/settings/product-catalog/model/"):
        old_name = old_path.rsplit("/", 1)[-1]
        old_file = os.path.join(_product_image_dir(), old_name)
        if os.path.exists(old_file) and old_file != path:
            os.remove(old_file)
    return jsonify(_model(obj))

@catalog_bp.get("/settings/product-catalog/model/<int:model_id>/image")
@login_required
def get_model_image(model_id):
    obj = db.session.get(ProductModel, model_id)
    if not obj or not obj.image_path:
        return jsonify({"error": "image_not_found"}), 404
    directory = _product_image_dir()
    prefix = f"product_model_{model_id}."
    candidates = [name for name in os.listdir(directory) if name.startswith(prefix)]
    if not candidates:
        audit = AuditLog.query.filter_by(action="settings.product_model_image_updated", entity_type="product_model", entity_id=model_id).order_by(AuditLog.id.desc()).first()
        filename = (audit.details or {}).get("filename") if audit else None
        if not filename or not os.path.isfile(os.path.join(directory, filename)):
            return jsonify({"error": "image_file_not_found"}), 404
    else:
        filename = max(candidates, key=lambda name: os.path.getmtime(os.path.join(directory, name)))
    response = send_from_directory(directory, filename, as_attachment=False)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response

@catalog_bp.patch("/settings/product-catalog/model/<int:model_id>")
@permission_required("settings.manage")
def update_catalog_model(model_id):
    scope=_scope(request.args.get("scope"));obj=db.session.get(ProductModel,model_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("model",model_id,scope):return jsonify({"error":"not_found"}),404
    data=request.get_json(silent=True) or {};name=str(data.get("name") or obj.name).strip();bid=int(data.get("brand_id",obj.brand_id));tid=int(data.get("product_type_id",obj.product_type_id))
    brand=db.session.get(Brand,bid);typ=db.session.get(ProductType,tid)
    if not name:return jsonify({"error":"name_required"}),400
    if not brand or not typ or not _scoped("brand",bid,scope) or not _scoped("type",tid,scope) or typ not in brand.product_types:return jsonify({"error":"invalid_brand_or_product_type"}),400
    conflict=ProductModel.query.filter(db.func.lower(ProductModel.name)==name.lower(),ProductModel.brand_id==bid,ProductModel.product_type_id==tid,ProductModel.id!=obj.id).first()
    if conflict:return jsonify({"error":"model_exists"}),409
    before=_model(obj);obj.name=name;obj.brand_id=bid;obj.product_type_id=tid;obj.active=True
    try:
        db.session.flush();_audit("settings.catalog_model_updated","product_model",obj.id,{"scope":scope,"before":before,"after":_model(obj)});db.session.commit();return jsonify(_model(obj))
    except IntegrityError:db.session.rollback();return jsonify({"error":"model_exists"}),409

@catalog_bp.delete("/settings/product-catalog/model/<int:model_id>")
@permission_required("settings.manage")
def delete_catalog_model(model_id):
    scope=_scope(request.args.get("scope"));obj=db.session.get(ProductModel,model_id)
    if not scope:return jsonify({"error":"invalid_scope"}),400
    if not obj or not _scoped("model",model_id,scope):return jsonify({"error":"not_found"}),404
    db.session.execute(text("DELETE FROM product_catalog_scopes WHERE entity_type='model' AND entity_id=:id AND scope=:scope"),{"id":model_id,"scope":scope})
    other=db.session.execute(text("SELECT 1 FROM product_catalog_scopes WHERE entity_type='model' AND entity_id=:id LIMIT 1"),{"id":model_id}).first()
    if not other:obj.active=False
    _audit("settings.catalog_model_deleted","product_model",obj.id,{"scope":scope,"name":obj.name});db.session.commit();return jsonify({"ok":True})

@catalog_bp.get("/settings/license-catalog")
@login_required
def list_license_catalog():
    rows=db.session.execute(text("SELECT ln.id AS license_name_id,ln.name AS license_name,ln.active AS license_name_active,lm.id AS model_id,lm.name AS model_name,lm.active AS model_active,lm.image_path AS model_image_path FROM license_names ln LEFT JOIN license_models lm ON lm.license_name_id=ln.id ORDER BY ln.name,lm.name" )).mappings().all()
    items={}
    for r in rows:
        item=items.setdefault(r["license_name_id"],{"id":r["license_name_id"],"name":r["license_name"],"active":r["license_name_active"],"models":[]})
        if r["model_id"] is not None:item["models"].append({"id":r["model_id"],"name":r["model_name"],"active":r["model_active"],"image_path":r["model_image_path"]})
    return jsonify({"items":list(items.values())})

@catalog_bp.post("/settings/license-catalog/name")
@permission_required("settings.manage")
def create_license_catalog_name():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip()
    if not name:return jsonify({"error":"name_required"}),400
    row=db.session.execute(text("SELECT id,name,active FROM license_names WHERE lower(name)=lower(:name)"),{"name":name}).mappings().first()
    if row:
        db.session.execute(text("UPDATE license_names SET active=true,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":row["id"]});db.session.commit();return jsonify(dict(row)),200
    try:
        row=db.session.execute(text("INSERT INTO license_names(name,active,created_at,updated_at) VALUES(:name,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id,name,active"),{"name":name}).mappings().first()
        _audit("settings.license_name_created","license_name",row["id"],{"name":name});db.session.commit();return jsonify(dict(row)),201
    except IntegrityError:db.session.rollback();return jsonify({"error":"name_exists"}),409

@catalog_bp.patch("/settings/license-catalog/name/<int:license_name_id>")
@permission_required("settings.manage")
def update_license_catalog_name(license_name_id):
    data=request.get_json(silent=True) or {};obj=db.session.execute(text("SELECT id,name,active FROM license_names WHERE id=:id"),{"id":license_name_id}).mappings().first()
    if not obj:return jsonify({"error":"not_found"}),404
    name=str(data.get("name") or obj["name"]).strip()
    if not name:return jsonify({"error":"name_required"}),400
    conflict=db.session.execute(text("SELECT 1 FROM license_names WHERE lower(name)=lower(:name) AND id<>:id"),{"name":name,"id":license_name_id}).first()
    if conflict:return jsonify({"error":"name_exists"}),409
    db.session.execute(text("UPDATE license_names SET name=:name,active=true,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"name":name,"id":license_name_id})
    _audit("settings.license_name_updated","license_name",license_name_id,{"before":dict(obj),"name":name});db.session.commit();return jsonify({"id":license_name_id,"name":name,"active":True})

@catalog_bp.delete("/settings/license-catalog/name/<int:license_name_id>")
@permission_required("settings.manage")
def delete_license_catalog_name(license_name_id):
    obj=db.session.execute(text("SELECT id,name,active FROM license_names WHERE id=:id"),{"id":license_name_id}).mappings().first()
    if not obj:return jsonify({"error":"not_found"}),404
    db.session.execute(text("UPDATE license_names SET active=false,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":license_name_id})
    db.session.execute(text("UPDATE license_models SET active=false,updated_at=CURRENT_TIMESTAMP WHERE license_name_id=:id"),{"id":license_name_id})
    _audit("settings.license_name_deleted","license_name",license_name_id,{"name":obj["name"]});db.session.commit();return jsonify({"ok":True})

@catalog_bp.post("/settings/license-catalog/model")
@permission_required("settings.manage")
def create_license_catalog_model():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); license_name_id=data.get("license_name_id")
    if not name or not license_name_id:return jsonify({"error":"license_name_and_model_required"}),400
    try:license_name_id=int(license_name_id)
    except (TypeError,ValueError):return jsonify({"error":"invalid_license_name"}),400
    if not db.session.execute(text("SELECT 1 FROM license_names WHERE id=:id AND active=true"),{"id":license_name_id}).first():return jsonify({"error":"invalid_license_name"}),400
    try:
        row=db.session.execute(text("SELECT id,name,active,image_path FROM license_models WHERE license_name_id=:lid AND lower(name)=lower(:name)"),{"lid":license_name_id,"name":name}).mappings().first()
        if row:
            db.session.execute(text("UPDATE license_models SET active=true,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":row["id"]});db.session.commit();return jsonify(dict(row)),200
        row=db.session.execute(text("INSERT INTO license_models(license_name_id,name,active,created_at,updated_at) VALUES(:lid,:name,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id,name,active,image_path"),{"lid":license_name_id,"name":name}).mappings().first()
        _audit("settings.license_model_created","license_model",row["id"],{"license_name_id":license_name_id,"name":name});db.session.commit();return jsonify(dict(row)),201
    except IntegrityError:db.session.rollback();return jsonify({"error":"model_exists"}),409

@catalog_bp.patch("/settings/license-catalog/model/<int:model_id>")
@permission_required("settings.manage")
def update_license_catalog_model(model_id):
    data=request.get_json(silent=True) or {};row=db.session.execute(text("SELECT id,license_name_id,name,active,image_path FROM license_models WHERE id=:id"),{"id":model_id}).mappings().first()
    if not row:return jsonify({"error":"not_found"}),404
    name=str(data.get("name") or row["name"]).strip();lid=int(data.get("license_name_id",row["license_name_id"]))
    if not name:return jsonify({"error":"name_required"}),400
    if not db.session.execute(text("SELECT 1 FROM license_names WHERE id=:id AND active=true"),{"id":lid}).first():return jsonify({"error":"invalid_license_name"}),400
    conflict=db.session.execute(text("SELECT 1 FROM license_models WHERE license_name_id=:lid AND lower(name)=lower(:name) AND id<>:id"),{"lid":lid,"name":name,"id":model_id}).first()
    if conflict:return jsonify({"error":"model_exists"}),409
    db.session.execute(text("UPDATE license_models SET license_name_id=:lid,name=:name,active=true,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"lid":lid,"name":name,"id":model_id})
    _audit("settings.license_model_updated","license_model",model_id,{"before":dict(row),"license_name_id":lid,"name":name});db.session.commit();return jsonify({"id":model_id,"license_name_id":lid,"name":name,"active":True,"image_path":row["image_path"]})

@catalog_bp.post("/settings/license-catalog/model/<int:model_id>/image")
@permission_required("settings.manage")
def upload_license_model_image(model_id):
    row = db.session.execute(text("SELECT id,image_path,active FROM license_models WHERE id=:id"), {"id": model_id}).mappings().first()
    if not row or not row["active"]:
        return jsonify({"error": "not_found"}), 404
    f = request.files.get("image")
    if not f or not f.filename:
        return jsonify({"error": "image_required"}), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    mimetype = (f.mimetype or "").lower()
    # Bazı istemciler doğru dosya uzantısına rağmen MIME bilgisini boş/generic gönderebilir.
    if ext not in IMAGE_EXTENSIONS:
        return jsonify({"error": "Sadece PNG, JPG ve WEBP görseller kabul edilir"}), 400
    if mimetype and mimetype not in IMAGE_MIMES and mimetype != "application/octet-stream":
        return jsonify({"error": "Desteklenmeyen görsel türü"}), 400
    f.stream.seek(0, 2)
    size = f.stream.tell()
    f.stream.seek(0)
    if size <= 0 or size > MAX_IMAGE_SIZE:
        return jsonify({"error": "Görsel 10 MB sınırını aşamaz"}), 400
    old_path = row["image_path"]
    filename = f"license_model_{model_id}.{ext}"
    path = os.path.join(_product_image_dir(), filename)
    f.save(path)
    image_path = _license_image_url(model_id)
    try:
        db.session.execute(text("UPDATE license_models SET image_path=:path,updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {"path": image_path, "id": model_id})
        _audit("settings.license_model_image_updated", "license_model", model_id, {"filename": filename, "size": size})
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(path):
            os.remove(path)
        raise
    if old_path and old_path.startswith("/api/settings/license-catalog/model/"):
        old_name = old_path.rsplit("/", 1)[-1]
        old_file = os.path.join(_product_image_dir(), old_name)
        if os.path.exists(old_file) and old_file != path:
            os.remove(old_file)
    return jsonify({"id": model_id, "image_path": image_path})

@catalog_bp.get("/settings/license-catalog/model/<int:model_id>/image")
@login_required
def get_license_model_image(model_id):
    row = db.session.execute(text("SELECT image_path FROM license_models WHERE id=:id"), {"id": model_id}).mappings().first()
    if not row or not row["image_path"]:
        return jsonify({"error": "image_not_found"}), 404
    directory = _product_image_dir()
    prefix = f"license_model_{model_id}."
    candidates = [name for name in os.listdir(directory) if name.startswith(prefix)]
    if not candidates:
        audit = AuditLog.query.filter_by(action="settings.product_model_image_updated", entity_type="product_model", entity_id=model_id).order_by(AuditLog.id.desc()).first()
        filename = (audit.details or {}).get("filename") if audit else None
        if not filename or not os.path.isfile(os.path.join(directory, filename)):
            return jsonify({"error": "image_file_not_found"}), 404
    else:
        filename = max(candidates, key=lambda name: os.path.getmtime(os.path.join(directory, name)))
    response = send_from_directory(directory, filename, as_attachment=False)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response

@catalog_bp.delete("/settings/license-catalog/model/<int:model_id>")
@permission_required("settings.manage")
def delete_license_catalog_model(model_id):
    row=db.session.execute(text("SELECT id,license_name_id,name,active,image_path FROM license_models WHERE id=:id"),{"id":model_id}).mappings().first()
    if not row:return jsonify({"error":"not_found"}),404
    db.session.execute(text("UPDATE license_models SET active=false,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":model_id})
    _audit("settings.license_model_deleted","license_model",model_id,{"name":row["name"]});db.session.commit();return jsonify({"ok":True})
