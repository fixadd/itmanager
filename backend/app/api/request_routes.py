from datetime import datetime,timezone
from uuid import uuid4
from flask import Blueprint,jsonify,request
from sqlalchemy import or_,text
from sqlalchemy.orm import joinedload, selectinload
from ..extensions import db
from ..models import AuditLog,Brand,Department,Factory,Inventory,License,LicenseModel,LicenseName,Personnel,ProductModel,ProductType,PurchaseRequest,PurchaseRequestItem,StockItem,StockMovement
from .auth_routes import current_user,login_required
requests_bp=Blueprint("requests",__name__)
STATUSES={"draft","pending","approved","rejected","ordered","completed","cancelled"};PRIORITIES={"low","normal","high","urgent"}
def _dt(v):
 if v in (None,""):return None
 if isinstance(v,datetime):return v
 try:return datetime.fromisoformat(str(v).replace("Z","+00:00"))
 except ValueError:raise ValueError("Geçersiz tarih formatı")
def _item_dict(x):return {"id":x.id,"product_type":x.product_type,"device_type":x.device_type,"brand":x.brand,"model":x.model,"quantity":float(x.quantity) if x.quantity is not None else 0,"received_quantity":float(x.received_quantity or 0),"unit":x.unit,"estimated_unit_price":float(x.estimated_unit_price) if x.estimated_unit_price is not None else None,"description":x.description}
def _dict(x):return {"id":x.id,"request_no":x.request_no,"requester":{"id":x.requester_id,"name":x.requester.name} if x.requester else None,"department":{"id":x.department_id,"name":x.department.name} if x.department else None,"factory":{"id":x.factory_id,"name":x.factory.name} if x.factory else None,"status":x.status,"priority":x.priority,"requested_at":x.requested_at.isoformat() if x.requested_at else None,"approved_at":x.approved_at.isoformat() if x.approved_at else None,"approved_by":x.approved_by,"completed_at":x.completed_at.isoformat() if x.completed_at else None,"note":x.note,"items":[_item_dict(i) for i in x.items],"created_at":x.created_at.isoformat() if x.created_at else None,"updated_at":x.updated_at.isoformat() if x.updated_at else None}
def _resolve(model,value,label):
 if value in (None,""):return None
 obj=db.session.get(model,int(value)) if str(value).isdigit() else model.query.filter(db.func.lower(model.name)==str(value).strip().lower()).first()
 if not obj:raise ValueError(f"Geçersiz {label}")
 return obj
def _audit(action,i,details=None):db.session.add(AuditLog(action=action,entity_type="purchase_request",entity_id=i,actor_user_id=(current_user().id if current_user() else None),details=details or {}))
def _payload(data,existing=None):
 u=current_user(); logged_person=u.personnel if u else None
 no=str(data.get("request_no",existing.request_no if existing else "")).strip()
 if existing is not None and not no:no=existing.request_no
 if not existing and not no:raise ValueError("IFS talep numarası zorunludur")
 status=str(data.get("status",existing.status if existing else "pending")).strip().lower();priority=str(data.get("priority",existing.priority if existing else "normal")).strip().lower()
 if status not in STATUSES:raise ValueError("Geçersiz talep durumu")
 if priority not in PRIORITIES:raise ValueError("Geçersiz öncelik")
 requester=logged_person if logged_person else _resolve(Personnel,data.get("requester_id",existing.requester_id if existing else None),"talep sahibi")
 department=_resolve(Department,data.get("department_id",existing.department_id if existing else (logged_person.department_id if logged_person else None)),"departman")
 factory=_resolve(Factory,data.get("factory_id",existing.factory_id if existing else None),"fabrika")
 raw_items=data.get("items");
 if existing is not None and raw_items is None:raw_items=[_item_dict(i) for i in existing.items]
 if not isinstance(raw_items,list) or not raw_items:raise ValueError("En az bir talep satırı eklenmelidir")
 items=[]
 for raw in raw_items:
  product_type=str(raw.get("product_type","")).strip()
  if product_type not in {"Envanter","Lisans","Stok"}:raise ValueError("Ürün tipi Envanter, Lisans veya Stok olmalıdır")
  try:q=float(raw.get("quantity",1))
  except (TypeError,ValueError):raise ValueError("Miktar geçersiz")
  if q<=0:raise ValueError("Miktar 0'dan büyük olmalıdır")
  items.append(PurchaseRequestItem(product_type=product_type,device_type=raw.get("device_type") or None,brand=raw.get("brand") or None,model=raw.get("model") or None,quantity=q,unit=raw.get("unit") or "Adet",estimated_unit_price=None,description=raw.get("description") or None))
 return {"request_no":no,"requester_id":requester.id if requester else None,"department_id":department.id if department else None,"factory_id":factory.id if factory else None,"status":status,"priority":priority,"requested_at":_dt(data.get("requested_at",existing.requested_at if existing else None)) or (existing.requested_at if existing else datetime.now(timezone.utc)),"approved_at":_dt(data.get("approved_at",existing.approved_at if existing else None)),"approved_by":data.get("approved_by",existing.approved_by if existing else None),"completed_at":_dt(data.get("completed_at",existing.completed_at if existing else None)),"note":data.get("note",existing.note if existing else None),"items":items}
