from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password):
    """Hash a plaintext password with Werkzeug's PBKDF2 implementation."""
    return generate_password_hash(password)


def verify_password(password_hash, password):
    """Verify a plaintext password against a stored hash."""
    return check_password_hash(password_hash, password)
