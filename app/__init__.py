from flask import Flask, jsonify, render_template, request

from .config import Config
from .core.database import db
from .core.extensions import csrf, limiter, migrate
from .core.security import login_manager

# Every page in a given section of the app, used to drive a single
# nav_section value the navbar highlights against — one source of
# truth instead of each nav link re-deriving "am I active?" from
# request.path on its own.
ASSESSMENT_FLOW_PATHS = {
    '/assessment', '/assessment/overview', '/user',
    '/memory', '/attention', '/executive', '/processing', '/visual',
}


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # A SECRET_KEY silently falling back to a fresh random value in
    # production means every process/worker signs session cookies
    # differently — users get logged out at random, or (with multiple
    # gunicorn workers) practically every request. Fail loudly at
    # startup instead of shipping that as a live bug. DEBUG-mode local
    # dev is exempt so a fresh checkout still runs without a .env.
    if not app.config['DEBUG'] and not Config.SECRET_KEY_FROM_ENV:
        raise RuntimeError(
            'SECRET_KEY is not set in the environment. Refusing to start '
            'outside DEBUG mode with a randomly-generated key — set a '
            'real SECRET_KEY before deploying.'
        )

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)

    from . import models  # noqa: F401 — registers models on db.metadata for migrations

    from .routes.main import main_bp
    from .routes.assessment import assessment_bp
    from .routes.dashboard import dashboard_bp
    from .routes.auth import auth_bp
    from .routes.api import api_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(assessment_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    @app.context_processor
    def inject_nav_section():
        path = request.path
        if path == '/':
            section = 'home'
        elif path == '/dashboard' or path.startswith('/dashboard/'):
            section = 'dashboard'
        elif path in ASSESSMENT_FLOW_PATHS:
            section = 'assessment'
        else:
            section = None
        return dict(nav_section=section)

    @app.errorhandler(404)
    def not_found(e):
        return render_template('pages/error_404.html'), 404

    @app.errorhandler(500)
    def server_error(e):
        # Any unhandled exception leaves the session mid-transaction —
        # roll back so the next request on this connection isn't stuck
        # behind it, then never leak the exception itself to the client.
        db.session.rollback()
        if request.path.startswith('/api/'):
            return jsonify({'error': 'An unexpected error occurred. Please try again.'}), 500
        return render_template('pages/error_500.html'), 500

    return app
