from datetime import date, timedelta
from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_, text
from sqlalchemy.orm import joinedload
from ..extensions import db
from ..models import AssignmentHistory, AuditLog, Brand, Department, Factory, Inventory, License, LicenseModel, LicenseName, Personnel, ProductModel, ProductType, ScrapRecord, StockItem, StockMovement, MaintenanceRecord, PurchaseRequest, User
from .auth_routes import current_user, login_required

api_bp = Blueprint("api", __name__)

def _items(model):
    return [{"id": x.id, "name": x.name} for x in model.query.filter_by(active=True).order_by(model.name).all()]

def _audit(action, entity_type, entity_id, details=None, actor_user_id=None):
    if actor_user_id is None:
        actor = current_user()
        actor_user_id = actor.id if actor else None
    db.session.add(AuditLog(action=action, entity_type=entity_type, entity_id=entity_id, actor_user_id=actor_user_id, details=details or {}))

def _find_by_name(model, value):
    if value is None or value == "": return None
    return model.query.filter(db.func.lower(model.name) == str(value).strip().lower()).first()

def _resolve(model, value, field):
    obj = db.session.get(model, int(value)) if str(value).isdigit() else _find_by_name(model, value)
    if not obj or getattr(obj, "active", True) is False: raise ValueError(f"Geçersiz {field}")
    return obj

def _catalog_scoped(entity_type, entity_id, scope):
    return db.session.execute(text("SELECT 1 FROM product_catalog_scopes WHERE entity_type=:t AND entity_id=:id AND scope=:scope"),
                              {"t": entity_type, "id": entity_id, "scope": scope}).first() is not None

def _inventory_dict(x):
    return {"id":x.id,"barcode":x.barcode,"inventory_no":x.inventory_no,"computer_name":x.computer_name,"serial_no":x.serial_no,"machine_no":x.machine_no,"ifs_no":x.ifs_no,"note":x.note,"status":x.status,"factory":{"id":x.factory_id,"name":x.factory.name} if x.factory else None,"department":{"id":x.department_id,"name":x.department.name} if x.department else None,"device_type":{"id":x.product_type_id,"name":x.product_type.name} if x.product_type else None,"brand":{"id":x.brand_id,"name":x.brand.name} if x.brand else None,"model":{"id":x.model_id,"name":x.model.name,"image_path":x.model.image_path} if x.model else None,"personnel":{"id":x.personnel_id,"name":x.personnel.name} if x.personnel else None,"created_at":x.created_at.isoformat() if x.created_at else None,"updated_at":x.updated_at.isoformat() if x.updated_at else None}

