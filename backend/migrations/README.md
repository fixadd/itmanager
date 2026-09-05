# IT Manager database migrations

This directory is the production Alembic/Flask-Migrate migration store.

Commands from the repository root:

```bash
flask --app backend.run db upgrade
flask --app backend.run db migrate -m "describe change"
flask --app backend.run db downgrade -1
```

Production startup must run `db upgrade` before application traffic is enabled.
Do not use `db.create_all()` for production schema management.

The first revision is a baseline schema for the current SQLAlchemy models. Future schema changes must be committed as explicit Alembic revisions.
