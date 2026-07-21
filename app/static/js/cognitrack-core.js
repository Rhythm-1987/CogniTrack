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
      metric:   'Domain: Encoding, Interference & Recognition',
      duration: 'Est. 1–2 Minutes'
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
      /* Local completion (modules) is tracked separately from confirmed
         server persistence (serverSynced/assessmentSynced) — see
         CT.syncModule / CT.ensureAssessmentId below. This is what lets a
         revisit of an already-completed module tell "answered" apart
         from "safely saved" without re-hitting the network needlessly. */
      serverSynced:        {},
      assessmentSynced:    false,
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

  /* ══════════════════════════════════════════════════════════
     DATABASE SYNC
     The database is the source of truth for every run now, guest or
     signed-in — sessionStorage remains a fast local cache either way.
     Which table a request lands in (assessment_sessions/_results vs
     guest_assessment_sessions/_results) is decided purely by apiPrefix()
     below, itself driven by body.data-auth (set server-side).
  ══════════════════════════════════════════════════════════ */

  CT.isAuthenticated = function () {
    return document.body && document.body.getAttribute('data-auth') === 'true';
  };

  /* '/api/assessment' for a signed-in user, '/api/guest/assessment' for a
     guest — same three sub-paths (/start, /save, /complete) either way. */
  function apiPrefix() {
    return CT.isAuthenticated() ? '/api/assessment' : '/api/guest/assessment';
  }

  /* Static, one-time research context sent alongside /start — see
     models/assessment.py session_metadata. Best-effort: any of these
     can legitimately be unavailable in a given browser, so every read
     is guarded rather than letting a missing API throw. */
  CT.collectSessionMetadata = function () {
    var timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

    return {
      browser: navigator.userAgent || '',
      device: /Mobi|Android/i.test(navigator.userAgent || '') ? 'mobile' : 'desktop',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timezone: timezone
    };
  };

  /* Every rejection carries the HTTP status (and parsed JSON body, if
     any) on the Error object, so callers can tell a transient failure
     (retry it) apart from a deliberate, idempotent 409 ("this was
     already saved/completed" — see CT.syncModule) apart from a genuine
     validation error. */
  var REQUEST_TIMEOUT_MS = 15000;

  /* Without this, a hung connection (dead wifi, stalled proxy) never
     resolves or rejects — the caller's retry banner never appears and
     the UI is stuck waiting on a promise that will never settle. The
     abort turns that into an ordinary rejection, which flows into the
     same attemptWithRetry() backoff/banner path as any other failure. */
  function apiRequest(url, options) {
    var timeoutId = null;
    if (typeof AbortController !== 'undefined') {
      var controller = new AbortController();
      options.signal = controller.signal;
      timeoutId = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    }

    return fetch(url, options).then(function (res) {
      if (timeoutId) { clearTimeout(timeoutId); }
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          err.body   = data;
          throw err;
        }
        return data;
      });
    }, function (err) {
      if (timeoutId) { clearTimeout(timeoutId); }
      throw err;
    });
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function apiPost(url, body) {
    return apiRequest(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken()
      },
      body: JSON.stringify(body || {})
    });
  }

  /* Exposed (unlike apiPost) because dashboard.js is the one caller
     outside this file that needs a plain authenticated GET — reusing
     this keeps it on the same timeout/error-shape contract as every
     other request instead of dashboard.js reimplementing fetch. */
  CT.apiGet = function (url) {
    return apiRequest(url, { credentials: 'same-origin' });
  };

  /* Persistent, undismissable-until-resolved banner — reuses the exact
     .flash-stack/.flash/.flash--danger markup the server already renders
     for flash messages (style.css § 31), so a fetch failure looks native
     to the app instead of introducing a new visual language. message is
     optional — callers with a more specific failure (e.g. "couldn't
     start your assessment" vs "couldn't save your results") can override
     the default copy. */
  function showSyncError(retry, message) {
    var stack = document.getElementById('ct-sync-flash-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'flash-stack';
      stack.id = 'ct-sync-flash-stack';
      document.body.appendChild(stack);
    }
    stack.innerHTML = '';

    var flash = document.createElement('div');
    flash.className = 'flash flash--danger';
    flash.setAttribute('role', 'alert');
    flash.innerHTML =
      '<i data-lucide="alert-triangle"></i>' +
      '<span>' + (message || 'We couldn\'t save your results. Check your connection and try again.') + '</span>' +
      '<button type="button" class="btn btn--primary btn--sm">Retry</button>';

    flash.querySelector('button').addEventListener('click', function () {
      flash.remove();
      retry();
    });

    stack.appendChild(flash);
    CT.renderIcons();
  }

  function clearSyncError() {
    var stack = document.getElementById('ct-sync-flash-stack');
    if (stack) { stack.innerHTML = ''; }
  }

  /* Automatic backoff schedule (ms) used by attemptWithRetry — caps at
     30 s so a long outage still retries at a steady, unobtrusive pace
     instead of hammering the server or giving up. */
  var AUTO_RETRY_DELAYS = [2000, 4000, 8000, 15000, 30000];

  /* Retries taskFn (a zero-arg function returning a Promise) until it
     resolves. Never rejects: a transient failure only ever produces a
     longer wait behind the shared retry banner, so a completed answer
     can never be silently dropped or mistaken for "saved" when it
     wasn't. The banner's own Retry button short-circuits the current
     backoff wait for an immediate retry. */
  function attemptWithRetry(taskFn, message) {
    return new Promise(function (resolve) {
      var attemptIndex = 0;
      var timerId       = null;

      function tryNow() {
        taskFn().then(function (result) {
          if (timerId) { clearTimeout(timerId); timerId = null; }
          clearSyncError();
          resolve(result);
        }).catch(function (err) {
          /* A 401 means the server-side session has expired or been
             invalidated — retrying can never succeed without logging
             back in, so retrying it forever like a transient network
             error just strands the user on a permanent "couldn't save"
             banner with no way to proceed. Send them to log back in
             instead; ?next= brings them right back here afterward. */
          if (err && err.status === 401) {
            if (timerId) { clearTimeout(timerId); timerId = null; }
            var next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = '/login?next=' + next;
            return;
          }

          var delay = AUTO_RETRY_DELAYS[Math.min(attemptIndex, AUTO_RETRY_DELAYS.length - 1)];
          attemptIndex++;
          showSyncError(function () {
            if (timerId) { clearTimeout(timerId); timerId = null; }
            tryNow();
          }, message);
          timerId = setTimeout(tryNow, delay);
        });
      }

      tryNow();
    });
  }

  /* ── Run-level research metadata: refresh/resume counts, idle time ──
     Accumulated centrally here (not per-module) so none of the 5
     module scripts need to know about it — a page reload mid-module is
     detectable from the Navigation Timing API alone, and tab hiding is
     a single document-level event regardless of which module is open.
     Read once by collectRunMetadata() and sent with the final
     /complete call (see completeTask above). */

  (function trackRunMetadata() {
    function activeProgress() {
      var p = CT.loadProgress();
      if (!p || !p.assessmentStarted || p.assessmentCompleted) { return null; }
      return p;
    }

    var p = activeProgress();
    if (p) {
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
      if (nav && nav.type === 'reload') {
        p.refreshCount = (p.refreshCount || 0) + 1;
        CT.saveProgress(p);
      }
    }

    var hiddenAt = null;
    document.addEventListener('visibilitychange', function () {
      var progress = activeProgress();
      if (!progress) { return; }

      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt) {
        progress.idleTimeMs = (progress.idleTimeMs || 0) + (Date.now() - hiddenAt);
        hiddenAt = null;
        CT.saveProgress(progress);
      }
    });
  }());

  function collectRunMetadata() {
    var p = CT.loadProgress();
    return {
      refreshCount: (p && p.refreshCount) || 0,
      resumeCount: (p && p.resumeCount) || 0,
      idleTimeMs: (p && p.idleTimeMs) || 0
    };
  }

  /* ── Server-confirmed persistence tracking ──────────────────
     Deliberately separate from progress.modules (which only means "the
     user finished answering"). A module can be locally complete while
     its save is still in flight/retrying — these flags only ever flip
     once the database has actually acknowledged the write, and are what
     CT.syncModule uses to skip redundant network calls on a revisit. */

  CT.isModuleSynced = function (module) {
    var p = CT.loadProgress();
    return !!(p && p.serverSynced && p.serverSynced[module]);
  };

  function markModuleSynced(module) {
    var p = CT.loadProgress() || CT.initProgress();
    p.serverSynced = p.serverSynced || {};
    p.serverSynced[module] = true;
    CT.saveProgress(p);
  }

  CT.isAssessmentSynced = function () {
    var p = CT.loadProgress();
    return !!(p && p.assessmentSynced);
  };

  function markAssessmentSynced() {
    var p = CT.loadProgress() || CT.initProgress();
    p.assessmentSynced = true;
    CT.saveProgress(p);
  }

  function startSessionTask() {
    var checkin = {};
    try {
      var raw = sessionStorage.getItem('cognitrack_checkin');
      if (raw) { checkin = JSON.parse(raw); }
    } catch (e) {}

    var body = { checkin: checkin, metadata: CT.collectSessionMetadata() };

    if (!CT.isAuthenticated()) {
      /* Guests only — optional demographics collected on the Check-In
         page (see checkin.js), upserted onto this guest's GuestProfile. */
      try {
        var rawProfile = sessionStorage.getItem('cognitrack_guest_profile');
        if (rawProfile) { body.profile = JSON.parse(rawProfile); }
      } catch (e) {}
    }

    return apiPost(apiPrefix() + '/start', body);
  }

  /* Resolves once the current progress record has a server-confirmed
     assessment_id — retrying indefinitely (behind the shared sync
     banner) rather than ever letting a caller proceed without one.
     Guest or signed-in, an assessment is only ever "started" once the
     database agrees; this is also the self-heal path CT.syncModule
     falls back to if a module page is somehow reached without one.

     assessmentIdIsGuest guards against reusing a stale id across an
     auth-status change mid-assessment (a guest logging in via the
     navbar): guest_assessment_sessions and assessment_sessions are
     different tables with independent id sequences, so an id issued
     under one can never be reused under the other. When a mismatch is
     detected, every serverSynced flag is dropped too — those refer to
     saves made against the old (guest) session, not the fresh one about
     to be created — so every locally-completed module gets freshly
     re-submitted against the new, correctly-owned session. */
  CT.ensureAssessmentId = function () {
    var p = CT.loadProgress();
    var isGuestNow = !CT.isAuthenticated();

    if (p && p.assessmentId != null && p.assessmentIdIsGuest === isGuestNow) {
      return Promise.resolve(p.assessmentId);
    }

    if (p && p.assessmentId != null) {
      p.assessmentId = null;
      p.serverSynced = {};
      p.assessmentSynced = false;
      CT.saveProgress(p);
    }

    return attemptWithRetry(
      startSessionTask,
      "We couldn't start your assessment. Check your connection and try again."
    ).then(function (result) {
      var pp = CT.loadProgress() || CT.initProgress();
      pp.assessmentId = result.assessment_id;
      pp.assessmentIdIsGuest = isGuestNow;
      CT.saveProgress(pp);
      return pp.assessmentId;
    });
  };

  /* The single entry point for "Begin Assessment". Creates the local
     progress record (a no-op if one already exists) and blocks until
     the server confirms an assessment_id — guest or signed-in, a
     caller must never navigate to Module 1 before this resolves. */
  CT.beginAssessment = function () {
    CT.initProgress();
    return CT.ensureAssessmentId();
  };

  /* Replaces a bare CT.completeModule(module) call. Marks the module
     complete locally (unchanged behaviour — this is the "answered"
     flag, not the "saved" flag), then persists the result that
     CT.writeSession() just wrote to sessionStorage. On the final module
     it also finalises the session server-side. onDone (the existing
     showTransitionCard/showFinalePortal call) only fires once the save
     has actually been confirmed by the server, so a network failure can
     never silently drop a completed module's results, and a module that
     was already confirmed synced (a revisit, a double-click, two tabs)
     is never re-submitted. Guest or signed-in, every module now syncs
     the same way — apiPrefix()/ensureAssessmentId() decide which table
     it lands in. */
  CT.syncModule = function (module, onDone) {
    CT.completeModule(module);

    var session = CT.readSession(module);

    if (!session) {
      /* CT.writeSession() always runs immediately before CT.syncModule()
         in every module — this should be unreachable, but there is
         nothing to retry a save against, so proceed locally rather than
         retrying forever against a payload that doesn't exist. */
      console.warn('CogniTrack: no session data to sync for', module);
      onDone();
      return;
    }

    function saveTask() {
      if (CT.isModuleSynced(module)) { return Promise.resolve(); }
      return CT.ensureAssessmentId().then(function (assessmentId) {
        return apiPost(apiPrefix() + '/save', {
          assessment_id: assessmentId,
          domain:        module,
          score:         session.score,
          accuracy:      session.accuracy,
          average_time:  session.avgTime,
          rating:        session.rating,
          raw_data:      session.rawData,
          duration:      session.duration
        });
      }).then(function () {
        markModuleSynced(module);
      }).catch(function (err) {
        /* 409 = the server already has this result (e.g. the assessment
           was already finalised by an earlier attempt) — that is success
           from this client's point of view, not a failure to retry. */
        if (err && err.status === 409) { markModuleSynced(module); return; }
        throw err;
      });
    }

    function completeTask() {
      var p = CT.loadProgress();
      var isLastModule = !!(p && p.completedCount === MODULE_ORDER.length);
      if (!isLastModule || CT.isAssessmentSynced()) { return Promise.resolve(); }

      return CT.ensureAssessmentId().then(function (assessmentId) {
        return apiPost(apiPrefix() + '/complete', {
          assessment_id: assessmentId,
          metadata: collectRunMetadata()
        });
      }).then(function () {
        markAssessmentSynced();
      }).catch(function (err) {
        if (err && err.status === 409) { markAssessmentSynced(); return; }
        throw err;
      });
    }

    attemptWithRetry(function () {
      return saveTask().then(completeTask);
    }).then(onDone);
  };

  /* Backfills any locally-completed module that hasn't reached the
     server yet — a save that failed to sync earlier, or (guest logging
     in mid-assessment via the navbar) modules synced under the old
     guest session. CT.syncModule only pushes the module it's called
     for, so without this a module could stay in sessionStorage forever
     without a matching DB row. Safe to call any time: already-synced
     modules are skipped, and a redundant call is a no-op via
     CT.syncModule's own idempotency; the auth-mismatch check inside
     CT.ensureAssessmentId is what makes a guest->auth transition
     re-sync everything instead of being skipped as "already synced". */
  CT.syncUnsyncedModules = function () {
    var p = CT.loadProgress();
    if (!p || !p.modules) { return; }

    MODULE_ORDER.forEach(function (m) {
      if (p.modules[m] && !CT.isModuleSynced(m)) {
        CT.syncModule(m, function () {});
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    CT.syncUnsyncedModules();
  });

  /* ── Unsaved-work warning ────────────────────────────────────
     Opt-in per page (called from each of the 5 assessment module
     scripts) so pages with no in-progress trial data — hub, dashboard,
     marketing pages — are never affected. CT.clearUnloadWarning() is
     called just before the app's own intentional navigations
     (showTransitionCard / showFinalePortal) so the confirm dialog only
     ever appears for a real accidental close/navigate-away, never for
     the automatic hand-off between modules. */
  var unloadWarningHandler = null;

  CT.warnBeforeUnload = function () {
    if (unloadWarningHandler) { return; }
    unloadWarningHandler = function (e) {
      var p = CT.loadProgress();
      if (p && p.assessmentStarted && !p.assessmentCompleted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unloadWarningHandler);
  };

  CT.clearUnloadWarning = function () {
    if (unloadWarningHandler) {
      window.removeEventListener('beforeunload', unloadWarningHandler);
      unloadWarningHandler = null;
    }
  };

  /* ── Hydration from server-side truth ───────────────────────
     Used on the Assessment Hub (resume) and the Dashboard (results),
     so the DB — not sessionStorage — decides what those pages show.
     Both write into the exact same sessionStorage keys CT already
     uses, so no other rendering code needs to change. */

  CT.hydrateResumeProgress = function (resume) {
    if (!resume) { return; }

    var modules      = {
      memory: false, attention: false, executive: false, processing: false, spatial: false
    };
    /* Every module the server reports as completed is, by definition,
       already durably saved — mark it synced so a later revisit never
       re-POSTs it (see CT.syncModule). */
    var serverSynced = {};
    (resume.completedModules || []).forEach(function (m) { modules[m] = true; serverSynced[m] = true; });
    var completedCount = MODULE_ORDER.filter(function (m) { return modules[m]; }).length;

    /* This rebuilds progress from scratch, so resumeCount (a genuine
       "the user came back to Resume this run" counter) has to be read
       out of whatever progress existed before it's overwritten. */
    var priorResumeCount = (CT.loadProgress() || {}).resumeCount || 0;

    CT.saveProgress({
      currentModule:       resume.nextModule || MODULE_ORDER[0],
      currentStage:        0,
      moduleState:         {},
      modules:             modules,
      serverSynced:        serverSynced,
      assessmentSynced:    false,
      completedCount:      completedCount,
      assessmentStarted:   new Date().toISOString(),
      assessmentCompleted: null,
      assessmentId:        resume.assessmentId,
      assessmentIdIsGuest: !CT.isAuthenticated(),
      resumeCount:         priorResumeCount + 1
    });

    if (resume.user) {
      try { sessionStorage.setItem('cognitrack_user', JSON.stringify(resume.user)); } catch (e) {}
    }
  };

  CT.hydrateDashboardData = function (dashboardData) {
    if (!dashboardData || !dashboardData.modules) { return; }

    try {
      if (dashboardData.user) {
        sessionStorage.setItem('cognitrack_user', JSON.stringify(dashboardData.user));
      }
      Object.keys(dashboardData.modules).forEach(function (domain) {
        sessionStorage.setItem('cognitrack_session_' + domain, JSON.stringify(dashboardData.modules[domain]));
      });
      /* Computed on read server-side (app/core/cci.py) — never persisted,
         so this key is only ever as fresh as the last /api/dashboard or
         /api/guest/dashboard fetch. Absent entirely on older cached
         payloads; every reader must treat it as optional. */
      if (dashboardData.cci) {
        sessionStorage.setItem('cognitrack_cci', JSON.stringify(dashboardData.cci));
      }
    } catch (e) { return; }

    var modules = {
      memory: false, attention: false, executive: false, processing: false, spatial: false
    };
    /* A completed dashboard payload means every module — and the
       assessment itself — is already durably saved server-side. */
    var serverSynced = {};
    Object.keys(dashboardData.modules).forEach(function (d) { modules[d] = true; serverSynced[d] = true; });
    var completedCount = MODULE_ORDER.filter(function (m) { return modules[m]; }).length;
    var completedAt     = dashboardData.completedAt || new Date().toISOString();

    CT.saveProgress({
      currentModule:       'spatial',
      currentStage:        0,
      moduleState:         {},
      modules:             modules,
      serverSynced:        serverSynced,
      assessmentSynced:    true,
      completedCount:      completedCount,
      assessmentStarted:   completedAt,
      assessmentCompleted: completedAt,
      assessmentId:        dashboardData.assessmentId,
      assessmentIdIsGuest: !CT.isAuthenticated()
    });
  };

  /* Single source of truth for "what's the next module" — key, URL, and
     display name in one loadProgress() + one loop, instead of the three
     independent passes CT.getNextModuleUrl/Name/Key used to each do for
     what is always the same answer within a single transition. No
     progress yet means the assessment hasn't started (assessmentStarted
     is only set when Begin Assessment is clicked — see assessment.js),
     so the "next" module is simply the first one, not the dashboard. */
  function nextModuleInfo() {
    var p = CT.loadProgress();
    if (!p) {
      var first = MODULE_ORDER[0];
      return { key: first, url: MODULE_URLS[first], name: MODULE_NAMES[first] };
    }

    for (var i = 0; i < MODULE_ORDER.length; i++) {
      var m = MODULE_ORDER[i];
      if (!p.modules[m]) { return { key: m, url: MODULE_URLS[m], name: MODULE_NAMES[m] }; }
    }

    return { key: 'dashboard', url: MODULE_URLS.dashboard, name: 'Dashboard' };
  }

  CT.getNextModuleUrl  = function () { return nextModuleInfo().url; };
  CT.getNextModuleName = function () { return nextModuleInfo().name; };
  CT.getNextModuleKey  = function () { return nextModuleInfo().key; };

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

  /* Reads and parses cognitrack_session_<module> — the same recovery
     read every module page (memory/attention/executive/processing/
     visual) and consolidateResults() below perform, centralised so the
     try/parse/null-on-failure logic isn't repeated at each call site. */
  CT.readSession = function (module) {
    try {
      var raw = sessionStorage.getItem('cognitrack_session_' + module);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  /* ══════════════════════════════════════════════════════════
     RESULTS CONSOLIDATION  (cognitrack_results)
     Triggered when the spatial module completes.
  ══════════════════════════════════════════════════════════ */

  CT.consolidateResults = function () {
    var sessions = {};
    var scores   = [];

    MODULE_ORDER.forEach(function (m) {
      var s = CT.readSession(m);
      if (s) {
        sessions[m] = s;
        scores.push(typeof s.score === 'number' ? s.score : 0);
      }
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
      score: 91, accuracy: 91, avgTime: 0, durationSec: 95,
      rawData: {
        targetWords:        ['Apple', 'River', 'Chair', 'Candle', 'Ocean', 'Justice', 'Rhythm', 'Horizon', 'Velvet', 'Whisper', 'Gravity'],
        distractors:        ['Mountain', 'Pencil', 'Journey', 'Crystal', 'Shadow', 'Melody'],
        encodingDurationMs: 20000,
        interference: {
          rounds: [
            { length: 3, sequence: [1, 4, 6], taps: [1, 4, 6], tapRTs: [520, 480, 410], correct: true },
            { length: 4, sequence: [0, 3, 7, 2], taps: [0, 3, 7, 2], tapRTs: [560, 610, 470, 500], correct: true },
            { length: 5, sequence: [5, 1, 8, 3, 6], taps: [5, 1, 8, 6, 3], tapRTs: [540, 590, 630, 480, 520], correct: false }
          ],
          correctRounds: 2,
          longestCorrectLength: 4,
          meanTapRT: 528
        },
        recognitionDurationMs: 18000,
        hitCount:           10,
        missCount:          1,
        falsePositiveCount: 0,
        totalTargets:       11,
        recognitionPct:     91,
        selectedWords:      ['apple', 'river', 'candle', 'ocean', 'justice', 'rhythm', 'velvet', 'whisper', 'gravity', 'horizon']
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

  CT.showTransitionCard = function () {
    var info      = nextModuleInfo();
    var moduleKey = info.key;
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
      if (CT.clearUnloadWarning) { CT.clearUnloadWarning(); }
      window.location.href = info.url;
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
    portal.setAttribute('tabindex', '-1');

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

    /* Move focus into the dialog so screen readers announce it —
       there's nothing interactive inside (it auto-navigates away),
       so a full focus trap isn't needed, just the initial landing. */
    portal.focus();

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
      if (CT.clearUnloadWarning) { CT.clearUnloadWarning(); }
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
