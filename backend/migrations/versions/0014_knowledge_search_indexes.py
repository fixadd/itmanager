"""Add trigram search indexes for knowledge articles.

Revision ID: 0014_knowledge_search_indexes
Revises: 0013_license_model_images
"""
from alembic import op

revision = "0014_knowledge_search_indexes"
down_revision = "0013_license_model_images"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_articles_title_trgm "
        "ON knowledge_articles USING gin (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_articles_summary_trgm "
        "ON knowledge_articles USING gin (summary gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_articles_content_trgm "
        "ON knowledge_articles USING gin (content gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_articles_tags_trgm "
        "ON knowledge_articles USING gin (tags gin_trgm_ops)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_knowledge_articles_tags_trgm")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_articles_content_trgm")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_articles_summary_trgm")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_articles_title_trgm")
