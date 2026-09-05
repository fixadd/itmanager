import base64,hashlib
from flask import Blueprint,jsonify,request,current_app
from cryptography.fernet import Fernet
from ..extensions import db
from ..models import ConnectionSetting,AuditLog
from .auth_routes import current_user
connections_bp=Blueprint("connections",__name__)
def crypt():return Fernet(base64.urlsafe_b64encode(hashlib.sha256(str(current_app.config.get("SECRET_KEY","itmanager")).encode()).digest()))
def item(x):return {"id":x.id,"name":x.name,"kind":x.kind,"host":x.host,"port":x.port,"username":x.username,"active":x.active,"options":x.options or {},"has_secret":bool(x.secret_encrypted)}
def audit(action,x,details):
 u=current_user();db.session.add(AuditLog(action=action,entity_type="connection",entity_id=x.id,actor_user_id=u.id if u else None,details=details))
@connections_bp.get("/connections")
def list_connections():return jsonify({"items":[item(x) for x in ConnectionSetting.query.order_by(ConnectionSetting.name).all()]})
@connections_bp.post("/connections")
def create_connection():
 d=request.get_json(silent=True) or {};name=str(d.get("name") or "").strip();kind=str(d.get("kind") or "").strip().lower()
 if not name or not kind:return jsonify({"error":"name ve kind zorunludur"}),400
 if ConnectionSetting.query.filter(db.func.lower(ConnectionSetting.name)==name.lower()).first():return jsonify({"error":"connection_exists"}),409
 x=ConnectionSetting(name=name,kind=kind,host=d.get("host"),port=d.get("port") or None,username=d.get("username"),options=d.get("options") or {},active=bool(d.get("active",True)))
 if d.get("secret"):x.secret_encrypted=crypt().encrypt(str(d["secret"]).encode()).decode()
 db.session.add(x);db.session.flush();audit("connection.created",x,{"name":x.name,"kind":x.kind});db.session.commit();return jsonify(item(x)),201
@connections_bp.patch("/connections/<int:connection_id>")
def update_connection(connection_id):
 x=db.get_or_404(ConnectionSetting,connection_id);d=request.get_json(silent=True) or {}
 for f in ("name","kind","host","username","active","options"):
  if f in d:setattr(x,f,d[f])
 if "port" in d:x.port=d["port"] or None
 if d.get("secret") is not None:x.secret_encrypted=crypt().encrypt(str(d["secret"]).encode()).decode()
 audit("connection.updated",x,{"fields":sorted(d.keys())});db.session.commit();return jsonify(item(x))
@connections_bp.delete("/connections/<int:connection_id>")
def delete_connection(connection_id):
 x=db.get_or_404(ConnectionSetting,connection_id);audit("connection.deleted",x,{"name":x.name});db.session.delete(x);db.session.commit();return jsonify({"ok":True})
