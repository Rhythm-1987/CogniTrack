from datetime import datetime, timezone

from flask_login import UserMixin

from ..core.database import db


class User(db.Model, UserMixin):
    """An authenticated account. Guests never get a row here — see
    auth_service.py / assessment_service.py for the guest-vs-authenticated
    split, which is entirely about whether a User row exists at all."""

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
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

    def __repr__(self):
        return f'<User id={self.id} email={self.email!r}>'
