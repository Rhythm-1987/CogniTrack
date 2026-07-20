from datetime import datetime, timezone

from ..core.database import db


class GuestProfile(db.Model):
    """The guest-side counterpart to Profile — one row per anonymous
    browser session (identified by guest_uuid, see core/guest.py), not
    per registered account. Deliberately its own table rather than a
    nullable-user_id row on Profile: guests never get a User row at all
    (see models/user.py), so there is nothing for a guest Profile to
    hang off of, and mixing the two would let an unauthenticated request
    write into the authenticated schema.

    claimed_by_user_id is prep for a future sprint: when a guest later
    registers, that sprint can backfill this FK (and move the guest's
    sessions/results across) to link the anonymous history to the new
    account. Nothing writes to it yet."""

    __tablename__ = 'guest_profiles'

    id = db.Column(db.Integer, primary_key=True)
    guest_uuid = db.Column(db.String(36), unique=True, nullable=False, index=True)

    full_name = db.Column(db.String(120), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    # Same fixed option sets as Profile — see GENDER_VALUES/EDUCATION_VALUES/
    # HAND_VALUES in services/profile_service.py, shared by both.
    gender = db.Column(db.String(30), nullable=True)
    education = db.Column(db.String(50), nullable=True)
    dominant_hand = db.Column(db.String(20), nullable=True)
    native_language = db.Column(db.String(60), nullable=True)

    claimed_by_user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True
    )

    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    sessions = db.relationship(
        'GuestAssessmentSession', back_populates='guest_profile', cascade='all, delete-orphan'
    )

    __table_args__ = (
        db.CheckConstraint('age IS NULL OR (age >= 1 AND age <= 120)', name='ck_guest_profiles_age_range'),
    )

    def __repr__(self):
        return f'<GuestProfile id={self.id} guest_uuid={self.guest_uuid!r}>'


class GuestAssessmentSession(db.Model):
    """Guest-side counterpart to AssessmentSession — structurally
    identical (same check-in columns, status, score/duration, research
    metadata) but owned by a GuestProfile instead of a User. Kept as a
    dedicated table rather than a nullable-owner column on
    AssessmentSession so the authenticated schema is never touched by
    unauthenticated writes. See services/guest_assessment_service.py,
    which reuses assessment_service.py's validation/scoring helpers
    against this table instead of reimplementing them."""

    __tablename__ = 'guest_assessment_sessions'

    id = db.Column(db.Integer, primary_key=True)
    guest_profile_id = db.Column(
        db.Integer, db.ForeignKey('guest_profiles.id', ondelete='CASCADE'), nullable=False, index=True
    )

    started_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    status = db.Column(db.String(20), nullable=False, default='in_progress')

    # Today's Assessment Check-In fields — identical meaning to
    # AssessmentSession's (see models/assessment.py).
    sleep_quality = db.Column(db.String(20), nullable=True)
    stress_level = db.Column(db.String(20), nullable=True)
    hours_slept = db.Column(db.Float, nullable=True)
    caffeine_today = db.Column(db.String(20), nullable=True)
    medication = db.Column(db.String(200), nullable=True)
    current_mood = db.Column(db.String(20), nullable=True)
    wearing_glasses = db.Column(db.Boolean, nullable=True)
    distractions = db.Column(db.String(20), nullable=True)

    overall_score = db.Column(db.Float, nullable=True)
    duration = db.Column(db.Integer, nullable=True)

    session_metadata = db.Column(db.JSON, nullable=True)
    assessment_version = db.Column(db.String(20), nullable=True)
    algorithm_version = db.Column(db.String(20), nullable=True)

    guest_profile = db.relationship('GuestProfile', back_populates='sessions')
    results = db.relationship(
        'GuestAssessmentResult', back_populates='guest_assessment_session', cascade='all, delete-orphan'
    )

    __table_args__ = (
        db.CheckConstraint("status IN ('in_progress', 'completed')", name='ck_guest_assessment_sessions_status'),
        db.CheckConstraint(
            'overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)',
            name='ck_guest_assessment_sessions_overall_score_range',
        ),
        db.CheckConstraint('duration IS NULL OR duration >= 0', name='ck_guest_assessment_sessions_duration_nonneg'),
        db.CheckConstraint(
            'hours_slept IS NULL OR (hours_slept >= 0 AND hours_slept <= 24)',
            name='ck_guest_assessment_sessions_hours_slept_range',
        ),
        db.Index('ix_guest_assessment_sessions_guest_profile_id_status', 'guest_profile_id', 'status'),
    )

    def __repr__(self):
        return f'<GuestAssessmentSession id={self.id} guest_profile_id={self.guest_profile_id} status={self.status!r}>'


class GuestAssessmentResult(db.Model):
    """Guest-side counterpart to AssessmentResult — see models/assessment.py
    for the full field-by-field rationale (identical here)."""

    __tablename__ = 'guest_assessment_results'

    id = db.Column(db.Integer, primary_key=True)
    assessment_id = db.Column(
        db.Integer,
        db.ForeignKey('guest_assessment_sessions.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )

    domain = db.Column(db.String(30), nullable=False)
    score = db.Column(db.Float, nullable=True)
    accuracy = db.Column(db.Float, nullable=True)
    average_time = db.Column(db.Float, nullable=True)
    rating = db.Column(db.String(20), nullable=True)
    raw_data = db.Column(db.JSON, nullable=True)
    game_version = db.Column(db.String(20), nullable=True)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    guest_assessment_session = db.relationship('GuestAssessmentSession', back_populates='results')

    __table_args__ = (
        db.UniqueConstraint(
            'assessment_id', 'domain', name='uq_guest_assessment_results_assessment_id_domain'
        ),
        db.CheckConstraint(
            'score IS NULL OR (score >= 0 AND score <= 100)', name='ck_guest_assessment_results_score_range'
        ),
        db.CheckConstraint(
            'accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)',
            name='ck_guest_assessment_results_accuracy_range',
        ),
    )

    def __repr__(self):
        return f'<GuestAssessmentResult id={self.id} assessment_id={self.assessment_id} domain={self.domain!r}>'
