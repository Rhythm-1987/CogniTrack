from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_wtf import CSRFProtect

migrate = Migrate()
csrf = CSRFProtect()

# Storage backend is read from RATELIMIT_STORAGE_URI (see config.py) at
# limiter.init_app() time — defaults to in-process memory, which is fine
# for a single-process deployment but does not share state across
# multiple gunicorn workers or instances.
limiter = Limiter(key_func=get_remote_address, default_limits=['200 per minute'])
