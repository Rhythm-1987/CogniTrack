/* ============================================================
   CogniTrack — Executive Function Assessment
   executive.js — Stroop Colour Test   Sprint 4.0

   Phase-ordered interference scaling:
     Q  1– 3  (indices 0–2)  → 100% Congruent
     Q  4–10  (indices 3–9)  → Mostly Incongruent (1 con + 6 incon)
     Q 11–15  (indices 10–14)→ 100% Incongruent
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Colour definitions ─────────────────────────────────── */
  var COLORS = [
    { name: 'RED',    cssClass: 'red'    },
    { name: 'BLUE',   cssClass: 'blue'   },
    { name: 'GREEN',  cssClass: 'green'  },
    { name: 'YELLOW', cssClass: 'yellow' }
  ];

  var TOTAL_QUESTIONS = 15;

  /* ── State ──────────────────────────────────────────────── */
  var questions       = [];
  var currentQuestion = 0;
  var results         = [];   /* { correct, rt, word, colorName, answered } */
  var questionStart   = 0;
  var answerPending   = false;
  var startedAt       = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:   document.getElementById('phase-intro'),
    test:    document.getElementById('phase-test'),
    summary: document.getElementById('phase-summary')
  };

  var phaseBar      = document.getElementById('exec-phase-bar');
  var phaseLabel    = document.getElementById('exec-phase-label');
  var phaseNum      = document.getElementById('exec-phase-num');
  var stroopWordEl  = document.getElementById('stroop-word');
  var execDisplayEl = document.getElementById('exec-display');
  var qCurrentEl    = document.getElementById('q-current');
  var execQBarEl    = document.getElementById('exec-q-bar');
  var summaryGridEl = document.getElementById('exec-summary-grid');
  var perfStatusEl  = document.getElementById('exec-perf-status');

  var colorButtonEls = Array.prototype.slice.call(
    document.querySelectorAll('#color-buttons .exec-btn')
  );

  var PHASE_ORDER  = ['intro', 'test', 'summary'];
  var PHASE_LABELS = {
    intro:   'Introduction',
    test:    'Stroop Test',
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
    phaseBar.style.width   = Math.round((idx / PHASE_ORDER.length) * 100) + '%';
    phaseLabel.textContent = PHASE_LABELS[name];
    phaseNum.textContent   = idx;

    if (typeof CT !== 'undefined') {
      CT.updateStage('executive', PHASE_ORDER.indexOf(name), {
        currentQuestion: currentQuestion,
        results:         results,
        startedAt:       startedAt
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION GENERATION — phased interference
     Layout:
       Slots 0–2   : 3 congruent
       Slots 3–9   : 1 congruent + 6 incongruent (shuffled together)
       Slots 10–14 : 5 incongruent
  ══════════════════════════════════════════════════════════ */

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeCongruent(color) {
    return { word: color.name, colorName: color.name, colorClass: color.cssClass, isCongruent: true };
  }

  function makeIncongruent(wordColor, inkColor) {
    return { word: wordColor.name, colorName: inkColor.name, colorClass: inkColor.cssClass, isCongruent: false };
  }

  function generateQuestions() {
    var shuffledColors = shuffleArray(COLORS.slice());

    /* Phase 1 (slots 0–2): 3 congruent from first 3 shuffled colours */
    var phase1 = shuffledColors.slice(0, 3).map(makeCongruent);

    /* Phase 2 (slots 3–9): 1 remaining congruent + 6 incongruent */
    var remainingCongruent = [makeCongruent(shuffledColors[3])];

    var allIncongruent = [];
    COLORS.forEach(function (wordColor) {
      COLORS.forEach(function (inkColor) {
        if (wordColor.name !== inkColor.name) {
          allIncongruent.push(makeIncongruent(wordColor, inkColor));
        }
      });
    });
    allIncongruent = shuffleArray(allIncongruent);

    var phase2 = shuffleArray(remainingCongruent.concat(allIncongruent.slice(0, 6)));

    /* Phase 3 (slots 10–14): 5 purely incongruent */
    var phase3 = shuffleArray(allIncongruent.slice(6, 11));

    return phase1.concat(phase2).concat(phase3);
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION DISPLAY
  ══════════════════════════════════════════════════════════ */

  function showQuestion(idx) {
    var q = questions[idx];

    qCurrentEl.textContent = idx + 1;
    execQBarEl.style.width = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    stroopWordEl.classList.add('is-swapping');

    setTimeout(function () {
      stroopWordEl.textContent = q.word;
      stroopWordEl.className   = 'stroop-word stroop-word--' + q.colorClass;
      stroopWordEl.setAttribute('aria-label', 'Word: ' + q.word);

      execDisplayEl.classList.remove('is-correct', 'is-incorrect');
      enableButtons();

      stroopWordEl.classList.remove('is-swapping');
      questionStart = performance.now();
      answerPending = true;
    }, 120);
  }

  /* ══════════════════════════════════════════════════════════
     ANSWER HANDLING
  ══════════════════════════════════════════════════════════ */

  function handleAnswer(colorName) {
    if (!answerPending) { return; }
    answerPending = false;

    var rt        = Math.round(performance.now() - questionStart);
    var q         = questions[currentQuestion];
    var isCorrect = (colorName === q.colorName);

    results.push({
      correct:   isCorrect,
      rt:        rt,
      word:      q.word,
      colorName: q.colorName,
      answered:  colorName
    });

    disableButtons();

    var clickedBtn = document.querySelector(
      '#color-buttons .exec-btn[data-color="' + colorName + '"]'
    );
    if (clickedBtn) {
      clickedBtn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
    }
    execDisplayEl.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');

    currentQuestion++;

    /* Save progress after each answer */
    if (typeof CT !== 'undefined') {
      CT.updateStage('executive', 1, {
        currentQuestion: currentQuestion,
        results:         results,
        startedAt:       startedAt
      });
    }

    setTimeout(function () {
      if (currentQuestion < TOTAL_QUESTIONS) {
        showQuestion(currentQuestion);
      } else {
        buildSummary();
      }
    }, isCorrect ? 360 : 560);
  }

  /* ── Button helpers ─────────────────────────────────────── */

  function enableButtons() {
    colorButtonEls.forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove('is-correct', 'is-incorrect');
    });
  }

  function disableButtons() {
    colorButtonEls.forEach(function (btn) { btn.disabled = true; });
  }

  colorButtonEls.forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAnswer(btn.getAttribute('data-color'));
    });
  });

  /* ══════════════════════════════════════════════════════════
     KEYBOARD — keys 1 2 3 4 map to colour buttons
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (!phases.test.classList.contains('is-active')) { return; }
    if (!answerPending) { return; }

    var key = e.key;
    var idx = parseInt(key, 10) - 1;   /* '1'→0, '2'→1, '3'→2, '4'→3 */

    if (isNaN(idx) || idx < 0 || idx >= colorButtonEls.length) { return; }

    e.preventDefault();
    var btn = colorButtonEls[idx];
    if (!btn.disabled) {
      handleAnswer(btn.getAttribute('data-color'));
    }
  });

  /* ══════════════════════════════════════════════════════════
     SUMMARY — clinical metrics + standardised session write
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var correct       = results.filter(function (r) { return r.correct; }).length;
    var incorrect     = TOTAL_QUESTIONS - correct;
    var accuracy      = Math.round((correct / TOTAL_QUESTIONS) * 100);
    var totalRt       = results.reduce(function (s, r) { return s + r.rt; }, 0);
    var avgRt         = Math.round(totalRt / results.length);

    /* Phase-accuracy breakdown */
    var phase1Results = results.slice(0, 3);
    var phase3Results = results.slice(10);
    var p1Acc = Math.round(phase1Results.filter(function (r) { return r.correct; }).length / 3 * 100);
    var p3Acc = phase3Results.length
      ? Math.round(phase3Results.filter(function (r) { return r.correct; }).length / phase3Results.length * 100)
      : 0;

    var score     = accuracy;   /* accuracy directly maps to 0-100 */
    var ratingObj = (typeof CT !== 'undefined') ? CT.getRating(score) : legacyRating(accuracy);

    summaryGridEl.innerHTML =
      execTile('Accuracy',    accuracy + '%',  'highlight')                  +
      execTile('Avg. Time',   avgRt + ' ms',   '')                           +
      execTile('Correct',     correct,          correct >= 13 ? 'good' : '') +
      execTile('Incorrect',   incorrect,        incorrect > 4  ? 'warn' : '');

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
      CT.writeSession('executive', startedAt, score, accuracy, avgRt, {
        questions:           TOTAL_QUESTIONS,
        results:             results,
        congruentAccuracy:   p1Acc,
        incongruentAccuracy: p3Acc
      });

      CT.completeModule('executive');

      /* Lock continue link to block accidental nav during transition */
      var continueEl = phases.summary ? phases.summary.querySelector('a.btn') : null;
      if (continueEl) { CT.lockButton(continueEl); }

      setTimeout(function () {
        CT.showTransitionCard(CT.getNextModuleUrl(), CT.getNextModuleName());
      }, 1800);
    }
  }

  function legacyRating(accuracy) {
    if (accuracy >= 85) return { label: 'Excellent',    sub: '↑ Above Average',       cls: 'excellent'    };
    if (accuracy >= 70) return { label: 'Good',         sub: 'Within Normal Range',    cls: 'good'         };
    return                     { label: 'Needs Review', sub: 'Consider Re-assessment', cls: 'needs-review' };
  }

  function execTile(label, value, modifier) {
    var valueClass = 'exec-summary-item__value' +
      (modifier ? ' exec-summary-item__value--' + modifier : '');
    return (
      '<div class="exec-summary-item">'                                 +
        '<span class="exec-summary-item__label">' + label + '</span>'  +
        '<span class="' + valueClass + '">' + value + '</span>'        +
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

    if (progress.modules && progress.modules.executive) {
      var session = null;
      try { session = JSON.parse(sessionStorage.getItem('cognitrack_session_executive') || 'null'); } catch (e) {}
      if (session && session.rawData) {
        startedAt       = session.startedAt;
        results         = session.rawData.results || [];
        currentQuestion = TOTAL_QUESTIONS;
        questions       = generateQuestions();
        buildSummary();
        return true;
      }
    }

    if (progress.currentModule === 'executive' && progress.currentStage > 0) {
      var saved = CT.getModuleState('executive');
      if (saved) {
        results         = saved.results         || [];
        currentQuestion = saved.currentQuestion || 0;
        startedAt       = saved.startedAt;
      }
      questions = generateQuestions();
      goToPhase('test');
      setTimeout(function () { showQuestion(currentQuestion); }, 500);
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
    questions = generateQuestions();
    goToPhase('test');
    setTimeout(function () { showQuestion(0); }, 500);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  if (!attemptRecovery()) {
    goToPhase('intro');
  }

});
