from functools import wraps

from flask import jsonify
from flask_login import current_user


def login_required_api(view):
    """Like flask_login's login_required, but returns a JSON 401 instead of
    redirecting to the login page — the correct behaviour for fetch()-driven
    API routes, which would otherwise silently receive the login HTML page."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required.'}), 401
        return view(*args, **kwargs)
    return wrapped
