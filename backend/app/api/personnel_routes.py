from sqlalchemy import or_,func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from flask import Blueprint,jsonify,request
from ..extensions import db
from ..models import AccessSystem,PersonnelSystemAccess,Personnel,Department,Inventory,License,AssignmentHistory,StockMovement,StockItem,AuditLog,User
from .auth_routes import current_user,login_required
personnel_bp=Blueprint("personnel",__name__)
def person_json(p):return {"id":p.id,"employee_no":p.employee_no,"name":p.name,"email":p.email,"active":p.active,"department":{"id":p.department.id,"name":p.department.name} if p.department else None}
def asset_json(p):
 inventory=Inventory.query.options(joinedload(Inventory.product_type),joinedload(Inventory.brand),joinedload(Inventory.model)).filter_by(personnel_id=p.id).order_by(Inventory.id.desc()).all();licenses=License.query.options(joinedload(License.license_name),joinedload(License.license_model)).filter_by(personnel_id=p.id).order_by(License.id.desc()).all();stock=StockMovement.query.options(joinedload(StockMovement.stock_item).joinedload(StockItem.product_type),joinedload(StockMovement.stock_item).joinedload(StockItem.brand),joinedload(StockMovement.stock_item).joinedload(StockItem.model)).filter_by(personnel_id=p.id).order_by(StockMovement.id.desc()).all()
 stock_ids={m.stock_item_id for m in stock if m.movement_type=="out"}
 assignment_logs=AuditLog.query.filter(AuditLog.action=="stock.assigned",AuditLog.entity_type=="stock",AuditLog.entity_id.in_(stock_ids)).order_by(AuditLog.created_at.desc()).all() if stock_ids else []
 assignment_users={u.id:u for u in User.query.options(joinedload(User.personnel)).filter(User.id.in_({a.actor_user_id for a in assignment_logs if a.actor_user_id})).all()} if assignment_logs else {}
 stock_json=[]
 for m in stock:
  actor=None
  if m.movement_type=="out":
   matches=[a for a in assignment_logs if a.entity_id==m.stock_item_id and (a.details or {}).get("to_personnel_id")==m.personnel_id and float((a.details or {}).get("quantity",0) or 0)==float(m.quantity) and (a.details or {}).get("note")==m.note]
   if matches:
    audit_row=min(matches,key=lambda a:abs((a.created_at-m.created_at).total_seconds()))
    user=assignment_users.get(audit_row.actor_user_id)
    actor=(user.personnel.name if user and user.personnel else user.username) if user else None
  stock_json.append({"id":m.id,"stock_item_id":m.stock_item_id,"barcode":m.stock_item.barcode if m.stock_item else None,"product_type":m.stock_item.product_type.name if m.stock_item and m.stock_item.product_type else None,"brand":m.stock_item.brand.name if m.stock_item and m.stock_item.brand else None,"model":m.stock_item.model.name if m.stock_item and m.stock_item.model else None,"movement_type":m.movement_type,"quantity":float(m.quantity),"unit":m.unit,"note":m.note,"assigned_by":actor,"created_at":m.created_at.isoformat()})
 return {"inventory":[{"id":x.id,"inventory_no":x.inventory_no,"computer_name":x.computer_name,"serial_no":x.serial_no,"status":x.status,"type":x.product_type.name if x.product_type else None,"brand":x.brand.name if x.brand else None,"model":x.model.name if x.model else None} for x in inventory],"licenses":[{"id":x.id,"name":x.license_name.name if x.license_name else None,"model":x.license_model.name if x.license_model else None,"license_model_id":x.license_model_id,"expires_at":x.expires_at.isoformat() if x.expires_at else None} for x in licenses],"stock_movements":stock_json}
def audit(action,entity_type,entity_id,details=None):
 u=current_user();db.session.add(AuditLog(action=action,entity_type=entity_type,entity_id=entity_id,actor_user_id=u.id if u else None,details=details or {}))
@personnel_bp.get("/personnel")
@login_required
def list_personnel():
 q=(request.args.get("q") or "").strip();status=request.args.get("status");query=Personnel.query
 if q:
  like=f"%{q}%";query=query.filter(or_(Personnel.name.ilike(like),Personnel.employee_no.ilike(like),Personnel.email.ilike(like)))
 if status in ("active","inactive"):query=query.filter_by(active=status=="active")
 department_id=request.args.get("department_id",type=int)
 if department_id:query=query.filter(Personnel.department_id==department_id)
 page=max(request.args.get("page",1,type=int),1);per_page=min(max(request.args.get("per_page",100,type=int),1),100)
 p=query.order_by(Personnel.name.asc()).paginate(page=page,per_page=per_page,error_out=False)
 items=[]
 ids=[x.id for x in p.items]
 inventory_counts={k:int(v) for k,v in db.session.query(Inventory.personnel_id,func.count(Inventory.id)).filter(Inventory.personnel_id.in_(ids)).group_by(Inventory.personnel_id).all()} if ids else {}
 license_counts={k:int(v) for k,v in db.session.query(License.personnel_id,func.count(License.id)).filter(License.personnel_id.in_(ids)).group_by(License.personnel_id).all()} if ids else {}
 for x in p.items:
  items.append(person_json(x)|{"asset_count":inventory_counts.get(x.id,0)+license_counts.get(x.id,0)})
 return jsonify({"items":items,"pagination":{"page":page,"per_page":per_page,"total":p.total,"pages":p.pages},"total":p.total})