@requests_bp.get("/requests")
@login_required
def list_requests():
 q=PurchaseRequest.query.options(joinedload(PurchaseRequest.requester),joinedload(PurchaseRequest.department),joinedload(PurchaseRequest.factory),selectinload(PurchaseRequest.items));search=request.args.get("search","").strip();status=request.args.get("status","").strip();priority=request.args.get("priority","").strip()
 if search:
  term=f"%{search}%";q=q.outerjoin(Personnel,PurchaseRequest.requester_id==Personnel.id).filter(or_(PurchaseRequest.request_no.ilike(term),Personnel.name.ilike(term)))
 if priority:q=q.filter(PurchaseRequest.priority==priority)
 status_rows=q.with_entities(PurchaseRequest.status,db.func.count(PurchaseRequest.id)).group_by(PurchaseRequest.status).all()
 status_counts={s:0 for s in STATUSES}
 for s,n in status_rows: status_counts[s]=int(n)
 if status:q=q.filter(PurchaseRequest.status==status)
 page=max(request.args.get("page",1,type=int),1);per_page=min(max(request.args.get("per_page",25,type=int),1),100);p=q.order_by(PurchaseRequest.id.desc()).paginate(page=page,per_page=per_page,error_out=False);return jsonify({"items":[_dict(x) for x in p.items],"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages},"status_counts":status_counts})
@requests_bp.get("/requests/<int:request_id>")
@login_required
def get_request(request_id):
 x=db.session.get(PurchaseRequest,request_id);return jsonify(_dict(x)) if x else (jsonify({"error":"Talep bulunamadı"}),404)
@requests_bp.post("/requests")
@login_required
def create_request():
 try:
  data=_payload(request.get_json(silent=True) or {});items=data.pop("items");x=PurchaseRequest(**data);x.items=items;db.session.add(x);db.session.flush()
  if x.request_no.startswith("TMP-"):
   x.request_no=f"SAT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{x.id:05d}"
  _audit("request.created",x.id,{"request_no":x.request_no,"item_count":len(items)});db.session.commit();return jsonify(_dict(x)),201
 except ValueError as e:db.session.rollback();return jsonify({"error":str(e)}),400
 except Exception as e:db.session.rollback();return jsonify({"error":"Talep oluşturulamadı","detail":str(e)}),409
@requests_bp.route("/requests/<int:request_id>", methods=["PATCH", "PUT"])
@login_required
def update_request(request_id):
 x=db.session.get(PurchaseRequest,request_id)
 if not x:return jsonify({"error":"Talep bulunamadı"}),404
 try:
  before=_dict(x);data=_payload(request.get_json(silent=True) or {},x);items=data.pop("items");[setattr(x,k,v) for k,v in data.items()];x.items=items;_audit("request.updated",x.id,{"before":before,"after":_dict(x)});db.session.commit();return jsonify(_dict(x))
 except ValueError as e:db.session.rollback();return jsonify({"error":str(e)}),400
 except Exception as e:db.session.rollback();return jsonify({"error":"Talep güncellenemedi","detail":str(e)}),409
def _set_status(request_id,status):
 x=db.session.get(PurchaseRequest,request_id);data=request.get_json(silent=True) or {}
 if not x:return jsonify({"error":"Talep bulunamadı"}),404
 allowed={"draft":{"pending","cancelled"},"pending":{"approved","rejected","cancelled"},"approved":{"ordered","cancelled"},"ordered":{"completed","cancelled"},"completed":set(),"rejected":set(),"cancelled":set()}
 if status not in allowed.get(x.status,set()):return jsonify({"error":f"Talep durumu {x.status} iken {status} yapılamaz"}),409
 old=x.status;x.status=status
 if status=="approved":x.approved_at=datetime.now(timezone.utc);x.approved_by=data.get("approved_by") or (current_user().username if current_user() else "Sistem")
 if status=="completed" and not x.completed_at:x.completed_at=datetime.now(timezone.utc)
 _audit(f"request.{status}",x.id,{"from_status":old,"note":data.get("note")});db.session.commit();return jsonify(_dict(x))
@requests_bp.get("/requests/transfer-options")
@login_required
def transfer_options():
 def scoped(scope, entity_type, model_cls):
  ids=db.session.execute(text("SELECT entity_id FROM product_catalog_scopes WHERE entity_type=:t AND scope=:s"),{"t":entity_type,"s":scope}).scalars().all()
  if not ids:return []
  query=model_cls.query
  if model_cls is Brand: query=query.options(selectinload(Brand.product_types))
  return query.filter(model_cls.active.is_(True),model_cls.id.in_(ids)).order_by(model_cls.name).all()
 inventory_types=scoped("inventory","type",ProductType)
 inventory_brands=scoped("inventory","brand",Brand)
 inventory_models=scoped("inventory","model",ProductModel)
 stock_types=scoped("stock","type",ProductType)
 stock_brands=scoped("stock","brand",Brand)
 stock_models=scoped("stock","model",ProductModel)
 def pack_types(rows): return [{"id":x.id,"name":x.name} for x in rows]
 def pack_brands(rows): return [{"id":x.id,"name":x.name,"product_type_ids":[t.id for t in x.product_types if t.active]} for x in rows]
 def pack_models(rows): return [{"id":x.id,"name":x.name,"brand_id":x.brand_id,"product_type_id":x.product_type_id} for x in rows]
 return jsonify({
  "factories":[{"id":x.id,"name":x.name} for x in Factory.query.filter_by(active=True).order_by(Factory.name).all()],
  "departments":[{"id":x.id,"name":x.name} for x in Department.query.filter_by(active=True).order_by(Department.name).all()],
  "personnel":[{"id":x.id,"name":x.name} for x in Personnel.query.filter_by(active=True).order_by(Personnel.name).all()],
  "inventory_hardware_types":pack_types(inventory_types),
  "inventory_brands":pack_brands(inventory_brands),
  "inventory_models":pack_models(inventory_models),
  "stock_hardware_types":pack_types(stock_types),
  "stock_brands":pack_brands(stock_brands),
  "stock_models":pack_models(stock_models),
  "license_names":[{"id":x.id,"name":x.name} for x in LicenseName.query.filter_by(active=True).order_by(LicenseName.name).all()],
  "license_models":[{"id":x.id,"name":x.name,"license_name_id":x.license_name_id} for x in LicenseModel.query.filter_by(active=True).order_by(LicenseModel.name).all()]
 })

def _transfer_missing(x,data):
 raw=data.get("items") if isinstance(data.get("items"),list) else []
 by_id={str(v.get("item_id")):v for v in raw if isinstance(v,dict) and v.get("item_id") is not None}
 result=[]
 for item in x.items:
  v=by_id.get(str(item.id),{})
  selected=bool(v.get("selected"))
  if not selected:
   result.append({"item_id":item.id,"product_type":item.product_type,"missing":[],"data":v,"selected":False})
   continue
  try: received=float(v.get("received_quantity",float(item.quantity or 0)-float(item.received_quantity or 0)))
  except (TypeError,ValueError): received=0
  missing=[]
  if received<=0: missing.append({"key":"received_quantity","label":"Gelen miktar"})
  remaining=max(0.0,float(item.quantity or 0)-float(item.received_quantity or 0))
  if received>(remaining+1e-9): missing.append({"key":"received_quantity","label":f"Gelen miktar kalan miktarı ({remaining:g}) aşamaz"})
  if remaining<=1e-9: missing.append({"key":"received_quantity","label":"Bu talep kalemi tamamen teslim alınmış"})
  if item.product_type=="Envanter":
   records=v.get("records") if isinstance(v.get("records"),list) else []
   if received <= 0 or not received.is_integer() or len(records)!=int(received): missing.append({"key":"records","label":"Her cihaz için envanter bilgileri"})
   for idx,rec in enumerate(records):
    for key,label in (("inventory_no","Envanter No"),("factory","Fabrika"),("department","Departman"),("device_type","Donanım Tipi"),("brand","Marka")):
     if not isinstance(rec,dict) or rec.get(key) in (None,""): missing.append({"key":f"records[{idx}].{key}","label":f"{idx+1}. cihaz {label}"})
  elif item.product_type=="Lisans":
   for key,label in (("license_name","Lisans Adı"),("license_model_id","Lisans Modeli")):
    if v.get(key) in (None,""): missing.append({"key":key,"label":label})
  else:
   for key,label in (("device_type","Donanım Tipi"),("brand","Marka")):
    if v.get(key) in (None,""): missing.append({"key":key,"label":label})
  result.append({"item_id":item.id,"product_type":item.product_type,"missing":missing,"data":v,"selected":True,"received_quantity":received})
 return result

@requests_bp.post("/requests/<int:request_id>/transfer")
@login_required
def transfer_request(request_id):
 x=PurchaseRequest.query.with_for_update().filter_by(id=request_id).first(); data=request.get_json(silent=True) or {}
 if not x:return jsonify({"error":"Talep bulunamadı"}),404
 missing=_transfer_missing(x,data)
 selected=[v for v in missing if v.get("selected")]
 if not selected:return jsonify({"error":"En az bir gelen talep kalemi seçmelisiniz","requires_input":True,"items":missing}),400
 if any(v["missing"] for v in selected):return jsonify({"error":"Aktarım için eksik bilgiler var","requires_input":True,"items":missing}),409
 by_id={str(v.get("item_id")):v for v in (data.get("items") or [])}; created=[]
 seen_inventory_nos=set()
 try:
  for item in x.items:
   v=by_id.get(str(item.id),{})
   if not v.get("selected"): continue
   received=float(v.get("received_quantity",float(item.quantity or 0)-float(item.received_quantity or 0)))
   if item.product_type=="Envanter":
    records=v.get("records") or []
    for rec in records:
     factory=_resolve(Factory,rec.get("factory") or x.factory_id,"fabrika"); department=_resolve(Department,rec.get("department") or x.department_id,"departman"); ptype=_resolve(ProductType,rec.get("device_type") or item.device_type,"donanım tipi"); brand=_resolve(Brand,rec.get("brand") or item.brand,"marka"); model=None
     if not all(obj.active for obj in (factory,department,ptype,brand)): raise ValueError("Aktarımda pasif master kayıt kullanılamaz")
     if ptype not in brand.product_types: raise ValueError("Envanter marka, donanım tipiyle eşleşmiyor")
     if rec.get("model") or item.model:
      model=_resolve(ProductModel,rec.get("model") or item.model,"model")
      if not model.active: raise ValueError("Aktarımda pasif model kullanılamaz")
      if model.brand_id!=brand.id or (model.product_type_id and model.product_type_id!=ptype.id):raise ValueError("Envanter model, marka/donanım tipiyle eşleşmiyor")
     person=_resolve(Personnel,rec.get("person"),"personel") if rec.get("person") not in (None,"") else None
     if person and not person.active: raise ValueError("Aktarımda pasif personel kullanılamaz")
     inventory_no=str(rec.get("inventory_no") or "").strip()
     if not inventory_no: raise ValueError("Envanter No alanı zorunludur")
     inventory_key=inventory_no.casefold()
     if inventory_key in seen_inventory_nos or db.session.query(Inventory.id).filter(db.func.lower(Inventory.inventory_no)==inventory_key).first():
      raise ValueError(f"Envanter No zaten kullanılıyor: {inventory_no}")
     seen_inventory_nos.add(inventory_key)
     obj=Inventory(inventory_no=inventory_no,computer_name=rec.get("computer_name") or None,serial_no=rec.get("serial_no") or None,machine_no=rec.get("machine_no") or None,ifs_no=rec.get("ifs_no") or None,note=rec.get("note") or item.description or None,factory_id=factory.id,department_id=department.id,product_type_id=ptype.id,brand_id=brand.id,model_id=model.id if model else None,personnel_id=person.id if person else None)
     db.session.add(obj);db.session.flush();created.append({"item_id":item.id,"type":"Envanter","id":obj.id})
   elif item.product_type=="Lisans":
    name=_resolve(LicenseName,v.get("license_name"),"lisans adı"); model=_resolve(LicenseModel,v.get("license_model_id") or v.get("license_model"),"lisans modeli")
    if not name.active or not model.active: raise ValueError("Aktarımda pasif lisans master kaydı kullanılamaz")
    if model.license_name_id!=name.id:raise ValueError("Lisans modeli seçilen lisans adına bağlı değil")
    starts=_dt(v.get("starts_at")).date() if v.get("starts_at") else None; expires=_dt(v.get("expires_at")).date() if v.get("expires_at") else None
    if starts and expires and expires < starts: raise ValueError("Lisans bitiş tarihi başlangıç tarihinden önce olamaz")
    person=_resolve(Personnel,v.get("person"),"personel") if v.get("person") not in (None,"") else None
    if person and not person.active: raise ValueError("Aktarımda pasif personel kullanılamaz")
    for _ in range(int(received)):
     obj=License(license_name_id=name.id,license_model_id=model.id,license_type=v.get("license_type") or "subscription",license_key=v.get("license_key") or None,email=v.get("email") or None,password=v.get("password") or None,starts_at=starts,expires_at=expires,note=v.get("note") or item.description or None,status="active",personnel_id=person.id if person else None)
     db.session.add(obj);db.session.flush();created.append({"item_id":item.id,"type":"Lisans","id":obj.id})
   else:
    ptype=_resolve(ProductType,v.get("device_type") or item.device_type,"donanım tipi"); brand=_resolve(Brand,v.get("brand") or item.brand,"marka"); model=None
    if not ptype.active or not brand.active: raise ValueError("Aktarımda pasif master kayıt kullanılamaz")
    if ptype not in brand.product_types: raise ValueError("Stok marka, donanım tipiyle eşleşmiyor")
    if v.get("model") or item.model:
     model=_resolve(ProductModel,v.get("model") or item.model,"model")
     if not model.active: raise ValueError("Aktarımda pasif model kullanılamaz")
     if model.brand_id!=brand.id or (model.product_type_id and model.product_type_id!=ptype.id):raise ValueError("Stok model, marka/donanım tipiyle eşleşmiyor")
    q=received
    unit=v.get("unit") or item.unit or "Adet"
    obj=StockItem.query.filter_by(product_type_id=ptype.id,brand_id=brand.id,model_id=model.id if model else None,unit=unit).filter(StockItem.status!="scrapped").order_by(StockItem.id.asc()).first()
    merged_into_existing=bool(obj)
    if obj:
     obj.quantity=(obj.quantity or 0)+q
     if v.get("note") or item.description: obj.note=v.get("note") or item.description
     db.session.add(StockMovement(stock_item_id=obj.id,movement_type="in",quantity=q,unit=obj.unit,note=f"Satın alma talebi {x.request_no}"))
    else:
     obj=StockItem(product_type_id=ptype.id,brand_id=brand.id,model_id=model.id if model else None,quantity=q,unit=unit,note=v.get("note") or item.description or None)
     db.session.add(obj);db.session.flush();db.session.add(StockMovement(stock_item_id=obj.id,movement_type="in",quantity=q,unit=obj.unit,note=f"Satın alma talebi {x.request_no}"))
    created.append({"item_id":item.id,"type":"Stok","id":obj.id,"merged_into_existing":merged_into_existing})
  for item in x.items:
   v=by_id.get(str(item.id),{})
   if v.get("selected"):
    received=float(v.get("received_quantity",0) or 0)
    item.received_quantity=(item.received_quantity or 0)+received
  # Tüm talep kalemleri tamamen teslim alındıysa talebi otomatik tamamla.
  all_received=all(float(item.received_quantity or 0) >= float(item.quantity or 0) - 1e-9 for item in x.items)
  if all_received and x.status not in {"completed","cancelled","rejected"}:
   old_status=x.status
   x.status="completed"
   if not x.completed_at:x.completed_at=datetime.now(timezone.utc)
   _audit("request.completed",x.id,{"from_status":old_status,"reason":"Tüm talep kalemleri teslim alındı"})
  _audit("request.transferred",x.id,{"request_no":x.request_no,"targets":created});db.session.commit();return jsonify({"request_id":x.id,"request_no":x.request_no,"status":x.status,"transferred":created})
 except ValueError as e:db.session.rollback();return jsonify({"error":str(e)}),400
 except Exception as e:db.session.rollback();return jsonify({"error":"Talep aktarımı başarısız","detail":str(e)}),409

@requests_bp.post("/requests/<int:request_id>/approve")
@login_required
def approve(request_id):return _set_status(request_id,"approved")
@requests_bp.post("/requests/<int:request_id>/reject")
@login_required
def reject(request_id):return _set_status(request_id,"rejected")
@requests_bp.post("/requests/<int:request_id>/order")
@login_required
def order(request_id):return _set_status(request_id,"ordered")
@requests_bp.post("/requests/<int:request_id>/complete")
@login_required
def complete(request_id):return _set_status(request_id,"completed")
@requests_bp.post("/requests/<int:request_id>/cancel")
@login_required
def cancel(request_id):return _set_status(request_id,"cancelled")
