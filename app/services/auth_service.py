"""
Authentication service layer — Sprint 7.3.

Real persistence via SQLAlchemy + Flask-Login. Replaces the
session-only simulation from the previous sprint.
"""

from datetime import datetime, timezone

from flask_login import login_user as _start_login_session
from flask_login import logout_user as _end_login_session

from ..core.database import db
from ..models.profile import Profile
from ..models.user import User
from ..utils.helpers import hash_password, verify_password
from ..utils.validators import is_valid_email, is_valid_password


def register_user(email, password, full_name=None):
    """Validate, enforce email uniqueness, hash the password, create
    the User + Profile, commit, and start the Flask-Login session."""
    email = (email or '').strip().lower()

    if not is_valid_email(email):
        return {'success': False, 'message': 'Enter a valid email address.'}
    if not is_valid_password(password):
        return {'success': False, 'message': 'Password must be at least 8 characters.'}
    if User.query.filter_by(email=email).first() is not None:
        return {'success': False, 'message': 'An account with that email already exists.'}

    user = User(email=email, password_hash=hash_password(password))
    user.profile = Profile(full_name=full_name)

    db.session.add(user)
    db.session.commit()

    _start_login_session(user)
    return {'success': True, 'message': 'Account created.', 'user': user}


def login_user(email, password):
    """Look up the user by email, verify the password hash, update
    last_login, and start the Flask-Login session."""
    email = (email or '').strip().lower()

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(user.password_hash, password):
        return {'success': False, 'message': 'Invalid email or password.'}
    if not user.is_active:
        return {'success': False, 'message': 'This account has been deactivated.'}

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    _start_login_session(user)
    return {'success': True, 'message': 'Login successful.', 'user': user}


def logout_user():
    _end_login_session()
    return {'success': True}
