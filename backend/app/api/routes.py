from datetime import date
from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import AssignmentHistory, AuditLog, Brand, Department, Factory, Inventory, License, LicenseName, Personnel, ProductModel, ProductType, ScrapRecord

api_bp = Blueprint("api", __name__)

def _items(model):
    return [{"id": x.id, "name": x.name} for x in model.query.filter_by(active=True).order_by(model.name).all()]

def _audit(action, entity_type, entity_id, details=None, actor_user_id=None):
    db.session.add(AuditLog(action=action, entity_type=entity_type, entity_id=entity_id, actor_user_id=actor_user_id, details=details or {}))

def _find_by_name(model, value):
    if value is None or value == "": return None
    return model.query.filter(db.func.lower(model.name) == str(value).strip().lower()).first()

def _resolve(model, value, field):
    obj = db.session.get(model, int(value)) if str(value).isdigit() else _find_by_name(model, value)
    if not obj or getattr(obj, "active", True) is False: raise ValueError(f"Geçersiz {field}")
    return obj

def _inventory_dict(x):
    return {"id":x.id,"inventory_no":x.inventory_no,"computer_name":x.computer_name,"serial_no":x.serial_no,"machine_no":x.machine_no,"ifs_no":x.ifs_no,"note":x.note,"status":x.status,"factory":{"id":x.factory_id,"name":x.factory.name} if x.factory else None,"department":{"id":x.department_id,"name":x.department.name} if x.department else None,"device_type":{"id":x.product_type_id,"name":x.product_type.name} if x.product_type else None,"brand":{"id":x.brand_id,"name":x.brand.name} if x.brand else None,"model":{"id":x.model_id,"name":x.model.name} if x.model else None,"personnel":{"id":x.personnel_id,"name":x.personnel.name} if x.personnel else None,"created_at":x.created_at.isoformat() if x.created_at else None,"updated_at":x.updated_at.isoformat() if x.updated_at else None}

@api_bp.get("/master-data")
def master_data():
    return jsonify({"factories":_items(Factory),"departments":_items(Department),"personnel":_items(Personnel),"hardware_types":_items(ProductType),"brands":_items(Brand),"models":[{"id":x.id,"name":x.name,"brand_id":x.brand_id,"product_type_id":x.product_type_id} for x in ProductModel.query.filter_by(active=True).order_by(ProductModel.name).all()],"licenses":_items(LicenseName)})

@api_bp.get("/master-data/<string:resource>")
def master_resource(resource):
    resources={"factories":Factory,"departments":Department,"personnel":Personnel,"hardware-types":ProductType,"brands":Brand,"licenses":LicenseName}; model=resources.get(resource)
    if not model:return jsonify({"error":"Bilinmeyen master veri kaynağı"}),404
    return jsonify(_items(model))

@api_bp.get("/brands/<int:brand_id>/models")
def brand_models(brand_id):
    return jsonify([{"id":x.id,"name":x.name,"product_type_id":x.product_type_id} for x in ProductModel.query.filter_by(brand_id=brand_id,active=True).order_by(ProductModel.name).all()])

