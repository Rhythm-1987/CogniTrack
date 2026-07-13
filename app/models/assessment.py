from datetime import datetime, timezone

from ..core.database import db


class AssessmentSession(db.Model):
    __tablename__ = 'assessment_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True
    )

    started_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    status = db.Column(db.String(20), nullable=False, default='in_progress')
    sleep_quality = db.Column(db.String(20), nullable=True)

    overall_score = db.Column(db.Float, nullable=True)
    cci = db.Column(db.Float, nullable=True)
    risk_level = db.Column(db.String(20), nullable=True)
    duration = db.Column(db.Integer, nullable=True)

    user = db.relationship('User', back_populates='assessment_sessions')
    results = db.relationship(
        'AssessmentResult', back_populates='assessment_session', cascade='all, delete-orphan'
    )


class AssessmentResult(db.Model):
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

    assessment_session = db.relationship('AssessmentSession', back_populates='results')
