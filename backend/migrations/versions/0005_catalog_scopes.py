"""module-specific product catalog scopes

Revision ID: 0005_catalog_scopes
Revises: 0004_product_brand_hierarchy
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_catalog_scopes"
down_revision = "0004_product_brand_hierarchy"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "product_catalog_scopes",
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(30), nullable=False),
        sa.PrimaryKeyConstraint("entity_type", "entity_id", "scope"),
    )
    for entity, table in (("type", "product_types"), ("brand", "brands"), ("model", "product_models")):
        op.execute(sa.text(f"INSERT INTO product_catalog_scopes(entity_type,entity_id,scope) SELECT '{entity}',id,'inventory' FROM {table} ON CONFLICT DO NOTHING"))


def downgrade():
    op.drop_table("product_catalog_scopes")
