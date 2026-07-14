from flask import Blueprint, render_template
from flask_login import current_user

from ..services import assessment_service

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    # Drives the hero CTA: 'none' (Start), 'in_progress' (Continue), or
    # 'completed' (Start New). Guests are always 'none' — Start Assessment.
    assessment_state = 'none'
    if current_user.is_authenticated:
        assessment_state = assessment_service.get_user_assessment_state(current_user)['state']
    return render_template('pages/index.html', assessment_state=assessment_state)


@main_bp.route('/user')
def user():
    return render_template('pages/user.html')


@main_bp.route('/privacy')
def privacy():
    return render_template('pages/privacy.html')


@main_bp.route('/terms')
def terms():
    return render_template('pages/terms.html')


@main_bp.route('/support')
def support():
    return render_template('pages/support.html')
