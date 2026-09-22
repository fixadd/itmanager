"""add license start date

Revision ID: 0008_license_start_date
Revises: 0007_license_model_link
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_license_start_date"
down_revision = "0007_license_model_link"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("licenses", sa.Column("starts_at", sa.Date(), nullable=True))

def downgrade():
    op.drop_column("licenses", "starts_at")
