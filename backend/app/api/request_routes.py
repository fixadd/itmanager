from datetime import datetime,timezone
from flask import Blueprint,jsonify,request
from sqlalchemy import or_
from ..extensions import db
from ..models import AuditLog,Department,Factory,Personnel,PurchaseRequest,PurchaseRequestItem
from .auth_routes import current_user
requests_bp=Blueprint("requests",__name__)
STATUSES={"draft","pending","approved","rejected","ordered","completed","cancelled"};PRIORITIES={"low","normal","high","urgent"}
def _dt(v):
 if v in (None,""):return None
 if isinstance(v,datetime):return v
 try:return datetime.fromisoformat(str(v).replace("Z","+00:00"))
 except ValueError:raise ValueError("Geçersiz tarih formatı")
def _item_dict(x):return {"id":x.id,"product_type":x.product_type,"device_type":x.device_type,"brand":x.brand,"model":x.model,"quantity":float(x.quantity) if x.quantity is not None else 0,"unit":x.unit,"estimated_unit_price":float(x.estimated_unit_price) if x.estimated_unit_price is not None else None,"description":x.description}
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
 if not no:raise ValueError("Sipariş/Talep numarası zorunludur")
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
def list_requests():
 q=PurchaseRequest.query;search=request.args.get("search","").strip();status=request.args.get("status","").strip();priority=request.args.get("priority","").strip()
 if search:
  term=f"%{search}%";q=q.outerjoin(Personnel,PurchaseRequest.requester_id==Personnel.id).filter(or_(PurchaseRequest.request_no.ilike(term),Personnel.name.ilike(term)))
 if status:q=q.filter(PurchaseRequest.status==status)
 if priority:q=q.filter(PurchaseRequest.priority==priority)
 page=max(request.args.get("page",1,type=int),1);per_page=min(max(request.args.get("per_page",25,type=int),1),100);p=q.order_by(PurchaseRequest.id.desc()).paginate(page=page,per_page=per_page,error_out=False);return jsonify({"items":[_dict(x) for x in p.items],"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages}})
@requests_bp.get("/requests/<int:request_id>")
def get_request(request_id):
 x=db.session.get(PurchaseRequest,request_id);return jsonify(_dict(x)) if x else (jsonify({"error":"Talep bulunamadı"}),404)
@requests_bp.post("/requests")
def create_request():
 try:
  data=_payload(request.get_json(silent=True) or {});items=data.pop("items");x=PurchaseRequest(**data);x.items=items;db.session.add(x);db.session.flush();_audit("request.created",x.id,{"request_no":x.request_no,"item_count":len(items)});db.session.commit();return jsonify(_dict(x)),201
 except ValueError as e:db.session.rollback();return jsonify({"error":str(e)}),400
 except Exception as e:db.session.rollback();return jsonify({"error":"Talep oluşturulamadı","detail":str(e)}),409
@requests_bp.patch("/requests/<int:request_id>")
@requests_bp.put("/requests/<int:request_id>")
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
 old=x.status;x.status=status
 if status=="approved":x.approved_at=datetime.now(timezone.utc);x.approved_by=data.get("approved_by") or (current_user().username if current_user() else "Sistem")
 if status=="completed" and not x.completed_at:x.completed_at=datetime.now(timezone.utc)
 _audit(f"request.{status}",x.id,{"from_status":old,"note":data.get("note")});db.session.commit();return jsonify(_dict(x))
@requests_bp.post("/requests/<int:request_id>/approve")
def approve(request_id):return _set_status(request_id,"approved")
@requests_bp.post("/requests/<int:request_id>/reject")
def reject(request_id):return _set_status(request_id,"rejected")
@requests_bp.post("/requests/<int:request_id>/order")
def order(request_id):return _set_status(request_id,"ordered")
@requests_bp.post("/requests/<int:request_id>/complete")
def complete(request_id):return _set_status(request_id,"completed")
@requests_bp.post("/requests/<int:request_id>/cancel")
def cancel(request_id):return _set_status(request_id,"cancelled")