@personnel_bp.get("/personnel/<int:person_id>")
@login_required
def get_personnel(person_id):
 p=db.get_or_404(Personnel,person_id);data=person_json(p);data["assets"]=asset_json(p);data["history"]= [{"id":h.id,"asset_type":h.asset_type,"asset_id":h.asset_id,"action":h.action,"note":h.note,"created_at":h.created_at.isoformat()} for h in AssignmentHistory.query.filter_by(personnel_id=p.id).order_by(AssignmentHistory.id.desc()).all()];return jsonify(data)
@personnel_bp.post("/personnel")
@login_required
def create_personnel():
 data=request.get_json(silent=True) or {};name=str(data.get("name") or "").strip()
 if not name:return jsonify({"error":"Personel adı zorunludur."}),400
 department_id=data.get("department_id") or None
 if department_id:
  department=db.session.get(Department,int(department_id))
  if not department or not department.active:return jsonify({"error":"Geçerli ve aktif bir departman seçilmelidir."}),400
 p=Personnel(employee_no=str(data.get("employee_no") or "").strip() or None,name=name,email=str(data.get("email") or "").strip() or None,department_id=department_id,active=bool(data.get("active",True)))
 db.session.add(p)
 try:
  db.session.flush();audit("personnel.created","personnel",p.id,{"name":p.name});db.session.commit();return jsonify(person_json(p)),201
 except IntegrityError:
  db.session.rollback();return jsonify({"error":"Personel numarası zaten kayıtlı."}),409
 except Exception as exc:
  db.session.rollback();return jsonify({"error":"Personel kaydı oluşturulamadı","detail":str(exc)}),409
@personnel_bp.route("/personnel/<int:person_id>",methods=["PATCH","PUT"])
@login_required
def update_personnel(person_id):
 p=db.get_or_404(Personnel,person_id);data=request.get_json(silent=True) or {}
 if "name" in data:
  name=str(data["name"] or "").strip()
  if not name:return jsonify({"error":"Personel adı zorunludur."}),400
  p.name=name
 if "department_id" in data:
  department_id=data.get("department_id") or None
  if department_id:
   department=db.session.get(Department,int(department_id))
   if not department or not department.active:return jsonify({"error":"Geçerli ve aktif bir departman seçilmelidir."}),400
  p.department_id=department_id
 for key in ("employee_no","email","active"):
  if key in data:
   value=data[key]
   if key=="employee_no":value=str(value or "").strip() or None
   if key=="email":value=str(value or "").strip() or None
   setattr(p,key,value)
 try:
  db.session.flush();audit("personnel.updated","personnel",p.id,{"fields":sorted(data.keys())});db.session.commit();return jsonify(person_json(p))
 except IntegrityError:
  db.session.rollback();return jsonify({"error":"Personel numarası zaten kayıtlı."}),409
 except Exception as exc:
  db.session.rollback();return jsonify({"error":"Personel güncellenemedi","detail":str(exc)}),409
@personnel_bp.post("/personnel/<int:person_id>/toggle")
@login_required
def toggle_personnel(person_id):
 p=db.get_or_404(Personnel,person_id);p.active=not p.active;audit("personnel.status_changed","personnel",p.id,{"active":p.active});db.session.commit();return jsonify(person_json(p))
@personnel_bp.get("/personnel/<int:person_id>/assets")
@login_required
def personnel_assets(person_id):db.get_or_404(Personnel,person_id);return jsonify(asset_json(Personnel.query.get(person_id)))
@personnel_bp.post("/personnel/<int:person_id>/transfer")
@login_required
def transfer_assets(person_id):
 source=db.get_or_404(Personnel,person_id);data=request.get_json(silent=True) or {};target=db.session.get(Personnel,int(data.get("target_personnel_id"))) if data.get("target_personnel_id") else None
 if not target or not target.active:return jsonify({"error":"Geçerli hedef personel seçilmelidir"}),400
 if target.id==source.id:return jsonify({"error":"Kaynak personel ile hedef personel aynı olamaz"}),400
 assets=data.get("assets") or [];note=str(data.get("note") or "").strip() or None
 if not isinstance(assets,list) or not assets:return jsonify({"error":"En az bir varlık seçilmelidir"}),400
 moved=[]
 try:
  for a in assets:
   typ=str(a.get("asset_type") or "");aid=int(a.get("asset_id"))
   if typ=="inventory":obj=db.session.get(Inventory,aid);field="personnel_id"
   elif typ=="license":obj=db.session.get(License,aid);field="personnel_id"
   else:continue
   if not obj or getattr(obj,field)!=source.id:continue
   setattr(obj,field,target.id);db.session.add(AssignmentHistory(personnel_id=source.id,asset_type=typ,asset_id=aid,action="transfer_out",note=note));db.session.add(AssignmentHistory(personnel_id=target.id,asset_type=typ,asset_id=aid,action="transfer_in",note=note));moved.append({"asset_type":typ,"asset_id":aid})
  if not moved:return jsonify({"error":"Seçilen varlıkların hiçbiri kaynak personele atanmış değil"}),400
  audit("personnel.assets_transferred","personnel",source.id,{"from":source.id,"to":target.id,"assets":moved,"note":note});db.session.commit();return jsonify({"message":"Varlıklar devredildi","moved":moved})
 except Exception as exc:db.session.rollback();return jsonify({"error":"Devir başarısız","detail":str(exc)}),409


