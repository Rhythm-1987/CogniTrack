"""
Permanent profile field validation + updates — shared by registration
(auth_service.register_user) and the Profile edit page
(routes/auth.py update_profile). Moved out of assessment_service.py in
Sprint 7.4.5, when permanent demographic fields stopped being collected
on every assessment run and became registration/Edit-Profile-only.

Same clamp-don't-reject philosophy as before: profile fields are optional
demographic metadata, not security- or integrity-critical, so an invalid/
oversized value is dropped or truncated rather than rejecting the whole
request.
"""

from ..core.database import db
from ..models.profile import Profile

MAX_FULL_NAME_LENGTH = 120
MAX_NATIVE_LANGUAGE_LENGTH = 60

# Mirrors the <select> options on the Registration and Profile-edit forms
# (templates/pages/register.html, templates/pages/profile.html) — kept
# here, not just enforced client-side, so a direct form submission can't
# write an arbitrary string into these columns.
GENDER_VALUES = {'male', 'female', 'non-binary', 'prefer-not-to-say'}
EDUCATION_VALUES = {'high-school', 'some-college', 'bachelors', 'masters', 'doctoral'}
HAND_VALUES = {'right', 'left', 'ambidextrous'}


def clean_str(value, max_len):
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:max_len] if value else None


def clean_enum(value, allowed):
    """An unrecognised value is dropped rather than failing the whole
    request — same clamp-don't-reject philosophy as clean_str/clean_age."""
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in allowed else None


def clean_age(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value.isdigit():
            return None
        value = int(value)
    if not isinstance(value, (int, float)):
        return None
    age = int(value)
    return age if 1 <= age <= 120 else None


def apply_profile_fields(profile, full_name=None, age=None, gender=None,
                          education=None, dominant_hand=None, native_language=None):
    """Sets every provided, valid field on `profile` in place. Each
    argument may be raw/untrusted (form data or a JSON body) — every value
    is cleaned before being assigned. A field is only overwritten when a
    valid value was actually provided, so a partial update (e.g. Edit
    Profile submitting every field, or registration only submitting a
    subset) never blanks out an existing value with None."""
    full_name = clean_str(full_name, MAX_FULL_NAME_LENGTH)
    if full_name:
        profile.full_name = full_name

    age = clean_age(age)
    if age is not None:
        profile.age = age

    gender = clean_enum(gender, GENDER_VALUES)
    if gender:
        profile.gender = gender

    education = clean_enum(education, EDUCATION_VALUES)
    if education:
        profile.education = education

    dominant_hand = clean_enum(dominant_hand, HAND_VALUES)
    if dominant_hand:
        profile.dominant_hand = dominant_hand

    native_language = clean_str(native_language, MAX_NATIVE_LANGUAGE_LENGTH)
    if native_language:
        profile.native_language = native_language

    return profile


def update_profile(user, form):
    """Applies an Edit Profile submission (routes/auth.py update_profile)
    to `user`'s Profile row, creating one first if somehow missing
    (registration always creates one, but this stays defensive)."""
    profile = user.profile
    if profile is None:
        profile = Profile(user_id=user.id)
        db.session.add(profile)

    apply_profile_fields(
        profile,
        full_name=form.get('full_name'),
        age=form.get('age'),
        gender=form.get('gender'),
        education=form.get('education'),
        dominant_hand=form.get('dominant_hand'),
        native_language=form.get('native_language'),
    )

    db.session.commit()
    return profile
