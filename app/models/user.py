from datetime import datetime, timezone

from flask_login import UserMixin

from ..core.database import db


class User(db.Model, UserMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_login = db.Column(db.DateTime(timezone=True), nullable=True)

    profile = db.relationship(
        'Profile', back_populates='user', uselist=False, cascade='all, delete-orphan'
    )
    assessment_sessions = db.relationship(
        'AssessmentSession', back_populates='user', cascade='all, delete-orphan'
    )
