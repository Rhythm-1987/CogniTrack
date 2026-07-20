"""
Assessment persistence service — Sprint 8.

All database logic for the assessment API lives here so routes
(app/routes/api.py, app/routes/assessment.py) stay thin. Mirrors the
sessionStorage data contract already established by cognitrack-core.js
(assessment, startedAt, completedAt, duration, score, accuracy, avgTime,
rating, rawData) so the frontend can hydrate its cache directly from
these payloads without any reshaping.
"""

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from ..core.database import db
from ..models.assessment import AssessmentResult, AssessmentSession
from ..models.profile import Profile

MODULE_ORDER = ['memory', 'attention', 'executive', 'processing', 'spatial']

# Raw telemetry payloads are stored as-is under this key alongside the
# module's own rawData, since AssessmentResult has no dedicated duration
# column — keeping the per-module elapsed time next to the data it was
# measured from avoids a schema change for a single derived field.
_DURATION_KEY = '_duration'

_MAX_RATING_LENGTH = 20
_MAX_MEDICATION_LENGTH = 200

# Today's Assessment Check-In fields are temporary, per-session state (see
# models/assessment.py) — never part of the permanent Profile (that's
# profile_service.py, used by registration/Edit Profile instead). Same
# clamp-don't-reject philosophy: an invalid/oversized value is dropped
# rather than blocking someone from starting their assessment. Mirrors the
# <select> options on templates/pages/user.html (Today's Check-In page).
_SLEEP_VALUES = {'excellent', 'good', 'average', 'poor'}
_STRESS_VALUES = {'low', 'moderate', 'high'}
_CAFFEINE_VALUES = {'none', 'one-two', 'three-plus'}
_MOOD_VALUES = {'energized', 'calm', 'neutral', 'tired', 'stressed'}
_DISTRACTION_VALUES = {'none', 'some', 'significant'}


def _clean_str(value, max_len):
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:max_len] if value else None


def _clean_enum(value, allowed):
    """Same clamp-don't-reject philosophy as the other check-in fields
    below: an unrecognised value is dropped rather than failing the
    whole start_session request."""
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in allowed else None


