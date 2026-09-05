import io, os, subprocess, tempfile
from urllib.parse import urlparse, unquote
from flask import Blueprint, jsonify, request, send_file, current_app
from ..extensions import db
from ..models import AuditLog
from .auth_routes import current_user, permission_required

data_bp=Blueprint("data",__name__)
def audit(action,details):
 u=current_user();db.session.add(AuditLog(action=action,entity_type="database",actor_user_id=u.id if u else None,details=details))
def pg_env():
 uri=current_app.config.get("SQLALCHEMY_DATABASE_URI","")
 if not uri.startswith("postgresql"):raise RuntimeError("PostgreSQL bağlantısı gerekli")
 return urlparse(uri.replace("postgresql+psycopg://","postgresql://",1))
def pg_args(p):return [p.hostname or "localhost",str(p.port or 5432),unquote(p.username or ""),unquote((p.path or "").lstrip("/"))]
@data_bp.get("/data/backup")
@permission_required("settings.manage")
def backup():
 try:
  p=pg_env();env=os.environ.copy();env["PGPASSWORD"]=unquote(p.password or "");h,port,u,d=pg_args(p);out=subprocess.run(["pg_dump","--format=custom","--no-owner","--no-privileges","-h",h,"-p",port,"-U",u,d],capture_output=True,check=True,env=env,timeout=300);audit("database.backup",{"format":"custom"});db.session.commit();return send_file(io.BytesIO(out.stdout),as_attachment=True,download_name="itmanager-backup.dump",mimetype="application/octet-stream")
 except Exception as exc:db.session.rollback();return jsonify({"error":"Backup alınamadı","detail":str(exc)}),500
@data_bp.post("/data/restore")
@permission_required("settings.manage")
def restore():
 if "file" not in request.files:return jsonify({"error":"Backup dosyası gerekli"}),400
 f=request.files["file"]
 if not f.filename or not f.filename.lower().endswith((".dump",".backup",".sql")):return jsonify({"error":"Sadece .dump, .backup veya .sql dosyaları kabul edilir"}),400
 if (request.form.get("confirm") or "").lower()!="restore":return jsonify({"error":"Güvenlik için confirm=restore gönderilmelidir"}),400
 try:
  p=pg_env();env=os.environ.copy();env["PGPASSWORD"]=unquote(p.password or "");h,port,u,d=pg_args(p);suffix=".sql" if f.filename.lower().endswith(".sql") else ".dump"
  with tempfile.NamedTemporaryFile(suffix=suffix,delete=False) as tmp:f.save(tmp.name);path=tmp.name
  try:
   args=["psql","-h",h,"-p",port,"-U",u,"-d",d,"-f",path] if suffix==".sql" else ["pg_restore","--clean","--if-exists","--no-owner","--no-privileges","-h",h,"-p",port,"-U",u,"-d",d,path];subprocess.run(args,capture_output=True,text=True,check=True,env=env,timeout=600)
  finally:os.unlink(path)
  audit("database.restore",{"filename":f.filename});db.session.commit();return jsonify({"message":"Veritabanı geri yüklendi"})
 except Exception as exc:db.session.rollback();return jsonify({"error":"Restore başarısız","detail":str(exc)}),500
