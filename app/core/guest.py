"""
Anonymous guest identity — reuses Flask's existing signed session cookie
infrastructure (SECRET_KEY, SESSION_COOKIE_* hardening already configured
in config.py) instead of inventing a separate cookie/header mechanism.

Deliberately never marked permanent: session.permanent stays False (the
default), so the cookie carries no Expires/Max-Age and is dropped by the
browser when it fully closes — matching the "cleared when you close your
browser" promise in the Privacy Policy/Terms, unlike a long-lived tracking
cookie would.
"""

from uuid import uuid4

from flask import session


def get_or_create_guest_id():
    """Lazily assigns a guest a UUID on first call (e.g. submitting the
    Check-In step) and returns the same value on every later call within
    the same browser session."""
    guest_id = session.get('guest_id')
    if not guest_id:
        guest_id = str(uuid4())
        session['guest_id'] = guest_id
    return guest_id


def get_guest_id():
    """Read-only lookup — used where a guest_id should be reported if
    one already exists (e.g. the Assessment Hub) but never created just
    from a page view."""
    return session.get('guest_id')
