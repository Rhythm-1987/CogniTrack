/* ============================================================
   CogniTrack — Attention Assessment
   attention.js   Sprint 4.0

   Dynamic difficulty: stimulus delay scales linearly from
     Round 1:  [4 000, 5 000] ms  (casual)
     Round 5:  [2 000, 3 000] ms  (intense)
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var TOTAL_ROUNDS        = 5;
  var THRESHOLD_EXCELLENT = 250;   /* ms — avg RT for Excellent */
  var THRESHOLD_GOOD      = 400;   /* ms — avg RT for Good     */

  /* Per-round delay windows (0-indexed round index)
     min = 4000 - round*500,  max = 5000 - round*500         */
  function roundDelay(roundIndex) {
    var min = 4000 - roundIndex * 500;   /* 4000 → 2000 ms */
    var max = 5000 - roundIndex * 500;   /* 5000 → 3000 ms */
    return min + Math.random() * (max - min);
  }

  /* ── State ──────────────────────────────────────────────── */
  var currentRound   = 0;
  var reactionTimes  = [];
  var falseStarts    = 0;
  var waitTimer      = null;
  var roundStartTime = 0;
  var circleState    = 'idle';   /* idle | waiting | ready | false | clicked */
  var startedAt      = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:   document.getElementById('phase-intro'),
    test:    document.getElementById('phase-test'),
    summary: document.getElementById('phase-summary')
  };

  var phaseBar      = document.getElementById('attn-phase-bar');
  var phaseLabel    = document.getElementById('attn-phase-label');
  var phaseNum      = document.getElementById('attn-phase-num');
  var roundPipsEl   = document.getElementById('round-pips');
  var roundNumEl    = document.getElementById('round-num');
  var statusEl      = document.getElementById('attn-status');
  var circle        = document.getElementById('attn-circle');
  var instructionEl = document.getElementById('attn-instruction');
  var summaryGridEl = document.getElementById('attn-summary-grid');
  var perfStatusEl  = document.getElementById('attn-perf-status');

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

    if (typeof CT !== 'undefined') {
      CT.updateStage('attention', PHASE_ORDER.indexOf(name), {
        reactionTimes: reactionTimes,
        falseStarts:   falseStarts,
        currentRound:  currentRound,
        startedAt:     startedAt
      });
    }

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
      if (i < currentRound)       pip.classList.add('is-done');
      else if (i === currentRound) pip.classList.add('is-current');
    });
    roundNumEl.textContent = currentRound + 1;
  }

  /* ══════════════════════════════════════════════════════════
     CIRCLE STATE MACHINE
  ══════════════════════════════════════════════════════════ */

  function setCircleClass(cls) {
    circle.classList.remove('is-ready', 'is-false', 'is-clicked');
    if (cls) { circle.classList.add(cls); }
  }

  function setStatus(text, modifier) {
    statusEl.textContent = text;
    statusEl.className   = 'attn-status' + (modifier ? ' ' + modifier : '');
  }

  function setInstruction(text) { instructionEl.textContent = text; }

  function enterWaiting() {
    circleState = 'waiting';
    setCircleClass(null);
    circle.setAttribute('aria-label', 'Waiting — do not click yet');
    setStatus('Wait for green…', '');
    setInstruction('Keep your eyes on the circle');
  }

  function enterReady() {
    circleState    = 'ready';
    roundStartTime = performance.now();
    setCircleClass('is-ready');
    circle.setAttribute('aria-label', 'Green — click now!');
    setStatus('Click now!', 'is-go');
    setInstruction('Click as fast as you can!');
  }

  function enterFalse() {
    circleState = 'false';
    setCircleClass('is-false');
    circle.setAttribute('aria-label', 'Too early');
    setStatus('Too early! Wait for green.', 'is-false');
    setInstruction('This round will repeat');
    falseStarts++;
  }

  function enterClicked(rt) {
    circleState = 'clicked';
    setCircleClass('is-clicked');
    circle.setAttribute('aria-label', 'Round complete');
    setStatus('Round ' + (currentRound + 1) + ' — ' + rt + ' ms', 'is-result');
    setInstruction('');
  }

  /* ══════════════════════════════════════════════════════════
     ROUND LOGIC
  ══════════════════════════════════════════════════════════ */

  function startRound() {
    updatePips();
    enterWaiting();

    /* Scaled delay — harder as rounds progress */
    var delay = roundDelay(currentRound);

    waitTimer = setTimeout(function () {
      if (circleState !== 'waiting') { return; }
      enterReady();
    }, delay);
  }

  function advanceRound() {
    currentRound++;
    updatePips();

    if (currentRound >= TOTAL_ROUNDS) {
      setTimeout(function () {
        buildSummary();
        goToPhase('summary');
      }, 900);
    } else {
      setTimeout(startRound, 1200);
    }
  }

  /* ══════════════════════════════════════════════════════════
     CIRCLE CLICK (mouse)
  ══════════════════════════════════════════════════════════ */

  circle.addEventListener('click', function () {
    handleCircleActivation();
  });

  /* ══════════════════════════════════════════════════════════
     KEYBOARD — Spacebar fires the circle activation
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    /* Only active during the test phase */
    if (!phases.test.classList.contains('is-active')) { return; }
    if (e.key !== ' ' && e.code !== 'Space') { return; }
    e.preventDefault();   /* prevent page scroll */
    handleCircleActivation();
  });

  function handleCircleActivation() {
    if (circleState === 'waiting') {
      clearTimeout(waitTimer);
      waitTimer = null;
      enterFalse();
      setTimeout(startRound, 1800);
      return;
    }

    if (circleState === 'ready') {
      var rt = Math.round(performance.now() - roundStartTime);
      reactionTimes.push(rt);
      enterClicked(rt);
      advanceRound();
    }
  }

  /* ══════════════════════════════════════════════════════════
     SUMMARY — clinical metrics + standardised session write
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var avg, fastest, slowest;
    if (reactionTimes.length === 0) {
      avg = 0; fastest = 0; slowest = 0;
    } else {
      var sum = reactionTimes.reduce(function (a, b) { return a + b; }, 0);
      avg     = Math.round(sum / reactionTimes.length);
      fastest = Math.min.apply(null, reactionTimes);
      slowest = Math.max.apply(null, reactionTimes);
    }

    /* Map avg RT to 0-100 score:
       90 + (250 − avgRt) × 0.1
       capped [0, 100]                                        */
    var score = Math.max(0, Math.min(100, Math.round(90 + (250 - avg) * 0.1)));

    var ratingObj = (typeof CT !== 'undefined')
      ? CT.getRating(score)
      : legacyRating(avg);

    var falseStartClass = falseStarts > 0 ? 'warn' : '';
    summaryGridEl.innerHTML =
      metricTile('Average RT', avg + ' ms',     '')             +
      metricTile('Fastest',    fastest + ' ms', 'best')         +
      metricTile('Slowest',    slowest + ' ms', '')             +
      metricTile('False Starts', falseStarts,   falseStartClass);

    /* Rich summary card */
    var ctSummaryHtml =
      '<div class="ct-summary-card">' +
        '<div class="ct-summary-score">' +
          '<span class="ct-summary-score__num" data-target="' + score + '">0</span>' +
          '<span class="ct-summary-score__label">Score</span>' +
        '</div>' +
        '<div class="ct-summary-rating ct-summary-rating--' + ratingObj.cls + '">' +
          '<span class="ct-summary-rating__label">' + ratingObj.label + '</span>' +
          '<span class="ct-summary-rating__sub">' + ratingObj.sub + '</span>' +
        '</div>' +
      '</div>';

    perfStatusEl.innerHTML = ctSummaryHtml;

    animateScore(perfStatusEl.querySelector('[data-target]'), score);

    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    /* Persist standardised session */
    if (typeof CT !== 'undefined') {
      CT.writeSession('attention', startedAt, score, score, avg, {
        reactionTimes: reactionTimes,
        falseStarts:   falseStarts,
        fastest:       fastest,
        slowest:       slowest
      });

      CT.completeModule('attention');

      /* Lock continue link to block accidental nav during transition */
      var continueEl = phases.summary ? phases.summary.querySelector('a.btn') : null;
      if (continueEl) { CT.lockButton(continueEl); }

      setTimeout(function () {
        CT.showTransitionCard(CT.getNextModuleUrl(), CT.getNextModuleName());
      }, 1800);
    }
  }

  function legacyRating(avg) {
    if (avg <= THRESHOLD_EXCELLENT) return { label: 'Excellent', sub: '↑ Above Average', cls: 'excellent' };
    if (avg <= THRESHOLD_GOOD)      return { label: 'Good',      sub: 'Within Normal Range', cls: 'good' };
    return                                  { label: 'Needs Review', sub: 'Consider Re-assessment', cls: 'needs-review' };
  }

  function metricTile(label, value, modifier) {
    var valueClass = 'attn-summary-item__value' +
      (modifier ? ' attn-summary-item__value--' + modifier : '');
    return (
      '<div class="attn-summary-item">'                              +
        '<span class="attn-summary-item__label">' + label + '</span>' +
        '<span class="' + valueClass + '">' + value + '</span>'       +
      '</div>'
    );
  }

  function animateScore(el, target) {
    if (!el) { return; }
    var dur = 900; var begin = performance.now();
    (function step(now) {
      var p = Math.min((now - begin) / dur, 1);
      el.textContent = Math.round(p * target);
      if (p < 1) { requestAnimationFrame(step); }
    }(performance.now()));
  }

  /* ══════════════════════════════════════════════════════════
     SESSION RECOVERY
  ══════════════════════════════════════════════════════════ */

  function attemptRecovery() {
    if (typeof CT === 'undefined') { return false; }
    var progress = CT.loadProgress();
    if (!progress) { return false; }

    if (progress.modules && progress.modules.attention) {
      buildPips();
      var session = null;
      try { session = JSON.parse(sessionStorage.getItem('cognitrack_session_attention') || 'null'); } catch (e) {}
      if (session && session.rawData) {
        startedAt      = session.startedAt;
        reactionTimes  = session.rawData.reactionTimes || [];
        falseStarts    = session.rawData.falseStarts   || 0;
        currentRound   = TOTAL_ROUNDS;
        buildSummary();
        goToPhase('summary');
        return true;
      }
    }

    if (progress.currentModule === 'attention' && progress.currentStage > 0) {
      var saved = CT.getModuleState('attention');
      if (saved) {
        reactionTimes = saved.reactionTimes || [];
        falseStarts   = saved.falseStarts   || 0;
        currentRound  = saved.currentRound  || 0;
        startedAt     = saved.startedAt;
      }
      buildPips();
      goToPhase('test');
      setTimeout(startRound, 650);
      return true;
    }

    return false;
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    if (typeof CT !== 'undefined' && CT.lockButton) { CT.lockButton(this); }
    startedAt = new Date().toISOString();
    buildPips();
    goToPhase('test');
    setTimeout(startRound, 650);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  if (!attemptRecovery()) {
    goToPhase('intro');
  }

});
