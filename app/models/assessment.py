from datetime import datetime, timezone

from ..core.database import db


class AssessmentSession(db.Model):
    """One run through all five modules, from Start Assessment to the final
    results page. Holds the run-level check-in/score/duration; the five
    per-module results live in AssessmentResult, one row per domain."""

    __tablename__ = 'assessment_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True
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

    # Today's Assessment Check-In — temporary, per-session state (never
    # part of the permanent Profile). Collected once per assessment run,
    # immediately before the Overview page. See assessment_service.py
    # start_session()/checkin validation.
    sleep_quality = db.Column(db.String(20), nullable=True)
    stress_level = db.Column(db.String(20), nullable=True)
    hours_slept = db.Column(db.Float, nullable=True)
    caffeine_today = db.Column(db.String(20), nullable=True)
    # Column width (200) predates this becoming an enum (No/Yes/Prefer not
    # to say) — left as-is rather than narrowed by a migration, since a
    # narrowing ALTER on Postgres would fail against any existing row that
    # still holds pre-Sprint-10.5 free-text medication names longer than
    # the new enum values. New writes only ever store the short enum value.
    medication = db.Column(db.String(200), nullable=True)
    # Follow-up shown only when medication == 'yes': whether the medication
    # affects attention/alertness/mood/thinking, per the user's own report —
    # see app/core/cci.py, a CONF-only factor like every other check-in field.
    medication_cognitive_effect = db.Column(db.String(20), nullable=True)
    current_mood = db.Column(db.String(20), nullable=True)
    wearing_glasses = db.Column(db.Boolean, nullable=True)
    distractions = db.Column(db.String(20), nullable=True)
    family_history = db.Column(db.String(20), nullable=True)

    overall_score = db.Column(db.Float, nullable=True)
    duration = db.Column(db.Integer, nullable=True)

    # Research-readiness metadata (Sprint 8 prep) — additive/nullable so
    # existing rows are unaffected. session_metadata holds browser/device/
    # viewport/timezone/resume+refresh counts/idle time/tab visibility/
    # completion mode/attempt number (see cognitrack-core.js
    # collectSessionMetadata()); assessment_version/algorithm_version are
    # plain columns rather than JSON keys because future CCI work needs
    # to filter/join on them directly. See core/versions.py.
    session_metadata = db.Column(db.JSON, nullable=True)
    assessment_version = db.Column(db.String(20), nullable=True)
    algorithm_version = db.Column(db.String(20), nullable=True)

    user = db.relationship('User', back_populates='assessment_sessions')
    results = db.relationship(
        'AssessmentResult', back_populates='assessment_session', cascade='all, delete-orphan'
    )

    __table_args__ = (
        db.CheckConstraint("status IN ('in_progress', 'completed')", name='ck_assessment_sessions_status'),
        db.CheckConstraint(
            'overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)',
            name='ck_assessment_sessions_overall_score_range',
        ),
        db.CheckConstraint('duration IS NULL OR duration >= 0', name='ck_assessment_sessions_duration_nonneg'),
        db.CheckConstraint(
            'hours_slept IS NULL OR (hours_slept >= 0 AND hours_slept <= 24)',
            name='ck_assessment_sessions_hours_slept_range',
        ),
        # Every dashboard/resume-state query filters by exactly this pair
        # (get_incomplete_session, get_user_assessment_state, get_dashboard_payload).
        db.Index('ix_assessment_sessions_user_id_status', 'user_id', 'status'),
    )

    def __repr__(self):
        return f'<AssessmentSession id={self.id} user_id={self.user_id} status={self.status!r}>'


class AssessmentResult(db.Model):
    """One module's outcome (domain, score, accuracy, raw telemetry) within
    a session. Note: per-module elapsed time is NOT a column here — it's
    stashed in raw_data[assessment_service._DURATION_KEY] to avoid a schema
    change for one derived field. That's separate from
    AssessmentSession.duration, which is the whole run's elapsed time."""

    __tablename__ = 'assessment_results'

    id = db.Column(db.Integer, primary_key=True)
    assessment_id = db.Column(
        db.Integer,
        db.ForeignKey('assessment_sessions.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )

    domain = db.Column(db.String(30), nullable=False)
    score = db.Column(db.Float, nullable=True)
    accuracy = db.Column(db.Float, nullable=True)
    average_time = db.Column(db.Float, nullable=True)
    rating = db.Column(db.String(20), nullable=True)
    raw_data = db.Column(db.JSON, nullable=True)

    # Which version of this module's game logic produced this result —
    # each of the 5 modules can be redesigned independently of the
    # others (see core/versions.py GAME_VERSIONS). Additive/nullable.
    game_version = db.Column(db.String(20), nullable=True)

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    assessment_session = db.relationship('AssessmentSession', back_populates='results')

    __table_args__ = (
        db.UniqueConstraint('assessment_id', 'domain', name='uq_assessment_results_assessment_id_domain'),
        db.CheckConstraint('score IS NULL OR (score >= 0 AND score <= 100)', name='ck_assessment_results_score_range'),
        db.CheckConstraint(
            'accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)', name='ck_assessment_results_accuracy_range'
        ),
    )

    def __repr__(self):
        return f'<AssessmentResult id={self.id} assessment_id={self.assessment_id} domain={self.domain!r}>'
