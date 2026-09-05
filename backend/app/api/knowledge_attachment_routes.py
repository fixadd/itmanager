import os,uuid
from flask import Blueprint,jsonify,request,send_from_directory,current_app
from ..extensions import db
from ..models import AuditLog,KnowledgeArticle,KnowledgeAttachment
from .auth_routes import current_user
attachments_bp=Blueprint("knowledge_attachments",__name__)
ALLOWED={"pdf","png","jpg","jpeg","webp"};MAX_SIZE=20*1024*1024
def directory():p=os.path.join(current_app.instance_path,"knowledge_uploads");os.makedirs(p,exist_ok=True);return p
@attachments_bp.post("/knowledge/<int:article_id>/attachments")
def upload(article_id):
 a=db.get_or_404(KnowledgeArticle,article_id);f=request.files.get("file")
 if not f or not f.filename:return jsonify({"error":"Dosya gerekli"}),400
 ext=f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else ""
 if ext not in ALLOWED:return jsonify({"error":"Sadece PDF, PNG, JPG ve WEBP kabul edilir"}),400
 f.stream.seek(0,2);size=f.stream.tell();f.stream.seek(0)
 if size>MAX_SIZE:return jsonify({"error":"Dosya 20 MB sınırını aşamaz"}),400
 stored=f"{uuid.uuid4().hex}.{ext}";f.save(os.path.join(directory(),stored));x=KnowledgeAttachment(article_id=a.id,original_name=os.path.basename(f.filename)[:255],stored_name=stored,mime_type=f.mimetype or "application/octet-stream",size=size);db.session.add(x);u=current_user();db.session.add(AuditLog(action="knowledge.attachment_added",entity_type="knowledge_article",entity_id=a.id,actor_user_id=u.id if u else None,details={"attachment_id":x.id,"filename":x.original_name,"size":size}));db.session.commit();return jsonify({"id":x.id,"name":x.original_name,"mime_type":x.mime_type,"size":x.size}),201
@attachments_bp.get("/knowledge/<int:article_id>/attachments/<int:attachment_id>")
def download(article_id,attachment_id):
 a=db.get_or_404(KnowledgeArticle,article_id);x=db.get_or_404(KnowledgeAttachment,attachment_id)
 if x.article_id!=a.id:return jsonify({"error":"Dosya bulunamadı"}),404
 return send_from_directory(directory(),x.stored_name,as_attachment=False,download_name=x.original_name)
@attachments_bp.delete("/knowledge/<int:article_id>/attachments/<int:attachment_id>")
def remove(article_id,attachment_id):
 a=db.get_or_404(KnowledgeArticle,article_id);x=db.get_or_404(KnowledgeAttachment,attachment_id)
 if x.article_id!=a.id:return jsonify({"error":"Dosya bulunamadı"}),404
 path=os.path.join(directory(),x.stored_name)
 if os.path.exists(path):os.remove(path)
 db.session.delete(x);u=current_user();db.session.add(AuditLog(action="knowledge.attachment_deleted",entity_type="knowledge_article",entity_id=a.id,actor_user_id=u.id if u else None,details={"attachment_id":attachment_id}));db.session.commit();return jsonify({"ok":True})
