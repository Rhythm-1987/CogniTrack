from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from ..core.extensions import limiter
from ..services import auth_service

auth_bp = Blueprint('auth', __name__)


def _safe_next_url(candidate):
    """Only allow same-site, path-relative redirects — blocks the
    classic open-redirect via a crafted ?next= value."""
    if candidate and candidate.startswith('/') and not candidate.startswith('//'):
        return candidate
    return url_for('main.index')


@auth_bp.route('/login', methods=['GET'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('assessment.hub'))
    return render_template('pages/login.html')


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute')
def login_post():
    email = request.form.get('email', '').strip()
    password = request.form.get('password', '')
    next_url = _safe_next_url(request.form.get('next', ''))

    result = auth_service.login_user(email, password)

    if not result['success']:
        flash(result['message'], 'danger')
        return redirect(url_for('auth.login'))

    flash('Welcome back!', 'success')
    return redirect(next_url)


@auth_bp.route('/register', methods=['GET'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('assessment.hub'))
    return render_template('pages/register.html')


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('5 per minute')
def register_post():
    full_name = request.form.get('full_name', '').strip()
    email = request.form.get('email', '').strip()
    password = request.form.get('password', '')
    confirm_password = request.form.get('confirm_password', '')

    result = auth_service.register_user(email, password, full_name, confirm_password)

    if not result['success']:
        flash(result['message'], 'danger')
        return redirect(url_for('auth.register'))

    flash('Account created! Welcome to CogniTrack.', 'success')
    return redirect(url_for('assessment.hub'))


@auth_bp.route('/logout', methods=['POST'])
def logout():
    auth_service.logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.index'))


@auth_bp.route('/profile')
@login_required
def profile():
    return render_template('pages/profile.html')
