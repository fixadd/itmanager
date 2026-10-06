"""Track received quantities for purchase request items.

Revision ID: 0018_purchase_received_quantity
Revises: 0017_maintenance_creator
"""
from alembic import op
import sqlalchemy as sa

revision = "0018_purchase_received_quantity"
down_revision = "0017_maintenance_creator"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "purchase_request_items",
        sa.Column("received_quantity", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("purchase_request_items", "received_quantity")
