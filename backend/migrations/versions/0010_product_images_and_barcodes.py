"""Add product master images and internal asset barcodes.

Revision ID: 0010_product_images_and_barcodes
Revises: 0009_knowledge_attachments
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_product_images_and_barcodes"
down_revision = "0009_knowledge_attachments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("product_models", sa.Column("image_path", sa.String(length=500), nullable=True))

    op.add_column("stock_items", sa.Column("barcode", sa.String(length=32), nullable=True))
    op.add_column("inventory", sa.Column("barcode", sa.String(length=32), nullable=True))
    op.add_column("licenses", sa.Column("barcode", sa.String(length=32), nullable=True))

    op.execute("UPDATE stock_items SET barcode = 'STK-' || lpad(id::text, 6, '0') WHERE barcode IS NULL")
    op.execute("UPDATE inventory SET barcode = 'ENV-' || lpad(id::text, 6, '0') WHERE barcode IS NULL")
    op.execute("UPDATE licenses SET barcode = 'LIC-' || lpad(id::text, 6, '0') WHERE barcode IS NULL")

    op.alter_column("stock_items", "barcode", nullable=False)
    op.alter_column("inventory", "barcode", nullable=False)
    op.alter_column("licenses", "barcode", nullable=False)

    op.create_unique_constraint("uq_stock_items_barcode", "stock_items", ["barcode"])
    op.create_unique_constraint("uq_inventory_barcode", "inventory", ["barcode"])
    op.create_unique_constraint("uq_licenses_barcode", "licenses", ["barcode"])


def downgrade():
    op.drop_constraint("uq_licenses_barcode", "licenses", type_="unique")
    op.drop_constraint("uq_inventory_barcode", "inventory", type_="unique")
    op.drop_constraint("uq_stock_items_barcode", "stock_items", type_="unique")
    op.drop_column("licenses", "barcode")
    op.drop_column("inventory", "barcode")
    op.drop_column("stock_items", "barcode")
    op.drop_column("product_models", "image_path")
