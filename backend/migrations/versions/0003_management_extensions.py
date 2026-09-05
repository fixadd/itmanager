"""management extensions

Revision ID: 0003_management_extensions
Revises: 0002_license_personnel
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_management_extensions"
down_revision = "0002_license_personnel"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("knowledge_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("knowledge_articles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("stored_name", sa.String(255), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table("connection_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("host", sa.String(255)), sa.Column("port", sa.Integer()),
        sa.Column("username", sa.String(255)), sa.Column("secret_encrypted", sa.Text()),
        sa.Column("options", sa.JSON()), sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

def downgrade():
    op.drop_table("connection_settings")
    op.drop_table("knowledge_attachments")
