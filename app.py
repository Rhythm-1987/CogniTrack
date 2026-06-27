import os
import jinja2
from flask import Flask, render_template, render_template_string

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

# Jinja2 searches these directories in order:
#   templates/ — base.html, navbar.html, footer.html
#   pages/     — index, user, assessment, results, dashboard
#   tests/     — memory, attention, executive, processing, visual
app.jinja_loader = jinja2.ChoiceLoader([
    jinja2.FileSystemLoader(os.path.join(BASE_DIR, 'templates')),
    jinja2.FileSystemLoader(os.path.join(BASE_DIR, 'pages')),
    jinja2.FileSystemLoader(os.path.join(BASE_DIR, 'tests')),
])


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/user', methods=['GET', 'POST'])
def user():
    return render_template('user.html')


@app.route('/assessment', methods=['GET', 'POST'])
def assessment():
    return render_template('assessment.html')


@app.route('/results')
def results():
    return render_template('results.html')


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@app.route('/memory')
def memory():
    return render_template('memory.html')


@app.route('/attention')
def attention():
    return render_template('attention.html')


@app.route('/executive')
def executive():
    return render_template('executive.html')


@app.route('/processing')
def processing():
    return render_template('processing.html')


@app.route('/visual')
def visual():
    return render_template('visual.html')


# ---------------------------------------------------------------------------

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


if __name__ == '__main__':
    _debug = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true')
    app.run(debug=_debug)
