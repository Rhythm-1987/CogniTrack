from flask import Flask, render_template_string

from .config import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    from .routes.main import main_bp
    from .routes.assessment import assessment_bp
    from .routes.dashboard import dashboard_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(assessment_bp)
    app.register_blueprint(dashboard_bp)

    @app.errorhandler(404)
    def not_found(e):
        return render_template_string(
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Page Not Found — CogniTrack</title>'
            '<style>body{font-family:sans-serif;display:flex;align-items:center;'
            'justify-content:center;min-height:100vh;margin:0;background:#F8FAFC;}'
            '.box{text-align:center;padding:2rem;}h1{font-size:3rem;margin:0;color:#0F172A;}'
            'p{color:#64748B;margin:1rem 0;}a{color:#2563EB;font-weight:600;}'
            '</style></head><body><div class="box">'
            '<h1>404</h1><p>Page not found.</p>'
            '<a href="/">Back to Home</a></div></body></html>'
        ), 404

    return app
