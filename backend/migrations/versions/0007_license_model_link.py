"""link licenses to license models and seed basic catalog

Revision ID: 0007_license_model_link
Revises: 0006_license_models
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_license_model_link"
down_revision = "0006_license_models"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("licenses", sa.Column("license_model_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_licenses_license_model", "licenses", "license_models", ["license_model_id"], ["id"], ondelete="SET NULL")
    conn = op.get_bind()
    names = ["Office", "Windows", "Adobe"]
    for name in names:
        conn.execute(sa.text("INSERT INTO license_names(name, active, created_at, updated_at) VALUES (:name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (name) DO NOTHING"), {"name": name})
    models = {
        "Office": ["Office 2016", "Office 2019", "Office 2021", "Microsoft 365"],
        "Windows": ["Windows 10 Pro", "Windows 11 Pro", "Windows Server 2022"],
        "Adobe": ["Acrobat Pro", "Photoshop"]
    }
    for parent, children in models.items():
        for child in children:
            conn.execute(sa.text("INSERT INTO license_models(license_name_id, name, active, created_at, updated_at) SELECT id, :model, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM license_names WHERE name=:parent ON CONFLICT (license_name_id, name) DO NOTHING"), {"parent": parent, "model": child})


def downgrade():
    op.drop_constraint("fk_licenses_license_model", "licenses", type_="foreignkey")
    op.drop_column("licenses", "license_model_id")
