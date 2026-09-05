from alembic import context
from flask import current_app

config = context.config

# Flask-Migrate can run with an in-memory Config when the migrations directory
# is supplied directly. In that mode config_file_name points to a non-existent
# migrations/alembic.ini, so do not call fileConfig unless the file exists.
if config.config_file_name:
    from pathlib import Path
    from logging.config import fileConfig
    if Path(config.config_file_name).is_file():
        fileConfig(config.config_file_name)


def get_metadata():
    return current_app.extensions["migrate"].db.metadata


def get_engine():
    return current_app.extensions["migrate"].db.engine


def run_migrations_offline():
    context.configure(
        url=current_app.config["SQLALCHEMY_DATABASE_URI"],
        target_metadata=get_metadata(),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    engine = get_engine()
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
