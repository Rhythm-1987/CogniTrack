from ..core.database import db


class Profile(db.Model):
    """Permanent, one-per-user demographic metadata — set at registration,
    editable on the Profile page. Distinct from the per-session "Today's
    Assessment Check-In" fields on AssessmentSession, which are collected
    fresh on every run instead of stored once here."""

    __tablename__ = 'profiles'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False
    )

    full_name = db.Column(db.String(120), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    # gender/education/dominant_hand are free-text columns, but only ever
    # written from a fixed option set — see GENDER_VALUES/EDUCATION_VALUES/
    # HAND_VALUES in services/profile_service.py, the actual source of truth.
    gender = db.Column(db.String(30), nullable=True)
    education = db.Column(db.String(50), nullable=True)
    dominant_hand = db.Column(db.String(20), nullable=True)
    native_language = db.Column(db.String(60), nullable=True)

    user = db.relationship('User', back_populates='profile')

    __table_args__ = (
        db.CheckConstraint('age IS NULL OR (age >= 1 AND age <= 120)', name='ck_profiles_age_range'),
    )

    def __repr__(self):
        return f'<Profile id={self.id} user_id={self.user_id}>'
