# CogniTrack

A self-guided, five-domain cognitive assessment built with Flask. CogniTrack runs
five short browser-based tasks — Memory Recall, Focus & Attention, Decision Making,
Thinking Speed, and Visual Reasoning — and turns the results into a scored,
explainable dashboard: a **Cognitive Composite Index (CCI)** score per domain, a
plain-English "Why this score?" breakdown, and a confidence level that reflects
session conditions (sleep, stress, distractions, trial count) without ever
touching the score itself.

CogniTrack is informational and self-insight software, **not** a diagnostic,
clinical, or medical tool — see the in-app Methodology (`/methodology`) and
Terms of Use (`/terms`) pages for the full picture.

## The five assessments

| Module | Route | In the tradition of |
|---|---|---|
| Memory Recall | `/memory` | RAVLT (Farrahi et al. 2023), Corsi Block-Tapping (Kessels et al. 2000) |
| Focus & Attention | `/attention` | Deary-Liewald reaction time task (2011) |
| Decision Making | `/executive` | Stroop task (MacLeod 1991) |
| Thinking Speed | `/processing` | Speed + accuracy composite (Sandry & Ricker 2022) |
| Visual Reasoning | `/visual` | Mental rotation (Shepard & Metzler 1971) |

Every scoring decision either traces back to one of these papers or is flagged
explicitly as an engineering default — see `research/` for the full literature
grounding and `app/core/cci.py` for the scoring engine itself.

## Tech stack

- **Backend**: Flask, SQLAlchemy, Flask-Migrate (Alembic), Flask-Login, Flask-WTF,
  Flask-Limiter
- **Database**: SQLite locally (`app.db`), PostgreSQL in production (`DATABASE_URL`)
- **Frontend**: server-rendered Jinja2 templates, vanilla JS (no framework, no
  build step) — see `app/static/js/cognitrack-core.js` for the shared client
  engine and `app/static/js/dashboard.js` for the dashboard

## Project layout

```
app/
  core/          CCI scoring engine, DB setup, guest sessions, security helpers
  models/        SQLAlchemy models (user, profile, assessment, guest)
  routes/        Flask blueprints (main, auth, assessment, api, dashboard)
  services/      business logic behind the routes
  static/        css/js per page and per assessment module
  templates/     pages/ (Jinja2 templates) + shared navbar/footer/base
research/        literature review, per-domain evidence docs, CCI architecture
migrations/      Alembic migrations
```

## Running locally

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

flask --app run db upgrade    # apply migrations (creates app.db on first run)
python run.py                 # http://localhost:5000
```

Optional `.env` at the repo root (all optional for local dev — see
`app/config.py`):

```
SECRET_KEY=some-random-value
DATABASE_URL=postgresql://...   # defaults to sqlite:///app.db
FLASK_DEBUG=true
```

## Self-checks

`app/core/cci.py` has an inline assertion-based self-check (no test framework
needed):

```bash
python -m app.core.cci
```
