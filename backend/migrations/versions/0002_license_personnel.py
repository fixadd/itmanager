"""Add current personnel ownership to licenses.

Revision ID: 0002_license_personnel
Revises: 0001_baseline
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_license_personnel"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("licenses", sa.Column("personnel_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_licenses_personnel_id", "licenses", "personnel", ["personnel_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_licenses_personnel_id", "licenses", type_="foreignkey")
    op.drop_column("licenses", "personnel_id")