@api_bp.get("/dashboard/summary")
@login_required
def dashboard_summary():
    inventory_total = Inventory.query.count()
    inventory_status = dict(db.session.query(Inventory.status, func.count(Inventory.id)).group_by(Inventory.status).all())
    type_rows = db.session.query(ProductType.name, func.count(Inventory.id)).outerjoin(Inventory, Inventory.product_type_id == ProductType.id).filter(ProductType.active == True).group_by(ProductType.name).order_by(func.count(Inventory.id).desc()).all()
    stock_in = db.session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(StockMovement.movement_type == "in").scalar() or 0
    stock_out = db.session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(StockMovement.movement_type == "out").scalar() or 0
    stock_total = db.session.query(func.coalesce(func.sum(StockItem.quantity), 0)).scalar() or 0
    maintenance_status = dict(db.session.query(MaintenanceRecord.status, func.count(MaintenanceRecord.id)).group_by(MaintenanceRecord.status).all())
    request_status = dict(db.session.query(PurchaseRequest.status, func.count(PurchaseRequest.id)).group_by(PurchaseRequest.status).all())
    monthly_rows = db.session.query(func.date_trunc("month", AuditLog.created_at), func.count(AuditLog.id)).group_by(func.date_trunc("month", AuditLog.created_at)).order_by(func.date_trunc("month", AuditLog.created_at).desc()).limit(4).all()
    recent = AuditLog.query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(10).all()
    actor_ids = {x.actor_user_id for x in recent if x.actor_user_id}
    actors = {u.id: u for u in User.query.filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
    return jsonify({
        "inventory": {
            "total": inventory_total,
            "active": inventory_status.get("active", 0),
            "faulty": inventory_status.get("faulty", 0),
            "maintenance": inventory_status.get("maintenance", 0),
            "it": inventory_status.get("it", 0),
            "scrapped": inventory_status.get("scrapped", 0),
            "by_status": [{"label": k, "count": int(v)} for k, v in inventory_status.items()],
            "by_type": [{"label": k, "count": int(v)} for k, v in type_rows],
        },
        "requests": {k: int(v) for k, v in request_status.items()},
        "maintenance": {k: int(v) for k, v in maintenance_status.items()},
        "stock": {"in": float(stock_in), "out": float(stock_out), "total_quantity": float(stock_total)},
        "monthly_activity": [{"month": x.isoformat() if x else None, "count": int(n)} for x, n in monthly_rows],
        "recent_activity": [{"action": x.action, "actor": actors.get(x.actor_user_id).username if actors.get(x.actor_user_id) else "Sistem", "created_at": x.created_at.isoformat() if x.created_at else None} for x in recent],
    })

@api_bp.get("/barcode/<path:barcode>")
@login_required
def barcode_lookup(barcode):
    code=str(barcode or "").strip().upper()
    if not code:return jsonify({"error":"Barkod boş olamaz"}),400
    if code.startswith("ENV-"):
        x=Inventory.query.filter_by(barcode=code).first()
        return (jsonify({"type":"inventory","id":x.id,"barcode":x.barcode,"detail_url":f"#inventory/{x.id}","item":_inventory_dict(x)}) if x else (jsonify({"error":"Envanter barkodu bulunamadı"}),404))
    if code.startswith("STK-"):
        x=StockItem.query.filter_by(barcode=code).first()
        if not x:return jsonify({"error":"Stok barkodu bulunamadı"}),404
        return jsonify({"type":"stock","id":x.id,"barcode":x.barcode,"detail_url":f"#stock/{x.id}","item":{"id":x.id,"barcode":x.barcode,"product_type":{"id":x.product_type_id,"name":x.product_type.name} if x.product_type else None,"brand":{"id":x.brand_id,"name":x.brand.name} if x.brand else None,"model":{"id":x.model_id,"name":x.model.name,"image_path":x.model.image_path} if x.model else None,"quantity":float(x.quantity or 0),"unit":x.unit,"status":x.status}})
    if code.startswith("LIC-"):
        x=License.query.filter_by(barcode=code).first()
        return (jsonify({"type":"license","id":x.id,"barcode":x.barcode,"detail_url":f"#licenses/{x.id}","item":_license_dict(x)}) if x else (jsonify({"error":"Lisans barkodu bulunamadı"}),404))
    return jsonify({"error":"Geçersiz barkod. STK-, ENV- veya LIC- ile başlamalıdır."}),400

@api_bp.get("/master-data")
@login_required
def master_data():
    scope=str(request.args.get("scope") or "inventory").strip().lower()
    if scope not in {"inventory", "stock"}: scope="inventory"
    tids={r[0] for r in db.session.execute(text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type='type' AND scope=:scope"), {"scope":scope}).all()}
    bids={r[0] for r in db.session.execute(text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type='brand' AND scope=:scope"), {"scope":scope}).all()}
    mids={r[0] for r in db.session.execute(text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type='model' AND scope=:scope"), {"scope":scope}).all()}
    return jsonify({"factories":_items(Factory),"departments":_items(Department),"personnel":_items(Personnel),
                    "hardware_types":[{"id":x.id,"name":x.name} for x in ProductType.query.filter(ProductType.active.is_(True),ProductType.id.in_(tids) if tids else False).order_by(ProductType.name).all()],
                    "brands":[{"id":x.id,"name":x.name,"product_type_ids":[p.id for p in x.product_types if p.active and p.id in tids]} for x in Brand.query.filter(Brand.active.is_(True),Brand.id.in_(bids) if bids else False).order_by(Brand.name).all()],
                    "models":[{"id":x.id,"name":x.name,"brand_id":x.brand_id,"product_type_id":x.product_type_id} for x in ProductModel.query.filter(ProductModel.active.is_(True),ProductModel.id.in_(mids) if mids else False).order_by(ProductModel.name).all()],
                    "licenses":_items(LicenseName)})

@api_bp.get("/master-data/<string:resource>")
@login_required
def master_resource(resource):
    resources={"factories":Factory,"departments":Department,"personnel":Personnel,"hardware-types":ProductType,"brands":Brand,"licenses":LicenseName}; model=resources.get(resource)
    if not model:return jsonify({"error":"Bilinmeyen master veri kaynağı"}),404
    return jsonify(_items(model))

@api_bp.get("/brands/<int:brand_id>/models")
@login_required
def brand_models(brand_id):
    return jsonify([{"id":x.id,"name":x.name,"product_type_id":x.product_type_id} for x in ProductModel.query.filter_by(brand_id=brand_id,active=True).order_by(ProductModel.name).all()])

@api_bp.get("/inventory")
@login_required
def list_inventory():
    query=Inventory.query.options(joinedload(Inventory.factory),joinedload(Inventory.department),joinedload(Inventory.product_type),joinedload(Inventory.brand),joinedload(Inventory.model),joinedload(Inventory.personnel)); search=request.args.get("search","").strip(); status=request.args.get("status","").strip()
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
@login_required
def get_inventory(inventory_id):
    x=Inventory.query.options(joinedload(Inventory.factory),joinedload(Inventory.department),joinedload(Inventory.product_type),joinedload(Inventory.brand),joinedload(Inventory.model),joinedload(Inventory.personnel)).filter_by(id=inventory_id).first()
    return jsonify(_inventory_dict(x)) if x else (jsonify({"error":"Envanter kaydı bulunamadı"}),404)

@api_bp.get("/inventory/<int:inventory_id>/history")
@login_required
def inventory_history(inventory_id):
    x=db.session.get(Inventory, inventory_id)
    if not x:
        return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    rows=AuditLog.query.filter_by(entity_type="inventory", entity_id=inventory_id).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(100).all()
    labels={
        "inventory.created":"Envanter oluşturuldu",
        "inventory.updated":"Envanter güncellendi",
        "inventory.assigned":"Envanter atandı",
        "inventory.mark_faulty":"Arızalı işaretlendi",
        "inventory.sent_to_it":"Bilgi İşleme gönderildi",
        "inventory.scrapped":"Hurdaya ayrıldı",
    }
    return jsonify({"items":[{"id":r.id,"action":r.action,"action_label":labels.get(r.action,r.action),"details":r.details or {},"created_at":r.created_at.isoformat() if r.created_at else None} for r in rows]})

INVENTORY_STATUSES={"active","faulty","maintenance","it","scrapped"}

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
    masters=(db.session.get(Factory, vals["factory_id"]),db.session.get(Department, vals["department_id"]),db.session.get(ProductType, vals["product_type_id"]),db.session.get(Brand, vals["brand_id"]))
    if not all(obj and obj.active for obj in masters):
        raise ValueError("Pasif master kayıt kullanılamaz")
    if not _catalog_scoped("type", vals["product_type_id"], "inventory") or not _catalog_scoped("brand", vals["brand_id"], "inventory"):
        raise ValueError("Seçilen donanım tipi veya marka Envanter Takip kataloğunda tanımlı değil")
    if vals["product_type_id"] not in {p.id for p in masters[3].product_types}:
        raise ValueError("Marka, seçilen donanım tipiyle eşleşmiyor")
    model_value=data.get("model", item.model_id if item else None)
    if model_value not in (None,""):
        m=_resolve(ProductModel,model_value,"model")
        if not m.active: raise ValueError("Pasif model kullanılamaz")
        if not _catalog_scoped("model", m.id, "inventory"):
            raise ValueError("Seçilen model Envanter Takip kataloğunda tanımlı değil")
        if m.brand_id!=vals["brand_id"]: raise ValueError("Model markayla eşleşmiyor")
        if m.product_type_id is not None and m.product_type_id!=vals["product_type_id"]: raise ValueError("Model donanım tipiyle eşleşmiyor")
        vals["model_id"]=m.id
    else: vals["model_id"]=None
    person_value=data.get("person",data.get("personnel_id",item.personnel_id if item else None))
    if person_value not in (None,""): vals["personnel_id"]=_resolve(Personnel,person_value,"personel").id
    else: vals["personnel_id"]=None
    for key in ("computer_name","serial_no","machine_no","ifs_no","note","status"):
        if key in data:
            value=data[key] if data[key] not in ("",None) else None
            if key=="status" and value is not None:
                value=str(value).strip().lower()
                if value not in INVENTORY_STATUSES: raise ValueError("Geçersiz envanter durumu")
            vals[key]=value
    return vals

@api_bp.post("/inventory")
@login_required
def create_inventory():
    try:
        x=Inventory(**_inventory_payload(request.get_json(silent=True) or {})); db.session.add(x); db.session.flush(); _audit("inventory.created","inventory",x.id,{"inventory_no":x.inventory_no}); db.session.commit(); return jsonify(_inventory_dict(x)),201
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Envanter kaydı oluşturulamadı","detail":str(e)}),409

@api_bp.patch("/inventory/<int:inventory_id>")
@api_bp.put("/inventory/<int:inventory_id>")
@login_required
def update_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id)
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    try:
        payload=_inventory_payload(request.get_json(silent=True) or {},x)
        if "status" in payload and payload["status"]=="scrapped" and x.status!="scrapped":
            raise ValueError("Hurda durumu için Hurdaya Ayır işlemini kullanın")
        if x.status=="scrapped" and "status" in payload and payload["status"]!="scrapped":
            raise ValueError("Hurda kaydı normal düzenleme ile geri alınamaz")
        before=_inventory_dict(x); [setattr(x,k,v) for k,v in payload.items()]; db.session.flush(); _audit("inventory.updated","inventory",x.id,{"before":before,"after":_inventory_dict(x)}); db.session.commit(); return jsonify(_inventory_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Envanter kaydı güncellenemedi","detail":str(e)}),409

@api_bp.post("/inventory/<int:inventory_id>/assign")
@login_required
def assign_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    if x.status=="scrapped":return jsonify({"error":"Hurda durumundaki envanter atanamaz"}),400
    try:
        p=_resolve(Personnel,data.get("personnel_id",data.get("person")),"personel")
        old=x.personnel_id
        if old!=p.id:
            if old:
                db.session.add(AssignmentHistory(personnel_id=old,asset_type="inventory",asset_id=x.id,action="unassign",note=data.get("note")))
            x.personnel_id=p.id
            db.session.add(AssignmentHistory(personnel_id=p.id,asset_type="inventory",asset_id=x.id,action="assign",note=data.get("note")))
        _audit("inventory.assigned","inventory",x.id,{"from_personnel_id":old,"to_personnel_id":p.id,"note":data.get("note")})
        db.session.commit()
        return jsonify(_inventory_dict(x))
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error":str(e)}),400
    except Exception:
        db.session.rollback()
        return jsonify({"error":"Envanter ataması yapılamadı"}),409

@api_bp.post("/inventory/<int:inventory_id>/mark-faulty")
@login_required
def mark_inventory_faulty(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    if x.status=="scrapped":return jsonify({"error":"Hurda durumundaki envanter arızalı olarak işaretlenemez"}),400
    try:
        old=x.status; x.status="faulty"; x.note=data.get("note",x.note); _audit("inventory.mark_faulty","inventory",x.id,{"from_status":old,"note":data.get("note")}); db.session.commit(); return jsonify(_inventory_dict(x))
    except Exception:
        db.session.rollback()
        return jsonify({"error":"Envanter arızalı olarak işaretlenemedi"}),409

@api_bp.post("/inventory/<int:inventory_id>/send-to-it")
@login_required
def send_inventory_to_it(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    if x.status=="scrapped":return jsonify({"error":"Hurda durumundaki envanter Bilgi İşleme alınamaz"}),400
    try:
        old=x.status; old_person=x.personnel_id
        if old_person:
            db.session.add(AssignmentHistory(personnel_id=old_person,asset_type="inventory",asset_id=x.id,action="unassign",note=data.get("note")))
        x.personnel_id=None; x.status="it"; x.note=data.get("note",x.note)
        _audit("inventory.sent_to_it","inventory",x.id,{"from_personnel_id":old_person,"from_status":old,"note":data.get("note")})
        db.session.commit()
        return jsonify(_inventory_dict(x))
    except Exception:
        db.session.rollback()
        return jsonify({"error":"Envanter Bilgi İşleme gönderilemedi"}),409

@api_bp.post("/inventory/<int:inventory_id>/scrap")
@login_required
def scrap_inventory(inventory_id):
    x=db.session.get(Inventory,inventory_id); data=request.get_json(silent=True) or {}; reason=str(data.get("reason","")).strip()
    if not x:return jsonify({"error":"Envanter kaydı bulunamadı"}),404
    if not reason:return jsonify({"error":"Hurda nedeni zorunludur"}),400
    if x.status=="scrapped":return jsonify({"error":"Envanter zaten hurda durumunda"}),400
    try:
        old=x.status; old_person=x.personnel_id
        if old_person:
            db.session.add(AssignmentHistory(personnel_id=old_person,asset_type="inventory",asset_id=x.id,action="unassign",note=reason))
        x.status="scrapped"; x.personnel_id=None
        db.session.add(ScrapRecord(source_type="inventory",source_id=x.id,reason=reason,note=data.get("note")))
        _audit("inventory.scrapped","inventory",x.id,{"from_status":old,"from_personnel_id":old_person,"reason":reason,"note":data.get("note")})
        db.session.commit()
        return jsonify(_inventory_dict(x))
    except Exception:
        db.session.rollback()
        return jsonify({"error":"Envanter hurdaya ayrılamadı"}),409

# -------------------- LICENSE API --------------------
def _license_effective_status(x):
    if x.status in ("scrapped", "it", "empty") or not x.expires_at:
        return x.status
    days=(x.expires_at-date.today()).days
    if days < 0:
        return "expired"
    if days <= 30:
        return "expiring"
    return x.status

def _license_dict(x):
    days=(x.expires_at-date.today()).days if x.expires_at else None
    return {"id":x.id,"barcode":x.barcode,"license_name":{"id":x.license_name_id,"name":x.license_name.name} if x.license_name else None,"license_model":{"id":x.license_model_id,"name":x.license_model.name,"license_name_id":x.license_model.license_name_id,"image_path":x.license_model.image_path} if x.license_model else None,"license_type":x.license_type,"starts_at":x.starts_at.isoformat() if x.starts_at else None,"license_key":x.license_key,"email":x.email,"has_password":bool(x.password),"expires_at":x.expires_at.isoformat() if x.expires_at else None,"expires_in_days":days,"note":x.note,"status":_license_effective_status(x),"stored_status":x.status,"inventory_id":x.inventory_id,"inventory":{"id":x.inventory.id,"inventory_no":x.inventory.inventory_no,"computer_name":x.inventory.computer_name} if x.inventory else None,"created_at":x.created_at.isoformat() if x.created_at else None,"updated_at":x.updated_at.isoformat() if x.updated_at else None}

LICENSE_STATUSES={"active","empty","it","scrapped"}

def _license_payload(data,x=None):
    name_value=data.get("license_name", x.license_name_id if x else None)
    if name_value in (None,""): raise ValueError("license_name alanı zorunludur")
    name=_resolve(LicenseName,name_value,"lisans adı")
    model_value=data.get("license_model_id", data.get("license_model", x.license_model_id if x else None))
    if model_value in (None,""): raise ValueError("license_model_id alanı zorunludur")
    model=_resolve(LicenseModel,model_value,"lisans modeli")
    if not name.active or not model.active: raise ValueError("Pasif lisans master kaydı kullanılamaz")
    if model.license_name_id!=name.id: raise ValueError("Lisans modeli, seçilen lisans adına bağlı değil")
    vals={"license_name_id":name.id,"license_model_id":model.id}
    for key in ("license_type","license_key","email","password","note","status","inventory_id"):
        if key in data: vals[key]=data[key] if data[key] not in ("",None) else None
    if x is None and "license_type" not in vals: vals["license_type"]="subscription"
    if "starts_at" in data:
        value=data["starts_at"]
        try: vals["starts_at"]=date.fromisoformat(value) if value else None
        except (TypeError,ValueError): raise ValueError("Geçersiz başlangıç tarihi")
    if "expires_at" in data:
        value=data["expires_at"]
        try: vals["expires_at"]=date.fromisoformat(value) if value else None
        except (TypeError,ValueError): raise ValueError("Geçersiz bitiş tarihi")
    if "inventory_id" in vals:
        inv_id=vals["inventory_id"]
        if inv_id in ("",None): vals["inventory_id"]=None
        else:
            inv=db.session.get(Inventory,int(inv_id))
            if not inv: raise ValueError("Envanter kaydı bulunamadı")
            if inv.status=="scrapped": raise ValueError("Hurda durumundaki envantere lisans bağlanamaz")
            vals["inventory_id"]=inv.id
    if vals.get("status") is not None:
        vals["status"]=str(vals["status"]).strip().lower()
        if vals["status"] not in LICENSE_STATUSES: raise ValueError("Geçersiz lisans durumu")
    starts=vals.get("starts_at", x.starts_at if x else None)
    expires=vals.get("expires_at", x.expires_at if x else None)
    if starts and expires and expires < starts: raise ValueError("Bitiş tarihi başlangıç tarihinden önce olamaz")
    return vals

@api_bp.get("/licenses")
@login_required
def list_licenses():
    q=License.query.options(joinedload(License.license_name),joinedload(License.license_model),joinedload(License.inventory),joinedload(License.personnel)).join(LicenseName).outerjoin(LicenseModel,License.license_model_id==LicenseModel.id); search=request.args.get("search","").strip(); status=request.args.get("status","").strip(); license_type=request.args.get("license_type","").strip(); expiry_status=request.args.get("expiry_status","").strip()
    if search:
        term=f"%{search}%"; q=q.filter(or_(LicenseName.name.ilike(term),LicenseModel.name.ilike(term),License.email.ilike(term),License.license_key.ilike(term)))
    license_name_id=request.args.get("license_name_id",type=int)
    license_model_id=request.args.get("license_model_id",type=int)
    if license_name_id:q=q.filter(License.license_name_id==license_name_id)
    if license_model_id:q=q.filter(License.license_model_id==license_model_id)
    inventory_id=request.args.get("inventory_id",type=int)
    if inventory_id:q=q.filter(License.inventory_id==inventory_id)
    if status:
        if status=="assigned": q=q.filter(License.status.notin_(("empty","it","scrapped")))
        elif status=="unassigned": q=q.filter(License.status.in_(("empty","it")))
        elif status=="scrapped": q=q.filter(License.status=="scrapped")
        else: q=q.filter(License.status==status)
    if license_type:q=q.filter(License.license_type==license_type)
    if expiry_status:
        if expiry_status=="timeless":
            q=q.filter(License.expires_at.is_(None))
        elif expiry_status=="active":
            q=q.filter(License.expires_at.is_not(None),License.expires_at>date.today()+timedelta(days=30))
        elif expiry_status=="expiring":
            q=q.filter(License.expires_at>=date.today(),License.expires_at<=date.today()+__import__("datetime").timedelta(days=30))
        elif expiry_status=="expired":
            q=q.filter(License.expires_at<date.today())
    page=max(request.args.get("page",1,type=int),1); per_page=min(max(request.args.get("per_page",25,type=int),1),100); p=q.order_by(License.id.desc()).paginate(page=page,per_page=per_page,error_out=False)
    return jsonify({"items":[_license_dict(x) for x in p.items],"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages}})

@api_bp.get("/licenses/expiry-summary")
@login_required
def license_expiry_summary():
    today = date.today()
    thirty = today + timedelta(days=30)
    total, empty, it_count, scrapped, expiring, expired, active, expiring_30 = db.session.query(
        func.count(License.id),
        func.count(License.id).filter(License.status == "empty"),
        func.count(License.id).filter(License.status == "it"),
        func.count(License.id).filter(License.status == "scrapped"),
        func.count(License.id).filter(
            License.status.notin_(("scrapped", "it", "empty")),
            License.expires_at.is_not(None),
            License.expires_at >= today,
            License.expires_at <= thirty,
        ),
        func.count(License.id).filter(
            License.status.notin_(("scrapped", "it", "empty")),
            License.expires_at.is_not(None),
            License.expires_at < today,
        ),
        func.count(License.id).filter(
            License.status.notin_(("scrapped", "it", "empty")),
            or_(License.expires_at.is_(None), License.expires_at > thirty),
        ),
        func.count(License.id).filter(
            License.status.notin_(("scrapped", "it", "empty")),
            License.expires_at.is_not(None),
            License.expires_at >= today,
            License.expires_at <= thirty,
        ),
    ).one()
    return jsonify({
        "total": int(total or 0),
        "active": int(active or 0),
        "empty": int(empty or 0),
        "expiring": int(expiring or 0),
        "expired": int(expired or 0),
        "it": int(it_count or 0),
        "scrapped": int(scrapped or 0),
        "expiring_30_days": int(expiring_30 or 0),
    })

@api_bp.get("/licenses/<int:license_id>")
@login_required
def get_license(license_id):
    x=License.query.options(joinedload(License.license_name),joinedload(License.license_model),joinedload(License.inventory),joinedload(License.personnel)).filter_by(id=license_id).first(); return jsonify(_license_dict(x)) if x else (jsonify({"error":"Lisans kaydı bulunamadı"}),404)

@api_bp.post("/licenses")
@login_required
def create_license():
    try:
        x=License(**_license_payload(request.get_json(silent=True) or {})); db.session.add(x); db.session.flush(); _audit("license.created","license",x.id,{"license_name_id":x.license_name_id,"license_model_id":x.license_model_id}); db.session.commit(); return jsonify(_license_dict(x)),201
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Lisans kaydı oluşturulamadı","detail":str(e)}),409

@api_bp.patch("/licenses/<int:license_id>")
@api_bp.put("/licenses/<int:license_id>")
@login_required
def update_license(license_id):
    x=db.session.get(License,license_id)
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    try:
        before=_license_dict(x); [setattr(x,k,v) for k,v in _license_payload(request.get_json(silent=True) or {},x).items()]; db.session.flush(); _audit("license.updated","license",x.id,{"before":before,"after":_license_dict(x)}); db.session.commit(); return jsonify(_license_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception as e: db.session.rollback(); return jsonify({"error":"Lisans güncellenemedi","detail":str(e)}),409

@api_bp.post("/licenses/<int:license_id>/assign-inventory")
@login_required
def assign_license_inventory(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    try:
        value=data.get("inventory_id")
        if value in (None,""): x.inventory_id=None
        else:
            inv=db.session.get(Inventory,int(value))
            if not inv: raise ValueError("Envanter kaydı bulunamadı")
            if inv.status=="scrapped": raise ValueError("Hurda durumundaki envantere lisans bağlanamaz")
            x.inventory_id=inv.id
        _audit("license.inventory_assigned","license",x.id,{"inventory_id":x.inventory_id,"note":data.get("note")})
        db.session.commit(); return jsonify(_license_dict(x))
    except (ValueError,TypeError) as e:
        db.session.rollback(); return jsonify({"error":str(e)}),400
    except Exception:
        db.session.rollback(); return jsonify({"error":"Lisans envantere bağlanamadı"}),409

@api_bp.post("/licenses/<int:license_id>/assign")
@login_required
def assign_license(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    try:
        p=_resolve(Personnel,data.get("personnel_id",data.get("person")),"personel")
        old=x.personnel_id
        if old != p.id:
            if old:
                db.session.add(AssignmentHistory(personnel_id=old,asset_type="license",asset_id=x.id,action="unassign",note=data.get("note")))
            x.personnel_id=p.id
            db.session.add(AssignmentHistory(personnel_id=p.id,asset_type="license",asset_id=x.id,action="assign",note=data.get("note")))
        _audit("license.assigned","license",x.id,{"from_personnel_id":old,"to_personnel_id":p.id,"note":data.get("note")})
        db.session.commit(); return jsonify(_license_dict(x))
    except ValueError as e: db.session.rollback(); return jsonify({"error":str(e)}),400

@api_bp.post("/licenses/<int:license_id>/send-to-it")
@login_required
def send_license_to_it(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    old=x.status; old_person=x.personnel_id
    if old_person:
        db.session.add(AssignmentHistory(personnel_id=old_person,asset_type="license",asset_id=x.id,action="unassign",note=data.get("note")))
    x.personnel_id=None; x.status="empty"; x.note=data.get("note",x.note)
    _audit("license.sent_to_it","license",x.id,{"from_status":old,"from_personnel_id":old_person,"note":data.get("note")})
    db.session.commit(); return jsonify(_license_dict(x))

@api_bp.post("/licenses/<int:license_id>/scrap")
@login_required
def scrap_license(license_id):
    x=db.session.get(License,license_id); data=request.get_json(silent=True) or {}; reason=str(data.get("reason","")).strip()
    if not x:return jsonify({"error":"Lisans kaydı bulunamadı"}),404
    if not reason:return jsonify({"error":"Hurda nedeni zorunludur"}),400
    if x.status=="scrapped": return jsonify({"error":"Lisans zaten hurda durumunda"}),400
    try:
        old=x.status; old_person=x.personnel_id
        if old_person:
            db.session.add(AssignmentHistory(personnel_id=old_person,asset_type="license",asset_id=x.id,action="unassign",note=reason))
        x.status="scrapped"; x.personnel_id=None
        db.session.add(ScrapRecord(source_type="license",source_id=x.id,reason=reason,note=data.get("note")))
        _audit("license.scrapped","license",x.id,{"from_status":old,"from_personnel_id":old_person,"reason":reason,"note":data.get("note")})
        db.session.commit(); return jsonify(_license_dict(x))
    except Exception:
        db.session.rollback(); return jsonify({"error":"Lisans hurdaya ayrılamadı"}),409
