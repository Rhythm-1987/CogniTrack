from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password):
    """Hash a plaintext password with Werkzeug's PBKDF2 implementation.
    Sprint 7.3 will persist the result to User.password_hash — nothing
    is written to storage here."""
    return generate_password_hash(password)


def verify_password(password_hash, password):
    """Verify a plaintext password against a stored hash. Sprint 7.3
    will call this against User.password_hash during login."""
    return check_password_hash(password_hash, password)
