"""Link licenses directly to inventory devices.

Revision ID: 0012_license_inventory_link
Revises: 0011_barcode_generation_defaults
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_license_inventory_link"
down_revision = "0011_barcode_generation_defaults"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("licenses", sa.Column("inventory_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_licenses_inventory_id","licenses","inventory",["inventory_id"],["id"],ondelete="SET NULL")
    op.create_index("ix_licenses_inventory_id","licenses",["inventory_id"])

def downgrade():
    op.drop_index("ix_licenses_inventory_id", table_name="licenses")
    op.drop_constraint("fk_licenses_inventory_id","licenses",type_="foreignkey")
    op.drop_column("licenses","inventory_id")
