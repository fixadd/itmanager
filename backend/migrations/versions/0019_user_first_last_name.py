"""Add first and last names to user accounts.

Revision ID: 0019_user_first_last_name
Revises: 0018_purchase_received_quantity
"""
from alembic import op
import sqlalchemy as sa

revision = "0019_user_first_last_name"
down_revision = "0018_purchase_received_quantity"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=False, server_default=""))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=False, server_default=""))


def downgrade():
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
