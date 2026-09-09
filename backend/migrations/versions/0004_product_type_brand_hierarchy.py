"""product type brand hierarchy

Revision ID: 0004_product_type_brand_hierarchy
Revises: 0003_management_extensions
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_product_type_brand_hierarchy"
down_revision = "0003_management_extensions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "product_type_brands",
        sa.Column("product_type_id", sa.Integer(), nullable=False),
        sa.Column("brand_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_type_id"], ["product_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("product_type_id", "brand_id"),
    )
    op.execute(sa.text("""
        INSERT INTO product_type_brands (product_type_id, brand_id)
        SELECT DISTINCT product_type_id, brand_id
        FROM product_models
        WHERE product_type_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """))


def downgrade():
    op.drop_table("product_type_brands")
