/* ============================================================
   CogniTrack — Processing Speed Assessment
   processing.js — Symbol Match Test   Sprint 4.0

   Dynamic difficulty — answer-option scaling:
     Q  1– 5  (indices 0– 4)  → 2 options (correct + 1 distractor)
     Q  6–10  (indices 5– 9)  → 3 options (correct + 2 distractors)
     Q 11–20  (indices 10–19) → 4 options (correct + 3 distractors)

   Mandatory 2-second key preview countdown before first question.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Symbol pool ────────────────────────────────────────── */
  var SYMBOL_POOL = ['▲', '●', '■', '★', '◆'];

  var SYMBOL_NAMES = {
    '▲': 'Triangle',
    '●': 'Circle',
    '■': 'Square',
    '★': 'Star',
    '◆': 'Diamond'
  };

  var TOTAL_QUESTIONS = 20;

  /* ── State ──────────────────────────────────────────────── */
  var keyMap          = {};
  var questions       = [];
  var currentQuestion = 0;
  var results         = [];
  var questionStart   = 0;
  var totalStartTime  = 0;
  var totalMs         = 0;
  var answerPending   = false;
  var startedAt       = null;
  var previewTimer    = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:   document.getElementById('phase-intro'),
    test:    document.getElementById('phase-test'),
    summary: document.getElementById('phase-summary')
  };

  var phaseBar      = document.getElementById('proc-phase-bar');
  var phaseLabel    = document.getElementById('proc-phase-label');
  var phaseNum      = document.getElementById('proc-phase-num');
  var keyPreviewEl  = document.getElementById('proc-key-preview');
  var keyTestEl     = document.getElementById('proc-key-test');
  var procNumberEl  = document.getElementById('proc-number');
  var qCurrentEl    = document.getElementById('q-current');
  var procQBarEl    = document.getElementById('proc-q-bar');
  var summaryGridEl = document.getElementById('proc-summary-grid');
  var perfStatusEl  = document.getElementById('proc-perf-status');
  var beginBtn      = document.getElementById('btn-begin');

  var symButtonEls  = Array.prototype.slice.call(
    document.querySelectorAll('#symbol-buttons .proc-sym-btn')
  );

  var PHASE_ORDER  = ['intro', 'test', 'summary'];
  var PHASE_LABELS = {
    intro:   'Introduction',
    test:    'Symbol Match Test',
    summary: 'Summary'
  };

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ══════════════════════════════════════════════════════════
     SESSION INIT
  ══════════════════════════════════════════════════════════ */

  function initSession() {
    var shuffled = shuffleArray(SYMBOL_POOL);
    for (var i = 0; i < shuffled.length; i++) {
      keyMap[i + 1] = shuffled[i];
    }
    questions = generateQuestions();
    buildKeyBar(keyPreviewEl, false);
    buildKeyBar(keyTestEl,    true);
  }

  /* ══════════════════════════════════════════════════════════
     KEY BAR BUILDER
  ══════════════════════════════════════════════════════════ */

  function buildKeyBar(containerEl, compact) {
    var html = '';
    for (var n = 1; n <= 5; n++) {
      var sym  = keyMap[n];
      var name = SYMBOL_NAMES[sym];
      html +=
        '<div class="proc-key-cell" role="listitem"' +
            ' aria-label="' + n + ' maps to ' + name + '">' +
          '<span class="proc-key-cell__num" aria-hidden="true">' + n + '</span>' +
          '<span class="proc-key-cell__sym" aria-hidden="true">' + sym + '</span>' +
        '</div>';
    }
    containerEl.innerHTML = html;
    void compact;
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION GENERATION
     Option count scales per difficulty tier.
  ══════════════════════════════════════════════════════════ */

  function optionCountForQuestion(idx) {
    if (idx < 5)  return 2;   /* Q1–5  */
    if (idx < 10) return 3;   /* Q6–10 */
    return 4;                 /* Q11–20 */
  }

  function generateQuestions() {
    var qs = [];
    for (var i = 0; i < TOTAL_QUESTIONS; i++) {
      var num     = randInt(1, 5);
      var correct = keyMap[num];
      var others  = shuffleArray(SYMBOL_POOL.filter(function (s) { return s !== correct; }));
      var count   = optionCountForQuestion(i);
      var options = shuffleArray([correct].concat(others.slice(0, count - 1)));
      qs.push({ num: num, correct: correct, options: options, optionCount: count });
    }
    return qs;
  }

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
    phaseBar.style.width   = Math.round((idx / PHASE_ORDER.length) * 100) + '%';
    phaseLabel.textContent = PHASE_LABELS[name];
    phaseNum.textContent   = idx;

    if (typeof CT !== 'undefined') {
      CT.updateStage('processing', PHASE_ORDER.indexOf(name), {
        currentQuestion: currentQuestion,
        results:         results,
        startedAt:       startedAt
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     2-SECOND KEY PREVIEW COUNTDOWN
     Called when Begin is clicked; shows a countdown overlay
     on the begin button before the first question appears.
  ══════════════════════════════════════════════════════════ */

  function startPreviewCountdown(callback) {
    beginBtn.disabled    = true;
    beginBtn.textContent = 'Memorise key… 2';

    var count = 2;
    previewTimer = setInterval(function () {
      count--;
      if (count > 0) {
        beginBtn.textContent = 'Memorise key… ' + count;
      } else {
        clearInterval(previewTimer);
        previewTimer = null;
        beginBtn.disabled    = false;
        beginBtn.textContent = 'Begin Test';
        callback();
      }
    }, 1000);
  }

  /* ══════════════════════════════════════════════════════════
     SHOW QUESTION
  ══════════════════════════════════════════════════════════ */

  function showQuestion(idx) {
    var q = questions[idx];

    qCurrentEl.textContent = idx + 1;
    procQBarEl.style.width = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    procNumberEl.classList.add('is-swapping');

    /* Show or hide buttons based on option count */
    symButtonEls.forEach(function (btn, i) {
      btn.style.display = i < q.optionCount ? '' : 'none';
    });

    setTimeout(function () {
      procNumberEl.textContent = String(q.num);
      procNumberEl.setAttribute('aria-label', 'Number: ' + q.num);
      procNumberEl.classList.remove('is-swapping');

      symButtonEls.forEach(function (btn, i) {
        if (i < q.optionCount) {
          var sym = q.options[i];
          btn.textContent = sym;
          btn.setAttribute('data-symbol', sym);
          btn.setAttribute('aria-label', SYMBOL_NAMES[sym]);
          btn.disabled = false;
          btn.classList.remove('is-correct', 'is-incorrect', 'is-hint');
        }
      });

      if (idx === 0) { totalStartTime = performance.now(); }
      questionStart = performance.now();
      answerPending = true;
    }, 100);
  }

  /* ══════════════════════════════════════════════════════════
     HANDLE ANSWER
  ══════════════════════════════════════════════════════════ */

  function handleAnswer(symbol) {
    if (!answerPending) { return; }
    answerPending = false;

    var rt        = Math.round(performance.now() - questionStart);
    var q         = questions[currentQuestion];
    var isCorrect = (symbol === q.correct);

    results.push({ correct: isCorrect, rt: rt, num: q.num, answered: symbol });

    disableButtons();

    var clickedBtn = getButtonBySymbol(symbol);
    if (clickedBtn) { clickedBtn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect'); }

    if (!isCorrect) {
      var correctBtn = getButtonBySymbol(q.correct);
      if (correctBtn) { correctBtn.classList.add('is-hint'); }
    }

    currentQuestion++;

    /* Persist state on each answer */
    if (typeof CT !== 'undefined') {
      CT.updateStage('processing', 1, {
        currentQuestion: currentQuestion,
        results:         results,
        startedAt:       startedAt
      });
    }

    setTimeout(function () {
      if (currentQuestion < TOTAL_QUESTIONS) {
        showQuestion(currentQuestion);
      } else {
        totalMs = Math.round(performance.now() - totalStartTime);
        buildSummary();
      }
    }, isCorrect ? 350 : 600);
  }

  /* ── Button helpers ─────────────────────────────────────── */

  function disableButtons() {
    symButtonEls.forEach(function (btn) { btn.disabled = true; });
  }

  function getButtonBySymbol(sym) {
    for (var i = 0; i < symButtonEls.length; i++) {
      if (symButtonEls[i].getAttribute('data-symbol') === sym) { return symButtonEls[i]; }
    }
    return null;
  }

  symButtonEls.forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAnswer(btn.getAttribute('data-symbol'));
    });
  });

  /* ══════════════════════════════════════════════════════════
     KEYBOARD — keys 1 2 3 4 map to visible symbol buttons
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (!phases.test.classList.contains('is-active')) { return; }
    if (!answerPending) { return; }

    var idx = parseInt(e.key, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= symButtonEls.length) { return; }

    var btn = symButtonEls[idx];
    if (btn.style.display === 'none' || btn.disabled) { return; }

    e.preventDefault();
    handleAnswer(btn.getAttribute('data-symbol'));
  });

  /* ══════════════════════════════════════════════════════════
     SUMMARY — clinical metrics + standardised session write
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var correct   = results.filter(function (r) { return r.correct; }).length;
    var incorrect = TOTAL_QUESTIONS - correct;
    var accuracy  = Math.round((correct / TOTAL_QUESTIONS) * 100);
    var totalRt   = results.reduce(function (s, r) { return s + r.rt; }, 0);
    var avgRt     = Math.round(totalRt / results.length);
    var totalSecs = (totalMs / 1000).toFixed(1);

    var score     = accuracy;
    var ratingObj = (typeof CT !== 'undefined') ? CT.getRating(score) : legacyRating(accuracy);

    summaryGridEl.innerHTML =
      procTile('Accuracy',   accuracy + '%',         'highlight')                   +
      procTile('Correct',    correct + ' / 20',      correct >= 18 ? 'good' : '')   +
      procTile('Avg. Time',  avgRt + ' ms',           '')                            +
      procTile('Total Time', totalSecs + ' s',        '');

    /* Rich summary card */
    perfStatusEl.innerHTML =
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

    animateScore(perfStatusEl.querySelector('[data-target]'), score);

    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    goToPhase('summary');

    if (typeof CT !== 'undefined') {
      CT.writeSession('processing', startedAt, score, accuracy, avgRt, {
        keyMap:     keyMap,
        questions:  TOTAL_QUESTIONS,
        totalMs:    totalMs,
        totalSecs:  parseFloat(totalSecs),
        results:    results
      });

      CT.completeModule('processing');

      /* Lock continue link to block accidental nav during transition */
      var continueEl = phases.summary ? phases.summary.querySelector('a.btn') : null;
      if (continueEl) { CT.lockButton(continueEl); }

      setTimeout(function () {
        CT.showTransitionCard(CT.getNextModuleUrl(), CT.getNextModuleName());
      }, 1800);
    }
  }

  function legacyRating(accuracy) {
    if (accuracy >= 90) return { label: 'Excellent',    sub: '↑ Above Average',       cls: 'excellent'    };
    if (accuracy >= 70) return { label: 'Good',         sub: 'Within Normal Range',    cls: 'good'         };
    return                     { label: 'Needs Review', sub: 'Consider Re-assessment', cls: 'needs-review' };
  }

  function procTile(label, value, modifier) {
    var valueClass = 'proc-summary-item__value' +
      (modifier ? ' proc-summary-item__value--' + modifier : '');
    return (
      '<div class="proc-summary-item">'                                  +
        '<span class="proc-summary-item__label">' + label + '</span>'   +
        '<span class="' + valueClass + '">' + value + '</span>'         +
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

    if (progress.modules && progress.modules.processing) {
      var session = null;
      try { session = JSON.parse(sessionStorage.getItem('cognitrack_session_processing') || 'null'); } catch (e) {}
      if (session && session.rawData) {
        startedAt       = session.startedAt;
        results         = session.rawData.results || [];
        currentQuestion = TOTAL_QUESTIONS;
        totalMs         = session.rawData.totalMs || 0;
        buildSummary();
        return true;
      }
    }

    if (progress.currentModule === 'processing' && progress.currentStage > 0) {
      var saved = CT.getModuleState('processing');
      if (saved) {
        results         = saved.results         || [];
        currentQuestion = saved.currentQuestion || 0;
        startedAt       = saved.startedAt;
      }
      goToPhase('test');
      setTimeout(function () { showQuestion(currentQuestion); }, 500);
      return true;
    }

    return false;
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON — triggers 2s key preview then test
  ══════════════════════════════════════════════════════════ */

  beginBtn.addEventListener('click', function () {
    startedAt = new Date().toISOString();

    startPreviewCountdown(function () {
      goToPhase('test');
      setTimeout(function () { showQuestion(0); }, 500);
    });
  });

  /* ══════════════════════════════════════════════════════════
     BOOT — key generated at load so it appears in intro phase
  ══════════════════════════════════════════════════════════ */

  initSession();

  if (!attemptRecovery()) {
    goToPhase('intro');
  }

});
