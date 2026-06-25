import os
import jinja2
from flask import Flask, render_template

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


@app.route('/user')
def user():
    return render_template('user.html')


@app.route('/assessment')
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

if __name__ == '__main__':
    app.run(debug=True)
