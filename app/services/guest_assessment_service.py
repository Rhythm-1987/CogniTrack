"""
Guest-side counterpart to assessment_service.py — same public surface
(start_session/save_result/complete_session/get_dashboard_payload) and the
same validation/scoring rules, but persisted against the dedicated
guest_profiles/guest_assessment_sessions/guest_assessment_results tables
instead of users/assessment_sessions/assessment_results (kept separate per
Sprint 8's guest-architecture requirement — an unauthenticated request must
never be able to write into the authenticated schema).

Every actual business rule (check-in cleaning, numeric validation, rating,
session finalization, dashboard shaping, metadata merging) is imported
straight from assessment_service rather than reimplemented here — the two
tables share identical column names for everything those helpers touch, so
they work unmodified via duck typing. Only the DB-query glue (which table,
keyed by guest_id instead of a User) actually differs.
"""

from sqlalchemy.exc import IntegrityError

from ..core.database import db
from ..core.versions import ALGORITHM_VERSION, ASSESSMENT_VERSION, GAME_VERSIONS
from ..models.guest import GuestAssessmentResult, GuestAssessmentSession, GuestProfile
from . import profile_service
from .assessment_service import (
    _DURATION_KEY,
    MODULE_ORDER,
    AssessmentError,
    _checkin_fields,
    _clean_str,
    _finalize_session,
    _merge_session_metadata,
    _profile_payload,
    _rating_label,
    _shape_dashboard_payload,
    _validate_metadata,
    _validate_numeric,
    _MAX_RATING_LENGTH,
)


def _get_or_create_guest_profile(guest_id):
    profile = GuestProfile.query.filter_by(guest_uuid=guest_id).first()
    if profile is None:
        profile = GuestProfile(guest_uuid=guest_id)
        db.session.add(profile)
        db.session.flush()  # need profile.id before creating a session against it
    return profile


def _get_owned_session(guest_id, assessment_id):
    session = db.session.get(GuestAssessmentSession, assessment_id)
    if session is None or session.guest_profile.guest_uuid != guest_id:
        raise AssessmentError('Assessment session not found.', 404)
    return session


def _find_resumable_session(guest_profile):
    """Mirrors assessment_service._find_resumable_session, including its
    self-heal for a session where every module was saved but /complete
    never landed — see that function's docstring for the full rationale."""
    session = (
        GuestAssessmentSession.query
        .filter_by(guest_profile_id=guest_profile.id, status='in_progress')
        .order_by(GuestAssessmentSession.started_at.desc())
        .first()
    )
    if session is None:
        return None

    completed_domains = {r.domain for r in session.results}
    if all(m in completed_domains for m in MODULE_ORDER):
        _finalize_session(session, completion_mode='self_healed')
        db.session.commit()
        return None

    return session


def start_session(guest_id, checkin_data=None, metadata=None, profile_data=None):
    """Same contract as assessment_service.start_session, plus an optional
    `profile_data` dict (name/age/gender/education/dominant_hand/
    native_language) — guests have no registration step to collect these
    at, so the Check-In page collects them instead (see checkin.js) and
    they're upserted onto this guest's GuestProfile row here."""
    checkin_data = checkin_data or {}
    if not isinstance(checkin_data, dict):
        raise AssessmentError('checkin must be an object.', 400)
    profile_data = profile_data or {}
    if not isinstance(profile_data, dict):
        raise AssessmentError('profile must be an object.', 400)
    metadata = _validate_metadata(metadata)

    guest_profile = _get_or_create_guest_profile(guest_id)
    profile_service.apply_profile_fields(
        guest_profile,
        full_name=profile_data.get('name'),
        age=profile_data.get('age'),
        gender=profile_data.get('gender'),
        education=profile_data.get('education'),
        dominant_hand=profile_data.get('dominant_hand'),
        native_language=profile_data.get('native_language'),
    )

    existing = _find_resumable_session(guest_profile)
    cleaned = _checkin_fields(checkin_data)

    if existing:
        for field, value in cleaned.items():
            if value is not None:
                setattr(existing, field, value)
        _merge_session_metadata(existing, metadata)
        db.session.commit()
        return {'assessment_id': existing.id, 'status': existing.status, 'resumed': True}

    attempt_number = (
        db.session.query(GuestAssessmentSession.id)
        .filter_by(guest_profile_id=guest_profile.id)
        .count() + 1
    )
    session = GuestAssessmentSession(
        guest_profile_id=guest_profile.id,
        assessment_version=ASSESSMENT_VERSION,
        algorithm_version=ALGORITHM_VERSION,
        session_metadata=dict(metadata, attempt_number=attempt_number),
        **cleaned,
    )
    db.session.add(session)
    db.session.commit()

    return {'assessment_id': session.id, 'status': session.status, 'resumed': False}


