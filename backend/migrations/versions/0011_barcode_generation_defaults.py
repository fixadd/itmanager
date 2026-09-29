"""Generate internal barcodes safely at database insert time.

Revision ID: 0011_barcode_generation_defaults
Revises: 0010_product_images_and_barcodes
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_barcode_generation_defaults"
down_revision = "0010_product_images_and_barcodes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SEQUENCE IF NOT EXISTS stock_barcode_seq")
    op.execute("CREATE SEQUENCE IF NOT EXISTS inventory_barcode_seq")
    op.execute("CREATE SEQUENCE IF NOT EXISTS license_barcode_seq")

    op.execute("SELECT setval('stock_barcode_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM stock_items")
    op.execute("SELECT setval('inventory_barcode_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM inventory")
    op.execute("SELECT setval('license_barcode_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM licenses")

    op.alter_column(
        "stock_items",
        "barcode",
        server_default=sa.text("'STK-' || lpad(nextval('stock_barcode_seq')::text, 6, '0')"),
    )
    op.alter_column(
        "inventory",
        "barcode",
        server_default=sa.text("'ENV-' || lpad(nextval('inventory_barcode_seq')::text, 6, '0')"),
    )
    op.alter_column(
        "licenses",
        "barcode",
        server_default=sa.text("'LIC-' || lpad(nextval('license_barcode_seq')::text, 6, '0')"),
    )


def downgrade():
    op.alter_column("licenses", "barcode", server_default=None)
    op.alter_column("inventory", "barcode", server_default=None)
    op.alter_column("stock_items", "barcode", server_default=None)
    op.execute("DROP SEQUENCE IF EXISTS license_barcode_seq")
    op.execute("DROP SEQUENCE IF EXISTS inventory_barcode_seq")
    op.execute("DROP SEQUENCE IF EXISTS stock_barcode_seq")
