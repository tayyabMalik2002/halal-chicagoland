import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def _normalize_database_url(url):
    # SQLAlchemy 2.x requires the "postgresql://" scheme; Azure (and other
    # providers) often hand out "postgres://" instead.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    # Azure Postgres flexible server enforces SSL; require it unless the
    # connection string already specifies an sslmode.
    if url.startswith("postgresql://") and "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(
        os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'restaurants.db')}")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Shared admin username/password gating write access to /api/v1/admin/*
    # (see app/routes/admin.py) — a single hardcoded account, not a full
    # user-account system. Local-dev-only defaults so `python run.py` works
    # out of the box; production sets real values via Container Apps
    # secrets, never committed.
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin-dev-password")
    # Secret used to sign admin auth tokens (itsdangerous). Falls back to the
    # admin password itself locally so no extra env var is needed in dev;
    # production sets a real, independent value.
    ADMIN_TOKEN_SECRET = os.environ.get("ADMIN_TOKEN_SECRET", ADMIN_PASSWORD)