@api_bp.get("/inventory")
def list_inventory():
    query=Inventory.query; search=request.args.get("search","").strip(); status=request.args.get("status","").strip()
    fields=((Inventory.factory_id,"factory_id"),(Inventory.department_id,"department_id"),(Inventory.product_type_id,"product_type_id"),(Inventory.brand_id,"brand_id"),(Inventory.model_id,"model_id"),(Inventory.personnel_id,"personnel_id"))
    if search:
        term=f"%{search}%"; query=query.outerjoin(ProductModel,Inventory.model_id==ProductModel.id).outerjoin(Personnel,Inventory.personnel_id==Personnel.id).filter(or_(Inventory.inventory_no.ilike(term),Inventory.serial_no.ilike(term),Inventory.computer_name.ilike(term),ProductModel.name.ilike(term),Personnel.name.ilike(term)))
    if status: query=query.filter(Inventory.status==status)
    for field,key in fields:
        value=request.args.get(key,"").strip()
        if value:
            try: query=query.filter(field==int(value))
            except ValueError:return jsonify({"error":"Filtre parametresi geçersiz"}),400
    page=max(request.args.get("page",1,type=int),1); per_page=min(max(request.args.get("per_page",25,type=int),1),100); p=query.order_by(Inventory.id.desc()).paginate(page=page,per_page=per_page,error_out=False)
    return jsonify({"items":[_inventory_dict(x) for x in p.items],"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages}})

@api_bp.get("/inventory/<int:inventory_id>")
def get_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id)
    return jsonify(_inventory_dict(x)) if x else (jsonify({"error":"Envanter kaydı bulunamadı"}),404)

def _inventory_payload(data,item=None):
    vals={}
    inv=data.get("inventory_no", item.inventory_no if item else None)
    if not inv: raise ValueError("inventory_no alanı zorunludur")
    vals["inventory_no"]=str(inv).strip()
    mapping={"factory":("factory_id",Factory),"department":("department_id",Department),"device_type":("product_type_id",ProductType),"brand":("brand_id",Brand)}
    for key,(dest,model) in mapping.items():
        value=data.get(key, getattr(item,dest,None) if item else None)
        if value in (None,""): raise ValueError(f"{key} alanı zorunludur")
        vals[dest]=_resolve(model,value,key).id
    model_value=data.get("model", item.model_id if item else None)
    if model_value not in (None,""):
        m=_resolve(ProductModel,model_value,"model")
        if m.brand_id!=vals["brand_id"]: raise ValueError("Model markayla eşleşmiyor")
        vals["model_id"]=m.id
    else: vals["model_id"]=None
    person_value=data.get("person",data.get("personnel_id",item.personnel_id if item else None))
    if person_value not in (None,""): vals["personnel_id"]=_resolve(Personnel,person_value,"personel").id
    else: vals["personnel_id"]=None
    for key in ("computer_name","serial_no","machine_no","ifs_no","note","status"):
        if key in data: vals[key]=data[key] if data[key] not in ("",None) else None
    return vals

@api_bp.post("/inventory")
def create_inventory():
    try:
        x=Inventory(**_inventory_payload(request.get_json(silent=True) or {})); db.session.add(x); db.session.flush(); _audit("inventory.created","inventory",x.id,{"inventory_no":x.inventory_no}); db.session.commit(); return jsonify(_inventory_dict(x)),201
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Envanter kaydı oluşturulamadı","detail":str(e)}),409

@api_bp.patch("/inventory/<int:inventory_id>")
@api_bp.put("/inventory/<int:inventory_id>")
def update_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id)
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    try:
        before=_inventory_dict(x); [setattr(x,k,v) for k,v in _inventory_payload(request.get_json(silent=True) or {},x).items()]; db.session.flush(); _audit("inventory.updated","inventory",x.id,{"before":before,"after":_inventory_dict(x)}); db.session.commit(); return jsonify(_inventory_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Envanter kaydı güncellenemedi","detail":str(e)}),409

@api_bp.post("/inventory/<int:inventory_id>/assign")
def assign_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    try:
        p=_resolve(Personnel,data.get("personnel_id",data.get("person")),"personel"); old=x.personnel_id; x.personnel_id=p.id; db.session.add(AssignmentHistory(personnel_id=p.id,asset_type="inventory",asset_id=x.id,action="assign",note=data.get("note"))); _audit("inventory.assigned","inventory",x.id,{"from_personnel_id":old,"to_personnel_id":p.id,"note":data.get("note")}); db.session.commit(); return jsonify(_inventory_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400

@api_bp.post("/inventory/<int:inventory_id>/mark-faulty")
def mark_inventory_faulty(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    old=x.status; x.status="faulty"; x.note=data.get("note",x.note); _audit("inventory.mark_faulty","inventory",x.id,{"from_status":old,"note":data.get("note")}); db.session.commit(); return jsonify(_inventory_dict(x))

@api_bp.post("/inventory/<int:inventory_id>/send-to-it")
def send_inventory_to_it(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    old=x.status; old_person=x.personnel_id; x.personnel_id=None; x.status="it"; x.note=data.get("note",x.note); _audit("inventory.sent_to_it","inventory",x.id,{"from_personnel_id":old_person,"from_status":old,"note":data.get("note")}); db.session.commit(); return jsonify(_inventory_dict(x))

@api_bp.post("/inventory/<int:inventory_id>/scrap")
def scrap_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}; reason=str(data.get("reason","")).strip()
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    if not reason:return jsonify({"error":"Hurda nedeni zorunludur"}),400
    old=x.status; x.status="scrapped"; x.personnel_id=None; db.session.add(ScrapRecord(source_type="inventory",source_id=x.id,reason=reason,note=data.get("note"))); _audit("inventory.scrapped","inventory",x.id,{"from_status":old,"reason":reason,"note":data.get("note")}); db.session.commit(); return jsonify(_inventory_dict(x))

# -------------------- LICENSE API --------------------
def _license_dict(x):
    return {"id":x.id,"license_name":{"id":x.license_name_id,"name":x.license_name.name} if x.license_name else None,"license_type":x.license_type,"license_key":x.license_key,"email":x.email,"password":x.password,"expires_at":x.expires_at.isoformat() if x.expires_at else None,"note":x.note,"status":x.status,"created_at":x.created_at.isoformat() if x.created_at else None,"updated_at":x.updated_at.isoformat() if x.updated_at else None}

def _license_payload(data,x=None):
    name_value=data.get("license_name", x.license_name_id if x else None)
    if name_value in (None,""): raise ValueError("license_name alanı zorunludur")
    name=_resolve(LicenseName,name_value,"lisans adı"); vals={"license_name_id":name.id}
    for key in ("license_type","license_key","email","password","note","status"):
        if key in data: vals[key]=data[key] if data[key] not in ("",None) else None
    if x is None and "license_type" not in vals: vals["license_type"]="subscription"
    if "expires_at" in data:
        value=data["expires_at"]
        try: vals["expires_at"]=date.fromisoformat(value) if value else None
        except (TypeError,ValueError): raise ValueError("Geçersiz bitiş tarihi")
    return vals

@api_bp.get("/licenses")
def list_licenses():
    q=License.query.join(LicenseName); search=request.args.get("search","").strip(); status=request.args.get("status","").strip(); license_type=request.args.get("license_type","").strip()
    if search:
        term=f"%{search}%"; q=q.filter(or_(LicenseName.name.ilike(term),License.email.ilike(term),License.license_key.ilike(term)))
    if status:q=q.filter(License.status==status)
    if license_type:q=q.filter(License.license_type==license_type)
    page=max(request.args.get("page",1,type=int),1); per_page=min(max(request.args.get("per_page",25,type=int),1),100); p=q.order_by(License.id.desc()).paginate(page=page,per_page=per_page,error_out=False)
    return jsonify({"items":[_license_dict(x) for x in p.items],"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages}})

@api_bp.get("/licenses/<int:license_id>")
def get_license(license_id):
    x=db.session.get(License,license_id); return jsonify(_license_dict(x)) if x else (jsonify({"error":"Lisans kaydı bulunamadı"}),404)

@api_bp.post("/licenses")
def create_license():
    try:
        x=License(**_license_payload(request.get_json(silent=True) or {})); db.session.add(x); db.session.flush(); _audit("license.created","license",x.id,{"license_name_id":x.license_name_id}); db.session.commit(); return jsonify(_license_dict(x)),201
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Lisans kaydı oluşturulamadı","detail":str(e)}),409

@api_bp.patch("/licenses/<int:license_id>")
@api_bp.put("/licenses/<int:license_id>")
def update_license(license_id):
    x=db.session.get(License,license_id)
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    try:
        before=_license_dict(x); [setattr(x,k,v) for k,v in _license_payload(request.get_json(silent=True) or {},x).items()]; db.session.flush(); _audit("license.updated","license",x.id,{"before":before,"after":_license_dict(x)}); db.session.commit(); return jsonify(_license_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Lisans güncellenemedi","detail":str(e)}),409

@api_bp.post("/licenses/<int:license_id>/assign")
def assign_license(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    try:
        p=_resolve(Personnel,data.get("personnel_id",data.get("person")),"personel"); db.session.add(AssignmentHistory(personnel_id=p.id,asset_type="license",asset_id=x.id,action="assign",note=data.get("note"))); _audit("license.assigned","license",x.id,{"to_personnel_id":p.id,"note":data.get("note")}); db.session.commit(); return jsonify(_license_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400

@api_bp.post("/licenses/<int:license_id>/send-to-it")
def send_license_to_it(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    old=x.status; x.status="it"; x.note=data.get("note",x.note); _audit("license.sent_to_it","license",x.id,{"from_status":old,"note":data.get("note")}); db.session.commit(); return jsonify(_license_dict(x))

@api_bp.post("/licenses/<int:license_id>/scrap")
def scrap_license(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}; reason=str(data.get("reason","")).strip()
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    if not reason:return jsonify({"error":"Hurda nedeni zorunludur"}),400
    old=x.status; x.status="scrapped"; db.session.add(ScrapRecord(source_type="license",source_id=x.id,reason=reason,note=data.get("note"))); _audit("license.scrapped","license",x.id,{"from_status":old,"reason":reason,"note":data.get("note")}); db.session.commit(); return jsonify(_license_dict(x))
