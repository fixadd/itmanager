"""Add access system catalog and personnel assignments.

Revision ID: 0021_personnel_system_accesses
Revises: 0020_network_ports
"""
from alembic import op
import sqlalchemy as sa

revision = "0021_personnel_system_accesses"
down_revision = "0020_network_ports"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "access_systems",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_access_systems_name"),
    )
    op.create_table(
        "personnel_system_accesses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personnel_id", sa.Integer(), nullable=False),
        sa.Column("system_id", sa.Integer(), nullable=False),
        sa.Column("has_access", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["personnel_id"], ["personnel.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["system_id"], ["access_systems.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("personnel_id", "system_id", name="uq_personnel_system_access"),
    )
    op.create_index("ix_personnel_system_accesses_personnel_id", "personnel_system_accesses", ["personnel_id"])
    op.create_index("ix_personnel_system_accesses_system_id", "personnel_system_accesses", ["system_id"])


def downgrade():
    op.drop_index("ix_personnel_system_accesses_system_id", table_name="personnel_system_accesses")
    op.drop_index("ix_personnel_system_accesses_personnel_id", table_name="personnel_system_accesses")
    op.drop_table("personnel_system_accesses")
    op.drop_table("access_systems")
