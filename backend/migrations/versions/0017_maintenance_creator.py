"""Track the personnel who opened maintenance records.

Revision ID: 0017_maintenance_creator
Revises: 0016_maint_scrap_indexes
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_maintenance_creator"
down_revision = "0016_maint_scrap_indexes"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("maintenance_records", sa.Column("created_by_personnel_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_maintenance_created_by_personnel",
        "maintenance_records",
        "personnel",
        ["created_by_personnel_id"],
        ["id"],
    )
    op.create_index(
        "ix_maintenance_created_by_personnel_id",
        "maintenance_records",
        ["created_by_personnel_id"],
    )

def downgrade():
    op.drop_index("ix_maintenance_created_by_personnel_id", table_name="maintenance_records")
    op.drop_constraint("fk_maintenance_created_by_personnel", "maintenance_records", type_="foreignkey")
    op.drop_column("maintenance_records", "created_by_personnel_id")
