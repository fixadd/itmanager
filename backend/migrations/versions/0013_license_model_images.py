"""Add images to license models.

Revision ID: 0013_license_model_images
Revises: 0012_license_inventory_link
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_license_model_images"
down_revision = "0012_license_inventory_link"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("license_models", sa.Column("image_path", sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column("license_models", "image_path")