@personnel_bp.get("/personnel/<int:person_id>/systems")
@login_required
def list_personnel_systems(person_id):
    db.get_or_404(Personnel, person_id)
    rows = (PersonnelSystemAccess.query
            .join(AccessSystem, PersonnelSystemAccess.system_id == AccessSystem.id)
            .filter(PersonnelSystemAccess.personnel_id == person_id)
            .order_by(AccessSystem.name.asc()).all())
    return jsonify({"items": [{
        "id": row.id,
        "system_id": row.system_id,
        "name": row.system.name,
        "system_active": row.system.active,
        "has_access": row.has_access,
        "note": row.note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    } for row in rows]})


@personnel_bp.post("/personnel/<int:person_id>/systems")
@login_required
def add_personnel_system(person_id):
    person = db.get_or_404(Personnel, person_id)
    data = request.get_json(silent=True) or {}
    try:
        system_id = int(data.get("system_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "Geçerli bir sistem seçilmelidir."}), 400
    system = db.session.get(AccessSystem, system_id)
    if not system or not system.active:
        return jsonify({"error": "Aktif sistem tanımı bulunamadı."}), 404
    row = PersonnelSystemAccess.query.filter_by(personnel_id=person.id, system_id=system.id).first()
    created = row is None
    if row is None:
        row = PersonnelSystemAccess(personnel_id=person.id, system_id=system.id, has_access=True)
        db.session.add(row)
    else:
        row.has_access = True
    if "note" in data:
        row.note = str(data.get("note") or "").strip()[:500] or None
    try:
        db.session.flush()
        audit("personnel.system_access_added" if created else "personnel.system_access_reenabled",
              "personnel_system_access", row.id,
              {"personnel_id": person.id, "system_id": system.id, "system_name": system.name})
        db.session.commit()
        return jsonify({"id": row.id, "system_id": system.id, "name": system.name,
                        "system_active": system.active, "has_access": row.has_access,
                        "note": row.note, "created_at": row.created_at.isoformat(),
                        "updated_at": row.updated_at.isoformat()}), 201 if created else 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Bu sistem personele zaten eklenmiş."}), 409


@personnel_bp.patch("/personnel/<int:person_id>/systems/<int:assignment_id>")
@login_required
def update_personnel_system(person_id, assignment_id):
    person = db.get_or_404(Personnel, person_id)
    row = db.get_or_404(PersonnelSystemAccess, assignment_id)
    if row.personnel_id != person.id:
        return jsonify({"error": "Sistem kaydı bu personele ait değil."}), 404
    data = request.get_json(silent=True) or {}
    if "has_access" in data:
        if not isinstance(data["has_access"], bool):
            return jsonify({"error": "Erişim durumu true veya false olmalıdır."}), 400
        row.has_access = data["has_access"]
    if "note" in data:
        row.note = str(data.get("note") or "").strip()[:500] or None
    audit("personnel.system_access_changed", "personnel_system_access", row.id,
          {"personnel_id": person.id, "system_id": row.system_id,
           "system_name": row.system.name, "has_access": row.has_access})
    db.session.commit()
    return jsonify({"id": row.id, "system_id": row.system_id, "name": row.system.name,
                    "system_active": row.system.active, "has_access": row.has_access,
                    "note": row.note, "updated_at": row.updated_at.isoformat() if row.updated_at else None})


@personnel_bp.delete("/personnel/<int:person_id>/systems/<int:assignment_id>")
@login_required
def remove_personnel_system(person_id, assignment_id):
    person = db.get_or_404(Personnel, person_id)
    row = db.get_or_404(PersonnelSystemAccess, assignment_id)
    if row.personnel_id != person.id:
        return jsonify({"error": "Sistem kaydı bu personele ait değil."}), 404
    audit("personnel.system_access_removed", "personnel_system_access", row.id,
          {"personnel_id": person.id, "system_id": row.system_id, "system_name": row.system.name})
    db.session.delete(row)
    db.session.commit()
    return jsonify({"success": True})
