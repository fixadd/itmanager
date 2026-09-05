import os
from flask import Flask,jsonify,request,session
from .config import Config
from .extensions import db,migrate
from .models import User
from .api import api_bp,stock_bp
from .api.auth_routes import auth_bp,current_user
from .api.maintenance_routes import maintenance_bp
from .api.request_routes import requests_bp
from .api.personnel_routes import personnel_bp
from .api.knowledge_routes import knowledge_bp
from .api.scrap_routes import scrap_bp
from .api.report_routes import reports_bp
from .api.settings_routes import settings_bp
from .api.log_routes import logs_bp
from .api.license_owner_routes import license_owner_bp
from .api.data_routes import data_bp

def create_app(config_class=Config):
 app=Flask(__name__);app.config.from_object(config_class);db.init_app(app);migrate.init_app(app,db,compare_type=True)
 for bp in (api_bp,stock_bp,auth_bp,maintenance_bp,requests_bp,personnel_bp,knowledge_bp,scrap_bp,reports_bp,settings_bp,logs_bp,license_owner_bp,data_bp):app.register_blueprint(bp,url_prefix="/api")
 @app.before_request
 def require_api_authentication():
  if not request.path.startswith('/api/') or request.path in {'/api/auth/login','/api/health/db'} or request.method=='OPTIONS':return None
  user=current_user()
  if user is None and os.getenv('AUTH_DISABLED','false').lower()=='true':
   user=User.query.filter_by(username=os.getenv('ADMIN_USERNAME','admin'),active=True).first()
   if user:session['user_id']=user.id
  if user is None:return jsonify({'error':'authentication_required'}),401
  method=request.method.upper();path=request.path;permission=None
  if path.startswith('/api/inventory') and method in {'POST','PUT','PATCH','DELETE'}:permission='inventory.manage'
  elif path.startswith('/api/licenses') and method in {'POST','PUT','PATCH','DELETE'}:permission='licenses.manage'
  elif path.startswith('/api/license-owners') and method in {'POST','PUT','PATCH','DELETE'}:permission='licenses.manage'
  elif path.startswith('/api/stock') and method in {'POST','PUT','PATCH','DELETE'}:permission='stock.manage'
  elif path.startswith('/api/maintenance') and method in {'POST','PUT','PATCH','DELETE'}:permission='maintenance.manage'
  elif path.startswith('/api/requests') and method in {'POST','PUT','PATCH','DELETE'}:permission='requests.manage'
  elif path.startswith('/api/personnel') and method in {'POST','PUT','PATCH','DELETE'}:permission='people.manage'
  elif path.startswith('/api/knowledge') and method in {'POST','PUT','PATCH','DELETE'}:permission='knowledge.manage'
  elif path.startswith('/api/scrap') and method in {'POST','PUT','PATCH','DELETE'}:permission='scrap.manage'
  elif path.startswith('/api/reports'):permission='reports.view'
  elif path.startswith('/api/settings') or path.startswith('/api/data'):permission='settings.manage'
  if permission and not user.has_permission(permission):return jsonify({'error':'forbidden','permission':permission}),403
 @app.get('/health')
 def health():return jsonify({'status':'ok','service':'itmanager-api'})
 @app.get('/api/health/db')
 def db_health():
  from sqlalchemy import text
  try:db.session.execute(text('SELECT 1'));return jsonify({'status':'ok','database':'postgresql'})
  except Exception as exc:db.session.rollback();return jsonify({'status':'error','database':'postgresql','detail':str(exc)}),503
 return app
