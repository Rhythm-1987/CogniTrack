import os
import secrets

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    # The real value from the environment, if any — create_app() checks
    # this directly (not SECRET_KEY below) to refuse starting outside
    # DEBUG mode without one. SECRET_KEY itself still falls back to a
    # per-process random value so local dev without a .env keeps
    # working; sessions simply invalidate on restart in that case.
    SECRET_KEY_FROM_ENV = os.environ.get('SECRET_KEY')
    SECRET_KEY = SECRET_KEY_FROM_ENV or secrets.token_hex(32)

    # Supabase/Render (like Heroku before them) commonly hand out
    # connection strings using the legacy 'postgres://' scheme, which
    # SQLAlchemy 1.4+ no longer recognizes as a dialect — it must be
    # 'postgresql://'. Normalize so DATABASE_URL works verbatim as given.
    _database_url = os.environ.get('DATABASE_URL')
    if _database_url and _database_url.startswith('postgres://'):
        _database_url = _database_url.replace('postgres://', 'postgresql://', 1)

    SQLALCHEMY_DATABASE_URI = _database_url or \
        'sqlite:///' + os.path.join(BASE_DIR, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Recycles dead connections instead of surfacing them as errors —
    # matters once this points at a real Postgres server that can
    # close idle connections out from under a long-lived pool.
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    DEBUG = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true')

    # ---- Session cookie hardening ----
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    # Secure cookies require HTTPS, which local DEBUG dev usually doesn't
    # have — on everywhere else so the session cookie is never sent over
    # plain HTTP.
    SESSION_COOKIE_SECURE = not DEBUG

    # ---- Rate limiting ----
    # In-process memory storage — adequate for a single-process
    # deployment; does not share limit state across multiple gunicorn
    # workers or instances. Override via RATELIMIT_STORAGE_URI (e.g. a
    # redis:// URL) if that starts to matter.
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
