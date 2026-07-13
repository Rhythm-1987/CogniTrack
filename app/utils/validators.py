from email_validator import EmailNotValidError, validate_email


def is_valid_email(email):
    if not email:
        return False
    try:
        validate_email(email, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def is_valid_password(password):
    """Minimum viable password policy: at least 8 characters.
    Sprint 7.3 may layer additional complexity rules here."""
    return bool(password) and len(password) >= 8
