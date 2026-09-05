from datetime import datetime, timezone
from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Factory(TimestampMixin, db.Model):
    __tablename__ = "factories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Department(TimestampMixin, db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Personnel(TimestampMixin, db.Model):
    __tablename__ = "personnel"
    id = db.Column(db.Integer, primary_key=True)
    employee_no = db.Column(db.String(50), unique=True)
    name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(255))
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"))
    active = db.Column(db.Boolean, default=True, nullable=False)
    department = db.relationship("Department")


class ProductType(TimestampMixin, db.Model):
    __tablename__ = "product_types"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Brand(TimestampMixin, db.Model):
    __tablename__ = "brands"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class ProductModel(TimestampMixin, db.Model):
    __tablename__ = "product_models"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    brand_id = db.Column(db.Integer, db.ForeignKey("brands.id"), nullable=False)
    product_type_id = db.Column(db.Integer, db.ForeignKey("product_types.id"))
    active = db.Column(db.Boolean, default=True, nullable=False)
    brand = db.relationship("Brand")
    product_type = db.relationship("ProductType")
    __table_args__ = (db.UniqueConstraint("brand_id", "name", name="uq_product_model_brand_name"),)


class LicenseName(TimestampMixin, db.Model):
    __tablename__ = "license_names"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Inventory(TimestampMixin, db.Model):
    __tablename__ = "inventory"
    id = db.Column(db.Integer, primary_key=True)
    inventory_no = db.Column(db.String(80), unique=True, nullable=False)
    computer_name = db.Column(db.String(120))
    serial_no = db.Column(db.String(160), unique=True)
    machine_no = db.Column(db.String(120))
    ifs_no = db.Column(db.String(120))
    note = db.Column(db.Text)
    status = db.Column(db.String(30), default="active", nullable=False)
    factory_id = db.Column(db.Integer, db.ForeignKey("factories.id"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)
    product_type_id = db.Column(db.Integer, db.ForeignKey("product_types.id"), nullable=False)
    brand_id = db.Column(db.Integer, db.ForeignKey("brands.id"), nullable=False)
    model_id = db.Column(db.Integer, db.ForeignKey("product_models.id"))
    personnel_id = db.Column(db.Integer, db.ForeignKey("personnel.id"))
    factory = db.relationship("Factory")
    department = db.relationship("Department")
    product_type = db.relationship("ProductType")
    brand = db.relationship("Brand")
    model = db.relationship("ProductModel")
    personnel = db.relationship("Personnel")


class License(TimestampMixin, db.Model):
    __tablename__ = "licenses"
    id = db.Column(db.Integer, primary_key=True)
    license_name_id = db.Column(db.Integer, db.ForeignKey("license_names.id"), nullable=False)
    license_type = db.Column(db.String(30), nullable=False, default="subscription")
    license_key = db.Column(db.Text)
    email = db.Column(db.String(255))
    password = db.Column(db.Text)
    expires_at = db.Column(db.Date)
    note = db.Column(db.Text)
    status = db.Column(db.String(30), default="active", nullable=False)
    license_name = db.relationship("LicenseName")


class StockItem(TimestampMixin, db.Model):
    __tablename__ = "stock_items"
    id = db.Column(db.Integer, primary_key=True)
    product_type_id = db.Column(db.Integer, db.ForeignKey("product_types.id"), nullable=False)
    brand_id = db.Column(db.Integer, db.ForeignKey("brands.id"), nullable=False)
    model_id = db.Column(db.Integer, db.ForeignKey("product_models.id"))
    quantity = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    unit = db.Column(db.String(30), default="Adet", nullable=False)
    note = db.Column(db.Text)
    status = db.Column(db.String(30), default="available", nullable=False)
    product_type = db.relationship("ProductType")
    brand = db.relationship("Brand")
    model = db.relationship("ProductModel")


class StockMovement(TimestampMixin, db.Model):
    __tablename__ = "stock_movements"
    id = db.Column(db.Integer, primary_key=True)
    stock_item_id = db.Column(db.Integer, db.ForeignKey("stock_items.id"), nullable=False)
    movement_type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Numeric(12, 2), nullable=False)
    unit = db.Column(db.String(30), default="Adet", nullable=False)
    personnel_id = db.Column(db.Integer, db.ForeignKey("personnel.id"))
    inventory_id = db.Column(db.Integer, db.ForeignKey("inventory.id"))
    note = db.Column(db.Text)
    stock_item = db.relationship("StockItem", backref=db.backref("movements", lazy="dynamic"))
    personnel = db.relationship("Personnel")
    inventory = db.relationship("Inventory")


class AssignmentHistory(TimestampMixin, db.Model):
    __tablename__ = "assignment_history"
    id = db.Column(db.Integer, primary_key=True)
    personnel_id = db.Column(db.Integer, db.ForeignKey("personnel.id"), nullable=False)
    asset_type = db.Column(db.String(30), nullable=False)
    asset_id = db.Column(db.Integer, nullable=False)
    action = db.Column(db.String(30), nullable=False)
    note = db.Column(db.Text)


class ScrapRecord(TimestampMixin, db.Model):
    __tablename__ = "scrap_records"
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(30), nullable=False)
    source_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(80), nullable=False)
    note = db.Column(db.Text)
    scrapped_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.BigInteger, primary_key=True)
    action = db.Column(db.String(80), nullable=False)
    entity_type = db.Column(db.String(80))
    entity_id = db.Column(db.Integer)
    actor_user_id = db.Column(db.Integer)
    details = db.Column(db.JSON)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
