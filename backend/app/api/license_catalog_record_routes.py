from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import License, LicenseName, LicenseModel, AuditLog
from .auth_routes import current_user, login_required

license_catalog_record_bp = Blueprint("license_catalog_record", __name__)

def _resolve(model, value):
    if value in (None, ""): return None
    obj = db.session.get(model, int(value)) if str(value).isdigit() else model.query.filter(db.func.lower(model.name)==str(value).strip().lower()).first()
    if not obj or not obj.active: raise ValueError("Geçersiz lisans tanımı")
    return obj

def _dict(x):
    return {"id":x.id,"license_name":{"id":x.license_name_id,"name":x.license_name.name} if x.license_name else None,"license_model":{"id":x.license_model_id,"name":x.license_model.name,"license_name_id":x.license_model.license_name_id} if x.license_model else None,"license_type":x.license_type,"license_key":x.license_key,"email":x.email,"password":x.password,"expires_at":x.expires_at.isoformat() if x.expires_at else None,"note":x.note,"status":x.status}

@license_catalog_record_bp.get("/license-catalog/records")
@login_required
def list_records():
    q=License.query.join(LicenseName).outerjoin(LicenseModel,License.license_model_id==LicenseModel.id)
    search=request.args.get("search","").strip()
    if search:
        term=f"%{search}%";q=q.filter(or_(LicenseName.name.ilike(term),LicenseModel.name.ilike(term),License.email.ilike(term),License.license_key.ilike(term)))
    p=q.order_by(License.id.desc()).paginate(page=max(request.args.get("page",1,type=int),1),per_page=min(max(request.args.get("per_page",100,type=int),1),100),error_out=False)
    return jsonify({"items":[_dict(x) for x in p.items],"pagination":{"total":p.total,"pages":p.pages}})

@license_catalog_record_bp.post("/license-catalog/records")
@login_required
def create_record():
    data=request.get_json(silent=True) or {}
    try:
        name=_resolve(LicenseName,data.get("license_name"))
        model=_resolve(LicenseModel,data.get("license_model_id",data.get("license_model")))
        if not name: raise ValueError("Lisans adı zorunludur")
        if not model: raise ValueError("Lisans modeli zorunludur")
        if model.license_name_id!=name.id: raise ValueError("Lisans modeli, seçilen lisans adına bağlı değil")
        vals={"license_name_id":name.id,"license_model_id":model.id,"license_type":data.get("license_type") or "subscription","license_key":data.get("license_key") or None,"email":data.get("email") or None,"password":data.get("password") or None,"note":data.get("note") or None,"status":data.get("status") or "active"}
        if data.get("expires_at"):
            from datetime import date
            vals["expires_at"]=date.fromisoformat(data["expires_at"])
        x=License(**vals);db.session.add(x);db.session.flush();u=current_user();db.session.add(AuditLog(action="license_catalog_record.created",entity_type="license",entity_id=x.id,actor_user_id=u.id if u else None,details={"license_name_id":x.license_name_id,"license_model_id":x.license_model_id}));db.session.commit();return jsonify(_dict(x)),201
    except ValueError as e:db.session.rollback();return jsonify({"error":str(e)}),400
    except Exception as e:db.session.rollback();return jsonify({"error":"Lisans kaydı oluşturulamadı","detail":str(e)}),409
