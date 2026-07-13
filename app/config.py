import os
import secrets

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    # Falls back to a per-process random key when SECRET_KEY is unset
    # (e.g. no .env yet) so sessions still work in local dev. Sessions
    # simply invalidate on restart — set a real SECRET_KEY in .env for
    # anything beyond local dev.
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Recycles dead connections instead of surfacing them as errors —
    # matters once this points at a real Postgres server that can
    # close idle connections out from under a long-lived pool.
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    DEBUG = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true')