def save_result(guest_id, assessment_id, domain, score, accuracy, average_time, rating, raw_data, duration):
    if domain not in MODULE_ORDER:
        raise AssessmentError('Invalid assessment domain.', 400)

    score = _validate_numeric('score', score, 0, 100)
    accuracy = _validate_numeric('accuracy', accuracy, 0, 100)
    average_time = _validate_numeric('average_time', average_time, 0, 600000)
    duration = _validate_numeric('duration', duration, 0, 86400)

    if raw_data is not None and not isinstance(raw_data, dict):
        raise AssessmentError('raw_data must be an object.', 400)
    if rating is not None and not isinstance(rating, str):
        raise AssessmentError('rating must be a string.', 400)
    rating = _clean_str(rating, _MAX_RATING_LENGTH)

    session = _get_owned_session(guest_id, assessment_id)
    if session.status == 'completed':
        raise AssessmentError('This assessment has already been completed.', 409)

    stored_raw = dict(raw_data or {})
    if duration is not None:
        stored_raw[_DURATION_KEY] = duration

    result = GuestAssessmentResult.query.filter_by(assessment_id=session.id, domain=domain).first()
    if result is None:
        result = GuestAssessmentResult(assessment_id=session.id, domain=domain)
        db.session.add(result)
        try:
            db.session.flush()
        except IntegrityError:
            # Same race as assessment_service.save_result — see its comment.
            db.session.rollback()
            result = GuestAssessmentResult.query.filter_by(assessment_id=session.id, domain=domain).first()
            if result is None:
                raise

    result.score = score
    result.accuracy = accuracy
    result.average_time = average_time
    result.rating = rating or _rating_label(score)
    result.raw_data = stored_raw
    result.game_version = GAME_VERSIONS.get(domain)

    db.session.commit()
    return {'domain': domain, 'result_id': result.id}


def complete_session(guest_id, assessment_id, metadata=None):
    session = _get_owned_session(guest_id, assessment_id)
    if session.status == 'completed':
        raise AssessmentError('This assessment has already been completed.', 409)
    metadata = _validate_metadata(metadata)

    _finalize_session(session)
    _merge_session_metadata(session, metadata)
    db.session.commit()

    return {
        'assessment_id': session.id,
        'overall_score': session.overall_score,
        'duration': session.duration,
        'status': session.status,
        'completed_at': session.completed_at.isoformat(),
    }


def get_guest_assessment_state(guest_id):
    """Guest-side counterpart to assessment_service.get_user_assessment_state
    — used by routes/assessment.py hub() for a returning guest whose
    guest_id cookie already exists."""
    guest_profile = GuestProfile.query.filter_by(guest_uuid=guest_id).first()
    if guest_profile is None:
        return {'state': 'none', 'resume': None}

    session = _find_resumable_session(guest_profile)
    if session:
        completed_domains = {r.domain for r in session.results}
        next_module = next(m for m in MODULE_ORDER if m not in completed_domains)
        resume = {
            'assessmentId': session.id,
            'nextModule': next_module,
            'completedModules': [m for m in MODULE_ORDER if m in completed_domains],
            'user': _profile_payload(guest_profile),
        }
        return {'state': 'in_progress', 'resume': resume}

    has_completed = (
        db.session.query(GuestAssessmentSession.id)
        .filter_by(guest_profile_id=guest_profile.id, status='completed')
        .first()
        is not None
    )
    return {'state': 'completed' if has_completed else 'none', 'resume': None}


def get_dashboard_payload(guest_id):
    guest_profile = GuestProfile.query.filter_by(guest_uuid=guest_id).first()
    if guest_profile is None:
        return None

    session = (
        GuestAssessmentSession.query
        .filter_by(guest_profile_id=guest_profile.id, status='completed')
        .order_by(GuestAssessmentSession.completed_at.desc())
        .first()
    )
    if session is None:
        return None

    return _shape_dashboard_payload(session, guest_profile)
