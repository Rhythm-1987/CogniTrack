from email_validator import EmailNotValidError, validate_email

# Werkzeug's PBKDF2 hashing cost scales with input length — an
# unbounded password field is a cheap CPU-exhaustion vector (submit a
# multi-megabyte "password" repeatedly). 128 is generous for any real
# passphrase while closing that off.
MAX_PASSWORD_LENGTH = 128


def is_valid_email(email):
    if not email:
        return False
    try:
        validate_email(email, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def is_valid_password(password):
    """Minimum viable password policy: 8-128 characters."""
    if not password:
        return False
    return 8 <= len(password) <= MAX_PASSWORD_LENGTH
