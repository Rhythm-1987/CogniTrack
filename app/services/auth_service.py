"""
Authentication service layer — Sprint 7.3.

Real persistence via SQLAlchemy + Flask-Login. Replaces the
session-only simulation from the previous sprint.
"""

from datetime import datetime, timezone

from flask_login import login_user as _start_login_session
from flask_login import logout_user as _end_login_session
from sqlalchemy.exc import IntegrityError

from ..core.database import db
from ..models.profile import Profile
from ..models.user import User
from ..utils.helpers import hash_password, verify_password
from ..utils.validators import MAX_PASSWORD_LENGTH, is_valid_email, is_valid_password
from . import profile_service

_MAX_FULL_NAME_LENGTH = 120

# Deliberately identical whether the email was already taken (caught by
# the pre-check below) or a concurrent registration won the race (caught
# by the IntegrityError fallback) — neither path confirms or denies that
# an account exists for the address, closing off email enumeration via
# the registration form.
_REGISTRATION_FAILED_MESSAGE = (
    "We couldn't create an account with those details. "
    "If you already have an account, try logging in instead."
)

# Computed once at import time and compared against on every login attempt
# for an email that doesn't exist, so that path takes about as long as a
# real account with a wrong password — verify_password's hash comparison is
# deliberately slow, and skipping it entirely for unknown emails is a timing
# side-channel an attacker can use to enumerate registered addresses even
# though the returned error message is already identical either way.
_DUMMY_PASSWORD_HASH = hash_password('cognitrack-timing-guard-dummy')


def register_user(email, password, full_name=None, confirm_password=None, profile_fields=None):
    """Validate, enforce email uniqueness, hash the password, create
    the User + Profile (including the permanent demographic fields
    collected on the Registration form — see profile_service), commit,
    and start the Flask-Login session."""
    email = (email or '').strip().lower()
    full_name = (full_name or '').strip()[:_MAX_FULL_NAME_LENGTH] or None
    profile_fields = profile_fields or {}

    if not is_valid_email(email):
        return {'success': False, 'message': 'Enter a valid email address.'}
    if confirm_password is not None and password != confirm_password:
        return {'success': False, 'message': 'Passwords do not match.'}
    if not is_valid_password(password):
        return {
            'success': False,
            'message': 'Password must be between 8 and %d characters.' % MAX_PASSWORD_LENGTH,
        }
    if User.query.filter_by(email=email).first() is not None:
        return {'success': False, 'message': _REGISTRATION_FAILED_MESSAGE}

    user = User(email=email, password_hash=hash_password(password))
    profile = Profile(full_name=full_name)
    profile_service.apply_profile_fields(
        profile,
        age=profile_fields.get('age'),
        gender=profile_fields.get('gender'),
        education=profile_fields.get('education'),
        dominant_hand=profile_fields.get('dominant_hand'),
        native_language=profile_fields.get('native_language'),
    )
    user.profile = profile

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # Lost a race with a concurrent registration for the same email
        # between the query above and this commit — the unique
        # constraint on users.email caught it, so no duplicate account
        # was created either way.
        db.session.rollback()
        return {'success': False, 'message': _REGISTRATION_FAILED_MESSAGE}

    _start_login_session(user)
    return {'success': True, 'message': 'Account created.', 'user': user}


def login_user(email, password):
    """Look up the user by email, verify the password hash, update
    last_login, and start the Flask-Login session."""
    email = (email or '').strip().lower()

    user = User.query.filter_by(email=email).first()
    if user is not None:
        password_ok = verify_password(user.password_hash, password)
    else:
        # See _DUMMY_PASSWORD_HASH above — keeps this branch's timing
        # comparable to the "wrong password" branch.
        verify_password(_DUMMY_PASSWORD_HASH, password)
        password_ok = False

    if not user or not password_ok:
        return {'success': False, 'message': 'Invalid email or password.'}
    if not user.is_active:
        return {'success': False, 'message': 'This account has been deactivated.'}

    try:
        user.last_login = datetime.now(timezone.utc)
        db.session.commit()
    except Exception:
        # Updating last_login is best-effort — a transient DB error here
        # shouldn't turn an otherwise-valid login into a 500.
        db.session.rollback()

    _start_login_session(user)
    return {'success': True, 'message': 'Login successful.', 'user': user}


def logout_user():
    _end_login_session()
    return {'success': True}
