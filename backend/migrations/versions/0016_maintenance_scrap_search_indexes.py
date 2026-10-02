"""Add trigram indexes for maintenance and scrap searches.

Revision ID: 0016_maintenance_scrap_search_indexes
Revises: 0015_stock_request_indexes
"""
from alembic import op

revision = "0016_maintenance_scrap_search_indexes"
down_revision = "0015_stock_request_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_maintenance_fault_trgm "
        "ON maintenance_records USING gin (fault gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_maintenance_description_trgm "
        "ON maintenance_records USING gin (description gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_maintenance_note_trgm "
        "ON maintenance_records USING gin (note gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_maintenance_technician_trgm "
        "ON maintenance_records USING gin (technician gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_maintenance_service_trgm "
        "ON maintenance_records USING gin (service gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scrap_reason_trgm "
        "ON scrap_records USING gin (reason gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scrap_note_trgm "
        "ON scrap_records USING gin (note gin_trgm_ops)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_scrap_note_trgm")
    op.execute("DROP INDEX IF EXISTS ix_scrap_reason_trgm")
    op.execute("DROP INDEX IF EXISTS ix_maintenance_service_trgm")
    op.execute("DROP INDEX IF EXISTS ix_maintenance_technician_trgm")
    op.execute("DROP INDEX IF EXISTS ix_maintenance_note_trgm")
    op.execute("DROP INDEX IF EXISTS ix_maintenance_description_trgm")
    op.execute("DROP INDEX IF EXISTS ix_maintenance_fault_trgm")
