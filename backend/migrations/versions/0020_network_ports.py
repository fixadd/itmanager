"""Create network port inventory.

Revision ID: 0020_network_ports
Revises: 0019_user_first_last_name
"""
from alembic import op
import sqlalchemy as sa

revision = "0020_network_ports"
down_revision = "0019_user_first_last_name"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "network_ports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cabinet_name", sa.String(length=160), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("source_key", sa.String(length=160), nullable=True),
        sa.Column("device_type", sa.String(length=80), nullable=True),
        sa.Column("port_label", sa.String(length=120), nullable=True),
        sa.Column("patch_panel", sa.String(length=120), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("switch_port", sa.String(length=120), nullable=True),
        sa.Column("mounting_location", sa.String(length=200), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("cabinet_name", "row_number", "switch_port", name="uq_network_port_cabinet_row_switch"),
        sa.UniqueConstraint("cabinet_name", "source_key", name="uq_network_port_cabinet_source_key"),
    )
    op.create_index("ix_network_ports_cabinet_name", "network_ports", ["cabinet_name"])


def downgrade():
    op.drop_index("ix_network_ports_cabinet_name", table_name="network_ports")
    op.drop_table("network_ports")
