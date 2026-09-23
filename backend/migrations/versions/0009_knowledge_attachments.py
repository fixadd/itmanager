"""add knowledge attachment storage table

Revision ID: 0009_knowledge_attachments
Revises: 0008_license_start_date
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_knowledge_attachments"
down_revision = "0008_license_start_date"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "knowledge_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("knowledge_articles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("stored_name", name="uq_knowledge_attachments_stored_name"),
    )


def downgrade():
    op.drop_table("knowledge_attachments")
