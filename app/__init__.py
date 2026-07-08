from flask import Flask, render_template, request

from .config import Config

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

    from .routes.main import main_bp
    from .routes.assessment import assessment_bp
    from .routes.dashboard import dashboard_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(assessment_bp)
    app.register_blueprint(dashboard_bp)

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

    return app
