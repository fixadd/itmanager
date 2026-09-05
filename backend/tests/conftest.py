import os
import sys
from pathlib import Path

import pytest
from flask_migrate import downgrade, upgrade

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "backend" / "migrations"
sys.path.insert(0, str(ROOT))

# Config is evaluated when backend.app is imported. In CI/test runs, point
# the required production-style DATABASE_URL setting at the isolated test DB.
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-123456")

from backend.app import create_app
from backend.app.extensions import db


@pytest.fixture(scope="session")
def app():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured")

    class TestConfig:
        TESTING = True
        SECRET_KEY = "test-secret-key-that-is-long-enough-123456"
        SQLALCHEMY_DATABASE_URI = database_url
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        SESSION_COOKIE_HTTPONLY = True
        SESSION_COOKIE_SAMESITE = "Strict"
        SESSION_COOKIE_SECURE = False

    application = create_app(TestConfig)
    with application.app_context():
        upgrade(directory=str(MIGRATIONS_DIR))
        yield application
        db.session.remove()
        downgrade(directory=str(MIGRATIONS_DIR), revision="base")


@pytest.fixture()
def clean_db(app):
    with app.app_context():
        db.session.remove()
        downgrade(directory=str(MIGRATIONS_DIR), revision="base")
        upgrade(directory=str(MIGRATIONS_DIR))
        yield
        db.session.remove()
        downgrade(directory=str(MIGRATIONS_DIR), revision="base")


@pytest.fixture()
def client(app, clean_db):
    return app.test_client()