def _clean_hours_slept(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if 0 <= value <= 24 else None


def _clean_bool(value):
    return value if isinstance(value, bool) else None


def _validate_numeric(label, value, min_val, max_val):
    """Raises rather than clamps — unlike profile metadata, a malformed
    score/duration means the client sent something we can't trust, so
    the save itself must fail with a clear 400 instead of persisting a
    garbage or silently-wrong value."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AssessmentError('%s must be a number.' % label, 400)
    if not (min_val <= value <= max_val):
        raise AssessmentError('%s must be between %s and %s.' % (label, min_val, max_val), 400)
    return value


class AssessmentError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _rating_label(score):
    if score is None:
        return None
    if score >= 90:
        return 'Excellent'
    if score >= 75:
        return 'Good'
    if score >= 60:
        return 'Average'
    return 'Needs Review'


def _get_owned_session(user, assessment_id):
    session = db.session.get(AssessmentSession, assessment_id)
    if session is None or session.user_id != user.id:
        raise AssessmentError('Assessment session not found.', 404)
    return session


def _checkin_fields(checkin_data):
    """Cleans the 8 Today's Assessment Check-In fields out of an untrusted
    dict, returning only the ones that pass validation — used for both a
    new session and updating an existing (resumed) one."""
    return {
        'sleep_quality': _clean_enum(checkin_data.get('sleepQuality'), _SLEEP_VALUES),
        'stress_level': _clean_enum(checkin_data.get('stressLevel'), _STRESS_VALUES),
        'hours_slept': _clean_hours_slept(checkin_data.get('hoursSlept')),
        'caffeine_today': _clean_enum(checkin_data.get('caffeineToday'), _CAFFEINE_VALUES),
        'medication': _clean_str(checkin_data.get('medication'), _MAX_MEDICATION_LENGTH),
        'current_mood': _clean_enum(checkin_data.get('currentMood'), _MOOD_VALUES),
        'wearing_glasses': _clean_bool(checkin_data.get('wearingGlasses')),
        'distractions': _clean_enum(checkin_data.get('distractions'), _DISTRACTION_VALUES),
    }


def start_session(user, checkin_data=None):
    """Idempotent: resumes an existing in-progress session for this user
    instead of creating a second one. Permanent profile fields (name, age,
    gender, education, dominant hand, native language) are set at
    registration or via Edit Profile only — never here; this only ever
    writes Today's Assessment Check-In's temporary, per-session fields."""
    existing = _find_resumable_session(user)

    checkin_data = checkin_data or {}
    if not isinstance(checkin_data, dict):
        raise AssessmentError('checkin must be an object.', 400)

    if user.profile is None:
        db.session.add(Profile(user_id=user.id))

    cleaned = _checkin_fields(checkin_data)

    if existing:
        for field, value in cleaned.items():
            if value is not None:
                setattr(existing, field, value)
        db.session.commit()
        return {'assessment_id': existing.id, 'status': existing.status, 'resumed': True}

    session = AssessmentSession(user_id=user.id, **cleaned)
    db.session.add(session)
    db.session.commit()

    return {'assessment_id': session.id, 'status': session.status, 'resumed': False}


def save_result(user, assessment_id, domain, score, accuracy, average_time, rating, raw_data, duration):
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

    session = _get_owned_session(user, assessment_id)
    if session.status == 'completed':
        raise AssessmentError('This assessment has already been completed.', 409)

    stored_raw = dict(raw_data or {})
    if duration is not None:
        stored_raw[_DURATION_KEY] = duration

    result = AssessmentResult.query.filter_by(assessment_id=session.id, domain=domain).first()
    if result is None:
        result = AssessmentResult(assessment_id=session.id, domain=domain)
        db.session.add(result)
        try:
            db.session.flush()
        except IntegrityError:
            # Lost a race with a concurrent save for the same module (e.g. a
            # retried request that landed after all, or two browser tabs) —
            # the unique (assessment_id, domain) constraint rejected our
            # insert because the other request's row already exists. Fall
            # back to updating that row instead of erroring or duplicating.
            db.session.rollback()
            result = AssessmentResult.query.filter_by(assessment_id=session.id, domain=domain).first()
            if result is None:
                raise

    result.score = score
    result.accuracy = accuracy
    result.average_time = average_time
    result.rating = rating or _rating_label(score)
    result.raw_data = stored_raw

    db.session.commit()
    return {'domain': domain, 'result_id': result.id}


def _finalize_session(session):
    """Marks an AssessmentSession completed from its already-saved
    results. Shared by complete_session (client-confirmed finish) and
    _find_resumable_session's self-heal path (all 5 domains saved but
    the client's final POST never arrived — closed tab, dropped
    connection, etc.)."""
    scores = [r.score for r in session.results if r.score is not None]
    overall_score = round(sum(scores) / len(scores)) if scores else 0

    completed_at = datetime.now(timezone.utc)
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    session.completed_at = completed_at
    session.overall_score = overall_score
    session.duration = int((completed_at - started_at).total_seconds())
    session.status = 'completed'
    return session


def complete_session(user, assessment_id):
    session = _get_owned_session(user, assessment_id)
    if session.status == 'completed':
        raise AssessmentError('This assessment has already been completed.', 409)

    _finalize_session(session)
    db.session.commit()

    return {
        'assessment_id': session.id,
        'overall_score': session.overall_score,
        'duration': session.duration,
        'status': session.status,
        'completed_at': session.completed_at.isoformat(),
    }


def _find_resumable_session(user):
    """Returns the user's genuinely resumable in-progress session, or
    None. Self-heals the case where every MODULE_ORDER domain already
    has a saved result but the final /api/assessment/complete call
    never landed (closed tab, dropped connection): such a session used
    to be invisible to both the Resume and Completed states, which let
    start_session silently resume it later with a stale started_at and
    a corrupted duration. Finalizing it here instead means it shows up
    correctly as completed, and start_session creates a fresh session
    for whatever the user does next."""
    session = (
        AssessmentSession.query
        .filter_by(user_id=user.id, status='in_progress')
        .order_by(AssessmentSession.started_at.desc())
        .first()
    )
    if session is None:
        return None

    completed_domains = {r.domain for r in session.results}
    if all(m in completed_domains for m in MODULE_ORDER):
        _finalize_session(session)
        db.session.commit()
        return None

    return session


def get_incomplete_session(user):
    """Used by the Assessment Hub to decide Resume vs Start New — the
    database, not sessionStorage, is authoritative for this decision."""
    session = _find_resumable_session(user)
    if session is None:
        return None

    completed_domains = {r.domain for r in session.results}
    next_module = next(m for m in MODULE_ORDER if m not in completed_domains)
    profile = user.profile

    return {
        'assessmentId': session.id,
        'nextModule': next_module,
        'completedModules': [m for m in MODULE_ORDER if m in completed_domains],
        'user': _profile_payload(profile),
    }


def get_user_assessment_state(user):
    """Single server-side source of truth for the three UI states the
    navbar-adjacent pages (home hero, Assessment Hub) branch on:

        'none'         — nothing started yet
        'in_progress'  — an incomplete session exists (offer Resume/Continue)
        'completed'    — a finished session exists and nothing is in progress

    An in-progress session always wins over a past completed one, so a user
    mid-retake is offered Continue/Resume rather than Start New. `resume`
    carries the hub's existing resume payload when (and only when) state is
    'in_progress'."""
    incomplete = get_incomplete_session(user)
    if incomplete:
        return {'state': 'in_progress', 'resume': incomplete}

    has_completed = (
        db.session.query(AssessmentSession.id)
        .filter_by(user_id=user.id, status='completed')
        .first()
        is not None
    )
    return {'state': 'completed' if has_completed else 'none', 'resume': None}


def get_dashboard_payload(user):
    """Only a fully completed session counts — matches the existing
    sessionStorage-based rule (progress.assessmentCompleted) that decides
    the empty vs populated dashboard state.

    Consumed by GET /api/dashboard, whose response CT.hydrateDashboardData()
    (static/js/cognitrack-core.js) mirrors into the same sessionStorage keys
    dashboard.js already reads — see the INIT block atop dashboard.js for
    the full hydrate-then-render sequence."""
    session = (
        AssessmentSession.query
        .filter_by(user_id=user.id, status='completed')
        .order_by(AssessmentSession.completed_at.desc())
        .first()
    )
    if session is None:
        return None

    modules = {}
    for result in session.results:
        raw = dict(result.raw_data or {})
        duration = raw.pop(_DURATION_KEY, None)
        modules[result.domain] = {
            'assessment': result.domain,
            'startedAt': session.started_at.isoformat(),
            'completedAt': session.completed_at.isoformat() if session.completed_at else None,
            'duration': duration,
            'score': result.score,
            'accuracy': result.accuracy,
            'avgTime': result.average_time,
            'rating': result.rating,
            'rawData': raw,
        }

    return {
        'assessmentId': session.id,
        'user': _profile_payload(user.profile),
        'overallScore': session.overall_score,
        'completedAt': session.completed_at.isoformat() if session.completed_at else None,
        'modules': modules,
    }


def get_history(user):
    sessions = (
        AssessmentSession.query
        .options(selectinload(AssessmentSession.results))
        .filter_by(user_id=user.id, status='completed')
        .order_by(AssessmentSession.completed_at.desc())
        .all()
    )

    return [
        {
            'assessmentId': s.id,
            'completedAt': s.completed_at.isoformat() if s.completed_at else None,
            'overallScore': s.overall_score,
            'duration': s.duration,
            'domains': {r.domain: r.score for r in s.results},
        }
        for s in sessions
    ]


def _profile_payload(profile):
    if profile is None:
        return {}
    return {
        'name': profile.full_name,
        'age': profile.age,
        'gender': profile.gender,
        'education': profile.education,
        'dominantHand': profile.dominant_hand,
        'nativeLanguage': profile.native_language,
    }
