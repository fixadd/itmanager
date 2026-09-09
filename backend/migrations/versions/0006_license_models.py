"""add license models linked to license names

Revision ID: 0006_license_models
Revises: 0005_catalog_scopes
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_license_models"
down_revision = "0005_catalog_scopes"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "license_models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("license_name_id", sa.Integer(), sa.ForeignKey("license_names.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("license_name_id", "name", name="uq_license_model_name"),
    )


def downgrade():
    op.drop_table("license_models")
