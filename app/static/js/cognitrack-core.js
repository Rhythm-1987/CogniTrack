/* ============================================================
   CogniTrack — Core Framework Engine
   cognitrack-core.js   Sprint 4.1 (UI/UX Polish)

   Exposes window.CT with:
     Progress state management  (cognitrack_progress)
     Standardised session writes (cognitrack_session_<module>)
     Results consolidation       (cognitrack_results)
     Unified rating utility
     Button lock / click-friction guard  (CT.lockButton)
     Decelerated transition card  2.7 s  (CT.showTransitionCard)
     Grand finale completion portal      (CT.showFinalePortal)
     Canvas confetti celebration         (CT.launchConfetti)
   ============================================================ */

(function (window) {
  'use strict';

  var CT = {};

  /* ══════════════════════════════════════════════════════════
     SHARED RANDOMISATION UTILITIES
     Used by every module that shuffles word/word-option lists
     or needs a bounded random integer (memory, executive,
     processing, visual), so the same Fisher-Yates + range logic
     isn't reimplemented five times.
  ══════════════════════════════════════════════════════════ */

  CT.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  CT.randInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  /* Renders every [data-lucide] icon on the page as an aria-hidden SVG.
     All icons here are decorative — the interactive element they sit in
     (a button, a link, a badge with visible text) already carries its
     own accessible name, so the icon itself must never expose one. */
  CT.renderIcons = function () {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    }
  };

  /* Linear count-up animation shared by every module's completion
     summary card (memory, attention, executive, processing, visual). */
  CT.animateCounter = function (el, target, duration) {
    if (!el) { return; }
    var dur   = duration || 900;
    var begin = performance.now();
    (function step(now) {
      var p = Math.min((now - begin) / dur, 1);
      el.textContent = Math.round(p * target);
      if (p < 1) { requestAnimationFrame(step); }
    }(performance.now()));
  };

  /* ── Module order + URL / name maps ─────────────────────── */
  var MODULE_ORDER = ['memory', 'attention', 'executive', 'processing', 'spatial'];

  var MODULE_URLS = {
    memory:     '/memory',
    attention:  '/attention',
    executive:  '/executive',
    processing: '/processing',
    spatial:    '/visual',
    dashboard:  '/dashboard'
  };

  var MODULE_NAMES = {
    memory:     'Memory Recall',
    attention:  'Focus & Attention',
    executive:  'Decision Making',
    processing: 'Thinking Speed',
    spatial:    'Visual Reasoning'
  };

  /* ── Cognitive domain metadata: icons, metrics, palette ─── */
  var DOMAIN_META = {
    memory: {
      name:     'Memory Recall',
      icon:     'database',
      metric:   'Domain: Encoding, Storage & Recall',
      duration: 'Est. 3–4 Minutes'
    },
    attention: {
      name:     'Focus & Attention',
      icon:     'crosshair',
      metric:   'Domain: Reaction Time & Focus Consistency',
      duration: 'Est. 1–2 Minutes'
    },
    executive: {
      name:     'Decision Making',
      icon:     'sliders',
      metric:   'Domain: Inhibitory Control & Cognitive Flexibility',
      duration: 'Est. 1–2 Minutes'
    },
    processing: {
      name:     'Thinking Speed',
      icon:     'activity',
      metric:   'Domain: Symbol Substitution & Decision Velocity',
      duration: 'Est. 1–2 Minutes'
    },
    spatial: {
      name:     'Visual Reasoning',
      icon:     'box',
      metric:   'Domain: Mental Rotation & Spatial Orientation',
      duration: 'Est. 2–3 Minutes'
    },
    dashboard: {
      name:     'Results Dashboard',
      icon:     'layout-dashboard',
      metric:   'Domain: Comprehensive Cognitive Profile',
      duration: 'Viewing your results'
    }
  };

  /* ── Rotating diagnostic strings (800 ms cycle) ─────────── */
  var ANALYTICAL_MESSAGES = [
    'Analyzing recall matrix…',
    'Calculating spatial rotation variance…',
    'Isolating reaction velocity…',
    'Synchronizing telemetry profiles…',
    'Processing cognitive load indices…',
    'Calibrating performance benchmarks…'
  ];

  /* ══════════════════════════════════════════════════════════
     PROGRESS STATE  (cognitrack_progress)
  ══════════════════════════════════════════════════════════ */

  var PROGRESS_KEY = 'cognitrack_progress';

  CT.loadProgress = function () {
    try {
      var raw = sessionStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  CT.saveProgress = function (data) {
    try {
      sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch (e) { console.warn('CogniTrack storage error:', e); }
  };

  /* Creates the progress record — and with it, assessmentStarted — the
     first time it's called; a no-op on every call after that. Called
     from exactly one user-facing place: the "Begin Assessment" click on
     the Assessment Overview page (assessment.js), which is the true
     start of the assessment. updateStage()/completeModule() also fall
     back to it so a module page never crashes on missing progress, but
     in the normal flow the record already exists by the time either runs. */
  CT.initProgress = function () {
    var existing = CT.loadProgress();
    if (existing) { return existing; }

    var progress = {
      currentModule:       'memory',
      currentStage:        0,
      moduleState:         {},
      modules: {
        memory:     false,
        attention:  false,
        executive:  false,
        processing: false,
        spatial:    false
      },
      completedCount:      0,
      assessmentStarted:   new Date().toISOString(),
      assessmentCompleted: null
    };

    CT.saveProgress(progress);
    return progress;
  };

  CT.updateStage = function (module, stage, extraState) {
    var p = CT.loadProgress() || CT.initProgress();
    p.currentModule = module;
    p.currentStage  = stage;

    if (extraState) {
      p.moduleState = p.moduleState || {};
      p.moduleState[module] = extraState;
    }

    CT.saveProgress(p);
  };

  CT.getModuleState = function (module) {
    var p = CT.loadProgress();
    if (!p || !p.moduleState) { return null; }
    return p.moduleState[module] || null;
  };

  CT.completeModule = function (module) {
    var p = CT.loadProgress() || CT.initProgress();

    if (!p.modules[module]) {
      p.modules[module] = true;
      p.completedCount  = MODULE_ORDER.filter(function (m) { return p.modules[m]; }).length;
    }

    if (p.moduleState) { delete p.moduleState[module]; }

    if (p.completedCount === MODULE_ORDER.length && !p.assessmentCompleted) {
      p.assessmentCompleted = new Date().toISOString();
    }

    CT.saveProgress(p);
  };

  /* No progress yet means the assessment hasn't started (assessmentStarted
     is only set when Begin Assessment is clicked — see assessment.js), so
     the "next" module is simply the first one, not the dashboard. */
  CT.getNextModuleUrl = function () {
    var p = CT.loadProgress();
    if (!p) { return MODULE_URLS[MODULE_ORDER[0]]; }

    for (var i = 0; i < MODULE_ORDER.length; i++) {
      var m = MODULE_ORDER[i];
      if (!p.modules[m]) { return MODULE_URLS[m]; }
    }

    return MODULE_URLS.dashboard;
  };

  CT.getNextModuleName = function () {
    var p = CT.loadProgress();
    if (!p) { return MODULE_NAMES[MODULE_ORDER[0]]; }

    for (var i = 0; i < MODULE_ORDER.length; i++) {
      var m = MODULE_ORDER[i];
      if (!p.modules[m]) { return MODULE_NAMES[m]; }
    }

    return 'Dashboard';
  };

  CT.getNextModuleKey = function () {
    var p = CT.loadProgress();
    if (!p) { return 'memory'; }

    for (var i = 0; i < MODULE_ORDER.length; i++) {
      var m = MODULE_ORDER[i];
      if (!p.modules[m]) { return m; }
    }

    return 'dashboard';
  };

  /* ══════════════════════════════════════════════════════════
     UNIFIED RATING SCALE
       90+   → Excellent  (↑ Above Average)
       75–89 → Good
       60–74 → Average
       <60   → Needs Review
  ══════════════════════════════════════════════════════════ */

  CT.getRating = function (score) {
    if (score >= 90) {
      return { label: 'Excellent',    sub: '↑ Above Average',       cls: 'excellent'    };
    }
    if (score >= 75) {
      return { label: 'Good',         sub: 'Within Normal Range',        cls: 'good'         };
    }
    if (score >= 60) {
      return { label: 'Average',      sub: 'Room for Improvement',       cls: 'average'      };
    }
    return   { label: 'Needs Review', sub: 'Consider Re-assessment',     cls: 'needs-review' };
  };

  /* ══════════════════════════════════════════════════════════
     STANDARDISED SESSION DATA CONTRACT
     Writes cognitrack_session_<module> in the unified schema.
  ══════════════════════════════════════════════════════════ */

  /* storageKey is optional and used only by CT.loadDemoData() to write
     into the separate demo namespace below — every real module call
     (memory.js, attention.js, executive.js, processing.js, visual.js)
     passes exactly the same 6 arguments as before and is unaffected. */
  CT.writeSession = function (module, startedAt, score, accuracy, avgTime, rawData, storageKey) {
    var completedAt = new Date().toISOString();
    var startMs     = startedAt ? new Date(startedAt).getTime() : Date.now();
    var duration    = parseFloat(((Date.now() - startMs) / 1000).toFixed(1));

    score    = Math.max(0, Math.min(100, Math.round(score)));
    accuracy = Math.max(0, Math.min(100, Math.round(accuracy)));

    var ratingObj = CT.getRating(score);

    var session = {
      assessment:  module,
      startedAt:   startedAt || completedAt,
      completedAt: completedAt,
      duration:    duration,
      score:       score,
      accuracy:    accuracy,
      avgTime:     Math.round(avgTime || 0),
      rating:      ratingObj.label,
      rawData:     rawData || {}
    };

    try {
      sessionStorage.setItem(storageKey || ('cognitrack_session_' + module), JSON.stringify(session));
    } catch (e) { console.warn('CogniTrack storage error:', e); }

    return session;
  };

  /* ══════════════════════════════════════════════════════════
     RESULTS CONSOLIDATION  (cognitrack_results)
     Triggered when the spatial module completes.
  ══════════════════════════════════════════════════════════ */

  CT.consolidateResults = function () {
    var sessions = {};
    var scores   = [];

    MODULE_ORDER.forEach(function (m) {
      try {
        var raw = sessionStorage.getItem('cognitrack_session_' + m);
        if (raw) {
          var s = JSON.parse(raw);
          sessions[m] = s;
          scores.push(typeof s.score === 'number' ? s.score : 0);
        }
      } catch (e) {}
    });

    var overallScore = scores.length
      ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length)
      : 0;

    var overall = CT.getRating(overallScore);

    var results = {
      completedAt:   new Date().toISOString(),
      overallScore:  overallScore,
      overallRating: overall.label,
      overallSub:    overall.sub,
      modules:       sessions
    };

    try {
      sessionStorage.setItem('cognitrack_results', JSON.stringify(results));
    } catch (e) {}

    return results;
  };

  /* ══════════════════════════════════════════════════════════
     DEMO MODE
     Demo data lives in a completely separate sessionStorage
     namespace ("cognitrack_demo_*") from real data
     ("cognitrack_*"). They never share a key, so writing demo
     data can never overwrite or interfere with a real session —
     and a plain visit to /dashboard, which only ever reads the
     real namespace, can never be silently turned into a demo
     view. The one field the two namespaces share is the storage
     schema itself: CT.writeSession() builds both, so a demo
     session is byte-for-byte the same shape as a real one
     without duplicating that shape anywhere.

     CT.loadDemoData() is called from exactly one place in the
     app: the "View Demo Dashboard" button on the empty-dashboard
     state (dashboard.js). Nothing else may call it.
  ══════════════════════════════════════════════════════════ */

  var DEMO_PREFIX = 'cognitrack_demo_';

  CT.DEMO_USER_KEY = DEMO_PREFIX + 'user';

  /* module key -> the demo-namespaced session key dashboard.js reads.
     Mirrors the real cognitrack_session_<module> naming exactly,
     including the historical "spatial" key visual.js actually uses. */
  CT.DEMO_SESSION_KEYS = {
    memory:     DEMO_PREFIX + 'session_memory',
    attention:  DEMO_PREFIX + 'session_attention',
    executive:  DEMO_PREFIX + 'session_executive',
    processing: DEMO_PREFIX + 'session_processing',
    spatial:    DEMO_PREFIX + 'session_spatial'
  };

  var DEMO_USER = {
    name:         'Sarah Williams',
    age:          29,
    gender:       'female',
    education:    'bachelors',
    sleepQuality: 'good',
    dominantHand: 'right'
  };

  /* module key -> { score, accuracy, avgTime (ms), durationSec, rawData }
     rawData shapes mirror exactly what each module's own writeSession
     call sends (verified against memory.js / attention.js / executive.js /
     processing.js / visual.js at the time of writing). */
  var DEMO_MODULES = {

    memory: {
      score: 88, accuracy: 91, avgTime: 0, durationSec: 205,
      rawData: {
        trial1Words:      ['Apple', 'River', 'Chair', 'Candle', 'Ocean'],
        trial2Words:      ['Justice', 'Rhythm', 'Horizon', 'Velvet', 'Whisper', 'Gravity'],
        distractors:      ['Mountain', 'Pencil', 'Journey', 'Crystal', 'Shadow', 'Melody'],
        recallText:       'apple river candle justice velvet whisper gravity ocean',
        recallCount:      8,
        recognitionCount: 10,
        totalTargets:     11,
        recallPct:        73,
        recognitionPct:   91,
        mathAnswered:     3,
        selectedWords:    ['apple', 'river', 'candle', 'ocean', 'justice', 'rhythm', 'velvet', 'whisper', 'gravity', 'horizon']
      }
    },

    attention: {
      score: 92, accuracy: 92, avgTime: 230, durationSec: 95,
      rawData: {
        reactionTimes: [245, 230, 225, 238, 212],
        falseStarts:   0,
        fastest:       212,
        slowest:       245
      }
    },

    executive: {
      score: 84, accuracy: 84, avgTime: 1450, durationSec: 105,
      rawData: {
        questions: 15,
        results: [
          { correct: true,  rt: 920,  congruent: true  },
          { correct: true,  rt: 890,  congruent: true  },
          { correct: true,  rt: 950,  congruent: true  },
          { correct: true,  rt: 1380, congruent: false },
          { correct: true,  rt: 1520, congruent: false },
          { correct: false, rt: 1710, congruent: false },
          { correct: true,  rt: 1440, congruent: false },
          { correct: true,  rt: 1490, congruent: false },
          { correct: true,  rt: 1610, congruent: false },
          { correct: true,  rt: 1380, congruent: false },
          { correct: true,  rt: 1650, congruent: false },
          { correct: false, rt: 1890, congruent: false },
          { correct: true,  rt: 1720, congruent: false },
          { correct: true,  rt: 1590, congruent: false },
          { correct: true,  rt: 1660, congruent: false }
        ],
        congruentAccuracy:   100,
        incongruentAccuracy: 78
      }
    },

    processing: {
      score: 86, accuracy: 85, avgTime: 2100, durationSec: 100,
      rawData: {
        keyMap:    { A: '1', B: '2', C: '3', D: '4' },
        questions: 20,
        totalMs:   42000,
        totalSecs: 42.0,
        results: (function () {
          var wrong = [4, 11, 17];
          var out   = [];
          for (var i = 0; i < 20; i++) {
            out.push({ correct: wrong.indexOf(i) === -1, rt: 1800 + (i % 5) * 120 });
          }
          return out;
        }())
      }
    },

    spatial: {
      score: 90, accuracy: 90, avgTime: 3200, durationSec: 150,
      rawData: {
        questions: 10,
        results: (function () {
          var wrong = [7];
          var out   = [];
          for (var i = 0; i < 10; i++) {
            out.push({ correct: wrong.indexOf(i) === -1, rt: 2800 + (i % 4) * 250 });
          }
          return out;
        }()),
        q1_3Accuracy:  100,
        q4_7Accuracy:  88,
        q8_10Accuracy: 83
      }
    }
  };

  /* Clears the REAL assessment namespace — used before a fresh user
     registration and before "Retake Assessment" from a real dashboard.
     Never touches the demo namespace: a demo view sitting inert in
     storage cannot affect, and is not affected by, a real run. */
  CT.clearAssessmentData = function () {
    var keys = [
      'cognitrack_progress', 'cognitrack_results',
      'cognitrack_session_memory', 'cognitrack_session_attention',
      'cognitrack_session_executive', 'cognitrack_session_processing',
      'cognitrack_session_visual', 'cognitrack_session_spatial'
    ];
    keys.forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (e) {}
    });
  };

  /* Clears only the demo namespace — used before regenerating a fresh
     demo dataset, and before "Retake Assessment" from a demo dashboard. */
  CT.clearDemoData = function () {
    var keys = [CT.DEMO_USER_KEY].concat(
      MODULE_ORDER.map(function (m) { return CT.DEMO_SESSION_KEYS[m]; })
    );
    keys.forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (e) {}
    });
  };

  CT.loadDemoData = function () {
    CT.clearDemoData();

    try { sessionStorage.setItem(CT.DEMO_USER_KEY, JSON.stringify(DEMO_USER)); } catch (e) {}

    MODULE_ORDER.forEach(function (key) {
      var m         = DEMO_MODULES[key];
      var startedAt = new Date(Date.now() - m.durationSec * 1000).toISOString();
      CT.writeSession(key, startedAt, m.score, m.accuracy, m.avgTime, m.rawData, CT.DEMO_SESSION_KEYS[key]);
    });
  };

  /* ══════════════════════════════════════════════════════════
     BUTTON LOCK  — click-friction guard
     Instantly disables a button or anchor and prepends an
     inline loading spinner.  Safe to call on <button>,
     <input type="submit">, and <a> elements.
  ══════════════════════════════════════════════════════════ */

  CT.lockButton = function (el) {
    if (!el || el.classList.contains('btn--loading')) { return; }

    var tag = el.tagName ? el.tagName.toUpperCase() : '';

    if (tag === 'BUTTON' || tag === 'INPUT') {
      el.disabled = true;
    } else {
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('tabindex', '-1');
    }

    el.classList.add('btn--loading');

    var spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    if (el.firstChild) {
      el.insertBefore(spinner, el.firstChild);
    } else {
      el.appendChild(spinner);
    }
  };

  /* ══════════════════════════════════════════════════════════
     DECELERATED MODULE TRANSITION CARD
     Domain-coloured full-screen overlay — 2.7 s total:
       0 ms    overlay fades in  (350 ms CSS)
       150 ms  progress bar begins filling  (2 550 ms CSS ease)
       800 ms  first message rotation
       1 600 ms second rotation
       2 400 ms third rotation
       2 700 ms navigation fires
  ══════════════════════════════════════════════════════════ */

  CT.showTransitionCard = function (nextUrl, nextModuleName) {
    var moduleKey = CT.getNextModuleKey();
    var meta      = DOMAIN_META[moduleKey] || DOMAIN_META.dashboard;

    var overlay = document.createElement('div');
    overlay.className = 'ct-transition-overlay ct-transition-overlay--' + moduleKey;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');

    overlay.innerHTML =
      '<div class="ct-transition-card">' +

        /* ── Header: check icon + two labels ── */
        '<div class="ct-transition-header">' +
          '<div class="ct-transition-check" aria-hidden="true">' +
            '<svg viewBox="0 0 52 52" aria-hidden="true">' +
              '<circle cx="26" cy="26" r="24" fill="none" stroke-width="2.5"/>' +
              '<path d="M13 26l9 9 17-17" fill="none" stroke-linecap="round"' +
                   ' stroke-linejoin="round" stroke-width="2.5"/>' +
            '</svg>' +
          '</div>' +
          '<div class="ct-transition-header-labels">' +
            '<span class="ct-transition-complete-label">Assessment Complete</span>' +
            '<span class="ct-transition-up-next">Up Next</span>' +
          '</div>' +
        '</div>' +

        /* ── Domain preview: icon + name + metric + time ── */
        '<div class="ct-transition-domain">' +
          '<div class="ct-transition-domain-icon" aria-hidden="true">' +
            '<i data-lucide="' + meta.icon + '"></i>' +
          '</div>' +
          '<div class="ct-transition-domain-body">' +
            '<strong class="ct-transition-domain-name">' + meta.name + '</strong>' +
            '<span class="ct-transition-domain-metric">' + meta.metric + '</span>' +
            '<span class="ct-transition-domain-time">' +
              '<svg class="ct-domain-clock" viewBox="0 0 16 16" fill="none"' +
                   ' stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
                '<circle cx="8" cy="8" r="6.5"/>' +
                '<path d="M8 4.5v3.5l2 1.5" stroke-linecap="round"/>' +
              '</svg>' +
              meta.duration +
            '</span>' +
          '</div>' +
        '</div>' +

        /* ── Rotating analytical message ── */
        '<div class="ct-transition-analysis">' +
          '<span class="ct-transition-analysis__dot" aria-hidden="true"></span>' +
          '<span class="ct-transition-analysis__text" id="ct-trans-msg"' +
               ' aria-live="polite" aria-atomic="true">' +
            ANALYTICAL_MESSAGES[0] +
          '</span>' +
        '</div>' +

        /* ── Progress fill bar ── */
        '<div class="ct-transition-bar" aria-hidden="true">' +
          '<div class="ct-transition-bar__fill" id="ct-trans-fill"></div>' +
        '</div>' +

      '</div>';

    document.body.appendChild(overlay);

    /* Render the Lucide icon injected above */
    CT.renderIcons();

    /* Fade in */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('is-visible');
      });
    });

    /* Start progress bar — CSS transition drives the easing */
    setTimeout(function () {
      var fill = document.getElementById('ct-trans-fill');
      if (fill) { fill.style.width = '100%'; }
    }, 150);

    /* Rotate analytical messages every 800 ms */
    var msgIndex    = 0;
    var msgInterval = setInterval(function () {
      msgIndex = (msgIndex + 1) % ANALYTICAL_MESSAGES.length;
      var msgEl = document.getElementById('ct-trans-msg');
      if (msgEl) {
        msgEl.classList.add('is-changing');
        setTimeout(function () {
          if (msgEl) {
            msgEl.textContent = ANALYTICAL_MESSAGES[msgIndex];
            msgEl.classList.remove('is-changing');
          }
        }, 150);
      }
    }, 800);

    /* Navigate at 2 700 ms */
    setTimeout(function () {
      clearInterval(msgInterval);
      window.location.href = nextUrl;
    }, 2700);
  };

  /* ══════════════════════════════════════════════════════════
     GRAND FINALE COMPLETION PORTAL
     Full-screen celebration state shown when Spatial Reasoning
     finishes — replaces the old direct redirect.

     Timeline:
       0 ms    portal appears (450 ms CSS fade)
       400 ms  confetti fires + second burst at 1 200 ms
       300 ms  loading bar begins (2 500 ms CSS ease)
       ~2 800 ms  "profile ready" status text appears
       4 200 ms  navigate to /dashboard
  ══════════════════════════════════════════════════════════ */

  CT.showFinalePortal = function () {
    var portal = document.createElement('div');
    portal.className = 'ct-finale-portal';
    portal.setAttribute('role', 'dialog');
    portal.setAttribute('aria-modal', 'true');
    portal.setAttribute('aria-label', 'All Assessments Complete');

    portal.innerHTML =
      '<div class="ct-finale-inner">' +

        /* ── Five staggered checkmarks ── */
        '<div class="ct-finale-checks" aria-hidden="true">' +
          '<span class="ct-finale-check">✓</span>' +
          '<span class="ct-finale-check ct-finale-check--2">✓</span>' +
          '<span class="ct-finale-check ct-finale-check--3">✓</span>' +
          '<span class="ct-finale-check ct-finale-check--4">✓</span>' +
          '<span class="ct-finale-check ct-finale-check--5">✓</span>' +
        '</div>' +

        /* ── Headline ── */
        '<h1 class="ct-finale-title">Congratulations!</h1>' +
        '<p class="ct-finale-sub">All Assessments Complete</p>' +

        '<hr class="ct-finale-rule" aria-hidden="true"/>' +

        /* ── Report generation block ── */
        '<div class="ct-finale-report">' +
          '<p class="ct-finale-report-label" id="ct-finale-status">' +
            'Generating Comprehensive Cognitive Performance Report…' +
          '</p>' +
          '<div class="ct-finale-progress-wrap">' +
            '<div class="ct-finale-progress-bar"' +
                 ' role="progressbar" aria-valuemin="0" aria-valuemax="100"' +
                 ' aria-valuenow="0" id="ct-finale-bar">' +
              '<div class="ct-finale-progress-fill" id="ct-finale-fill"></div>' +
            '</div>' +
            '<span class="ct-finale-progress-pct" id="ct-finale-pct">0%</span>' +
          '</div>' +
        '</div>' +

      '</div>';

    document.body.appendChild(portal);

    /* Fade in */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        portal.classList.add('is-visible');
      });
    });

    /* Confetti bursts */
    setTimeout(function () { CT.launchConfetti(); }, 400);

    /* Animate progress bar + percentage counter */
    setTimeout(function () {
      var fill  = document.getElementById('ct-finale-fill');
      var pctEl = document.getElementById('ct-finale-pct');
      var barEl = document.getElementById('ct-finale-bar');

      /* CSS transition drives the fill width */
      if (fill) { fill.style.width = '100%'; }

      if (pctEl && barEl) {
        var dur       = 2500;
        var startTime = performance.now();

        (function tick(now) {
          var p   = Math.min((now - startTime) / dur, 1);
          var val = Math.round(p * 100);
          pctEl.textContent = val + '%';
          barEl.setAttribute('aria-valuenow', val);

          if (p < 1) {
            requestAnimationFrame(tick);
          } else {
            var statusEl = document.getElementById('ct-finale-status');
            if (statusEl) { statusEl.textContent = 'Your cognitive profile is ready.'; }
          }
        }(performance.now()));
      }
    }, 300);

    /* Navigate to dashboard */
    setTimeout(function () {
      window.location.href = '/dashboard';
    }, 4200);
  };

  /* ══════════════════════════════════════════════════════════
     CONFETTI BURST
     Prefers canvas-confetti (CDN) — falls back to canvas
     particle system.
  ══════════════════════════════════════════════════════════ */

  CT.launchConfetti = function () {
    if (typeof confetti !== 'undefined') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 } });
      setTimeout(function () {
        confetti({ particleCount: 80, spread: 100, angle: 60,  origin: { x: 0,   y: 0.5 } });
        confetti({ particleCount: 80, spread: 100, angle: 120, origin: { x: 1,   y: 0.5 } });
      }, 350);
      setTimeout(function () {
        confetti({ particleCount: 60, spread: 70,  origin: { y: 0.4 } });
      }, 1200);
      return;
    }

    /* ── Fallback: canvas particle burst ──────────────────── */
    var canvas = document.createElement('canvas');
    canvas.className = 'ct-confetti-canvas';
    canvas.width     = window.innerWidth;
    canvas.height    = window.innerHeight;
    document.body.appendChild(canvas);

    function onResize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize);

    var ctx       = canvas.getContext('2d');
    var colors    = ['#2563EB', '#7C3AED', '#059669', '#F59E0B', '#EF4444', '#0EA5E9', '#EC4899'];
    var particles = [];
    var startTime = performance.now();
    var DURATION  = 3500;

    for (var i = 0; i < 160; i++) {
      particles.push({
        x:     Math.random() * canvas.width,
        y:     -10 - Math.random() * canvas.height * 0.5,
        w:     5  + Math.random() * 9,
        h:     7  + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy:    2  + Math.random() * 5,
        spin:  (Math.random() - 0.5) * 0.18,
        angle: Math.random() * Math.PI * 2,
        swing: (Math.random() - 0.5) * 2.5
      });
    }

    function frame(now) {
      var elapsed = now - startTime;
      if (elapsed > DURATION) { window.removeEventListener('resize', onResize); canvas.remove(); return; }

      var alpha = elapsed < DURATION * 0.75
        ? 1
        : 1 - (elapsed - DURATION * 0.75) / (DURATION * 0.25);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, alpha);

      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.y     += p.vy;
        p.angle += p.spin;
        p.x     += p.swing * Math.sin(p.angle * 2.5);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  };

  /* ── Expose on window ───────────────────────────────────── */
  window.CT = CT;

}(window));
