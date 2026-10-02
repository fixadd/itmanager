"""Add targeted indexes for stock and purchase-request filtering.

Revision ID: 0015_stock_request_indexes
Revises: 0014_knowledge_search_indexes
"""
from alembic import op

revision = "0015_stock_request_indexes"
down_revision = "0014_knowledge_search_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_items_status_id "
        "ON stock_items (status, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_movements_stock_item_id "
        "ON stock_movements (stock_item_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_movements_created_at "
        "ON stock_movements (created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_purchase_requests_status_id "
        "ON purchase_requests (status, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_purchase_requests_priority_id "
        "ON purchase_requests (priority, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_personnel_name_trgm "
        "ON personnel USING gin (name gin_trgm_ops)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_personnel_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_purchase_requests_priority_id")
    op.execute("DROP INDEX IF EXISTS ix_purchase_requests_status_id")
    op.execute("DROP INDEX IF EXISTS ix_stock_movements_created_at")
    op.execute("DROP INDEX IF EXISTS ix_stock_movements_stock_item_id")
    op.execute("DROP INDEX IF EXISTS ix_stock_items_status_id")
