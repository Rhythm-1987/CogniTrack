/* ============================================================
   CogniTrack — Attention Assessment
   attention.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var TOTAL_ROUNDS        = 5;
  var MIN_DELAY           = 2000;   /* ms — minimum wait before green */
  var MAX_DELAY           = 5000;   /* ms — maximum wait before green */
  var THRESHOLD_EXCELLENT = 250;    /* ms — average RT for Excellent */
  var THRESHOLD_GOOD      = 400;    /* ms — average RT for Good */

  /* ── State ──────────────────────────────────────────────── */
  var currentRound   = 0;       /* 0-based round index */
  var reactionTimes  = [];      /* ms values for each valid round */
  var falseStarts    = 0;       /* total false clicks */
  var waitTimer      = null;    /* holds the setTimeout reference */
  var roundStartTime = 0;       /* performance.now() when circle went green */
  var circleState    = 'idle';  /* idle | waiting | ready | false | clicked */

  /* ── DOM References ─────────────────────────────────────── */
  var phases = {
    intro:   document.getElementById('phase-intro'),
    test:    document.getElementById('phase-test'),
    summary: document.getElementById('phase-summary')
  };

  var phaseBar       = document.getElementById('attn-phase-bar');
  var phaseLabel     = document.getElementById('attn-phase-label');
  var phaseNum       = document.getElementById('attn-phase-num');
  var roundPipsEl    = document.getElementById('round-pips');
  var roundNumEl     = document.getElementById('round-num');
  var statusEl       = document.getElementById('attn-status');
  var circle         = document.getElementById('attn-circle');
  var instructionEl  = document.getElementById('attn-instruction');
  var summaryGridEl  = document.getElementById('attn-summary-grid');
  var perfStatusEl   = document.getElementById('attn-perf-status');

  /* ── Phase config ───────────────────────────────────────── */
  var PHASE_ORDER  = ['intro', 'test', 'summary'];
  var PHASE_LABELS = {
    intro:   'Introduction',
    test:    'Reaction Test',
    summary: 'Summary'
  };

  /* ══════════════════════════════════════════════════════════
     PHASE TRANSITION
  ══════════════════════════════════════════════════════════ */

  function goToPhase(name) {
    Object.keys(phases).forEach(function (key) {
      var el = phases[key];
      if (key === name) {
        el.classList.add('is-active');
        el.removeAttribute('aria-hidden');
      } else {
        el.classList.remove('is-active');
        el.setAttribute('aria-hidden', 'true');
      }
    });

    var idx = PHASE_ORDER.indexOf(name) + 1;
    var pct = Math.round((idx / PHASE_ORDER.length) * 100);
    phaseBar.style.width   = pct + '%';
    phaseLabel.textContent = PHASE_LABELS[name];
    phaseNum.textContent   = idx;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     ROUND PIPS
  ══════════════════════════════════════════════════════════ */

  function buildPips() {
    roundPipsEl.innerHTML = '';
    for (var i = 0; i < TOTAL_ROUNDS; i++) {
      var pip = document.createElement('span');
      pip.className = 'round-pip';
      pip.setAttribute('role', 'listitem');
      pip.setAttribute('aria-label', 'Round ' + (i + 1));
      roundPipsEl.appendChild(pip);
    }
  }

  function updatePips() {
    var pips = roundPipsEl.querySelectorAll('.round-pip');
    pips.forEach(function (pip, i) {
      pip.classList.remove('is-done', 'is-current');
      if (i < currentRound) {
        pip.classList.add('is-done');
      } else if (i === currentRound) {
        pip.classList.add('is-current');
      }
    });
    roundNumEl.textContent = currentRound + 1;
  }

  /* ══════════════════════════════════════════════════════════
     CIRCLE STATE MACHINE
  ══════════════════════════════════════════════════════════ */

  function setCircleClass(cls) {
    circle.classList.remove('is-ready', 'is-false', 'is-clicked');
    if (cls) circle.classList.add(cls);
  }

  function setStatus(text, modifier) {
    statusEl.textContent = text;
    statusEl.className   = 'attn-status' + (modifier ? ' ' + modifier : '');
  }

  function setInstruction(text) {
    instructionEl.textContent = text;
  }

  /* ── waiting: round started, timer running ──────────────── */
  function enterWaiting() {
    circleState = 'waiting';
    setCircleClass(null); /* neutral grey */
    circle.setAttribute('aria-label', 'Waiting — do not click yet');
    setStatus('Wait for green…', '');
    setInstruction('Keep your eyes on the circle');
  }

  /* ── ready: circle turns green, measure from now ───────── */
  function enterReady() {
    circleState    = 'ready';
    roundStartTime = performance.now();
    setCircleClass('is-ready');
    circle.setAttribute('aria-label', 'Green — click now!');
    setStatus('Click now!', 'is-go');
    setInstruction('Click as fast as you can!');
  }

  /* ── false start: user clicked before green ─────────────── */
  function enterFalse() {
    circleState = 'false';
    setCircleClass('is-false');
    circle.setAttribute('aria-label', 'Too early');
    setStatus('Too early! Wait for green.', 'is-false');
    setInstruction('This round will repeat');
    falseStarts++;
  }

  /* ── clicked: valid reaction recorded ──────────────────── */
  function enterClicked(rt) {
    circleState = 'clicked';
    setCircleClass('is-clicked');
    circle.setAttribute('aria-label', 'Round complete');
    setStatus('Round ' + (currentRound + 1) + ' ' + rt + ' ms', 'is-result');
    setInstruction('');
  }

  /* ══════════════════════════════════════════════════════════
     ROUND LOGIC
  ══════════════════════════════════════════════════════════ */

  function startRound() {
    updatePips();
    enterWaiting();

    /* Random delay: [MIN_DELAY, MAX_DELAY] */
    var delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    waitTimer = setTimeout(function () {
      if (circleState !== 'waiting') return; /* guard */
      enterReady();
    }, delay);
  }

  function advanceRound() {
    currentRound++;
    updatePips();

    if (currentRound >= TOTAL_ROUNDS) {
      /* All valid rounds complete */
      setTimeout(function () {
        buildSummary();
        goToPhase('summary');
      }, 900);
    } else {
      setTimeout(startRound, 1200);
    }
  }

  /* ══════════════════════════════════════════════════════════
     CIRCLE CLICK HANDLER
     — attached once; reads circleState to decide action
  ══════════════════════════════════════════════════════════ */

  circle.addEventListener('click', function () {

    if (circleState === 'waiting') {
      /* ── FALSE START ─────────────────────────────── */
      clearTimeout(waitTimer);
      waitTimer = null;
      enterFalse();

      /* Replay the same round after brief penalty */
      setTimeout(startRound, 1800);
      return;
    }

    if (circleState === 'ready') {
      /* ── VALID CLICK ─────────────────────────────── */
      var rt = Math.round(performance.now() - roundStartTime);
      reactionTimes.push(rt);
      enterClicked(rt);
      advanceRound();
      return;
    }

    /* Any other state (idle, false, clicked) — ignore */
  });

  /* ══════════════════════════════════════════════════════════
     SUMMARY — build clinical metrics
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var sum     = reactionTimes.reduce(function (a, b) { return a + b; }, 0);
    var avg     = Math.round(sum / reactionTimes.length);
    var fastest = Math.min.apply(null, reactionTimes);
    var slowest = Math.max.apply(null, reactionTimes);

    /* Performance classification on average RT */
    var rating, ratingClass;
    if (avg <= THRESHOLD_EXCELLENT) {
      rating = 'Excellent';          ratingClass = 'excellent';
    } else if (avg <= THRESHOLD_GOOD) {
      rating = 'Good';               ratingClass = 'good';
    } else {
      rating = 'Needs Improvement';  ratingClass = 'needs-improvement';
    }

    /* Inject metric tiles */
    var falseStartClass = falseStarts > 0 ? 'warn' : '';
    summaryGridEl.innerHTML =
      metricTile('Average RT',      avg + ' ms', '')              +
      metricTile('Fastest',         fastest + ' ms', 'best')      +
      metricTile('Slowest',         slowest + ' ms', '')          +
      metricTile('False Starts',    falseStarts, falseStartClass);

    /* Inject performance rating pill */
    perfStatusEl.innerHTML =
      '<div class="attn-status-pill attn-status-pill--' + ratingClass + '">'          +
        '<span class="attn-status-pill__dot" aria-hidden="true"></span>'               +
        '<span class="attn-status-pill__label">Performance: ' + rating + '</span>'    +
      '</div>';

    /* Re-render Lucide icons (arrow-right on continue button) */
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    /* Write to sessionStorage */
    persistSession({
      avg:         avg,
      fastest:     fastest,
      slowest:     slowest,
      falseStarts: falseStarts,
      rating:      rating
    });
  }

  function metricTile(label, value, modifier) {
    var valueClass = 'attn-summary-item__value' +
      (modifier ? ' attn-summary-item__value--' + modifier : '');
    return (
      '<div class="attn-summary-item">'                           +
        '<span class="attn-summary-item__label">' + label + '</span>' +
        '<span class="' + valueClass + '">' + value + '</span>'   +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     SESSION STORAGE
  ══════════════════════════════════════════════════════════ */

  function persistSession(scores) {
    var user = {};
    try {
      user = JSON.parse(sessionStorage.getItem('cognitrack_user') || '{}');
    } catch (e) { /* user data unavailable */ }

    var session = {
      timestamp:      new Date().toISOString(),
      user:           user,
      assessment:     'attention',
      reactionTimes:  reactionTimes,
      falseStarts:    falseStarts,
      totalRounds:    TOTAL_ROUNDS,
      scores:         scores
    };

    try {
      sessionStorage.setItem('cognitrack_session_attention', JSON.stringify(session));
    } catch (e) { /* private browsing / storage quota */ }
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    buildPips();
    goToPhase('test');
    /* Small delay lets the phase transition animation settle */
    setTimeout(startRound, 650);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  goToPhase('intro');

});
