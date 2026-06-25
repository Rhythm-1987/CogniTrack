/* ============================================================
   CogniTrack — Executive Function Assessment
   executive.js — Stroop Colour Test
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Colour definitions ─────────────────────────────────── */
  var COLORS = [
    { name: 'RED',    cssClass: 'red' },
    { name: 'BLUE',   cssClass: 'blue' },
    { name: 'GREEN',  cssClass: 'green' },
    { name: 'YELLOW', cssClass: 'yellow' }
  ];

  var TOTAL_QUESTIONS    = 15;
  var CONGRUENT_COUNT    = 4;     /* one per colour — guaranteed */
  var INCONGRUENT_TARGET = TOTAL_QUESTIONS - CONGRUENT_COUNT; /* 11 = 73.3% */

  /* ── State ──────────────────────────────────────────────── */
  var questions       = [];   /* { word, colorName, colorClass, isCongruent } */
  var currentQuestion = 0;
  var results         = [];   /* { correct, rt, word, colorName, answered } */
  var questionStart   = 0;    /* performance.now() at question display */
  var answerPending   = false;

  /* ── DOM References ─────────────────────────────────────── */
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

  /* ── Phase config ───────────────────────────────────────── */
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
    var pct = Math.round((idx / PHASE_ORDER.length) * 100);
    phaseBar.style.width   = pct + '%';
    phaseLabel.textContent = PHASE_LABELS[name];
    phaseNum.textContent   = idx;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION GENERATION
     Strategy: 4 congruent (one per colour) + 11 incongruent
     Result:   73.3% incongruent — exceeds the 70% requirement
  ══════════════════════════════════════════════════════════ */

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function generateQuestions() {
    /* 4 congruent questions — word matches ink colour */
    var congruent = COLORS.map(function (c) {
      return {
        word:        c.name,
        colorName:   c.name,
        colorClass:  c.cssClass,
        isCongruent: true
      };
    });

    /* 12 incongruent pairs — word ≠ ink colour */
    var incongruent = [];
    COLORS.forEach(function (word) {
      COLORS.forEach(function (col) {
        if (word.name !== col.name) {
          incongruent.push({
            word:        word.name,
            colorName:   col.name,
            colorClass:  col.cssClass,
            isCongruent: false
          });
        }
      });
    });

    /* Shuffle and pick INCONGRUENT_TARGET (11) incongruent rounds */
    incongruent = shuffleArray(incongruent);
    var pool = congruent.concat(incongruent.slice(0, INCONGRUENT_TARGET));

    return shuffleArray(pool);
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION DISPLAY
  ══════════════════════════════════════════════════════════ */

  function showQuestion(idx) {
    var q = questions[idx];

    /* Update question counter and inner progress bar */
    qCurrentEl.textContent = idx + 1;
    execQBarEl.style.width = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    /* Brief opacity dip between questions */
    stroopWordEl.classList.add('is-swapping');

    setTimeout(function () {
      stroopWordEl.textContent = q.word;
      stroopWordEl.className   = 'stroop-word stroop-word--' + q.colorClass;
      stroopWordEl.setAttribute('aria-label', 'Word: ' + q.word);

      execDisplayEl.classList.remove('is-correct', 'is-incorrect');
      enableButtons();

      stroopWordEl.classList.remove('is-swapping');

      /* Start timing after the word is visible */
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

    setTimeout(function () {
      if (currentQuestion < TOTAL_QUESTIONS) {
        showQuestion(currentQuestion);
      } else {
        buildSummary();
      }
    }, isCorrect ? 360 : 560);
  }

  /* ── Button state helpers ───────────────────────────────── */

  function enableButtons() {
    colorButtonEls.forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove('is-correct', 'is-incorrect');
    });
  }

  function disableButtons() {
    colorButtonEls.forEach(function (btn) {
      btn.disabled = true;
    });
  }

  colorButtonEls.forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAnswer(btn.getAttribute('data-color'));
    });
  });

  /* ══════════════════════════════════════════════════════════
     SUMMARY — clinical metrics
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var correct   = results.filter(function (r) { return r.correct; }).length;
    var incorrect = TOTAL_QUESTIONS - correct;
    var accuracy  = Math.round((correct / TOTAL_QUESTIONS) * 100);
    var totalRt   = results.reduce(function (s, r) { return s + r.rt; }, 0);
    var avgRt     = Math.round(totalRt / results.length);

    var rating, ratingClass;
    if (accuracy >= 85) {
      rating      = 'Excellent';
      ratingClass = 'excellent';
    } else if (accuracy >= 70) {
      rating      = 'Good';
      ratingClass = 'good';
    } else {
      rating      = 'Needs Improvement';
      ratingClass = 'needs-improvement';
    }

    summaryGridEl.innerHTML =
      execTile('Accuracy',  accuracy + '%', 'highlight')                  +
      execTile('Avg. Time', avgRt + ' ms',  '')                           +
      execTile('Correct',   correct,         correct >= 13 ? 'good' : '') +
      execTile('Incorrect', incorrect,       incorrect > 4  ? 'warn' : '');

    perfStatusEl.innerHTML =
      '<div class="exec-status-pill exec-status-pill--' + ratingClass + '">'         +
        '<span class="exec-status-pill__dot" aria-hidden="true"></span>'              +
        '<span class="exec-status-pill__label">Performance: ' + rating + '</span>'   +
      '</div>';

    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    goToPhase('summary');

    persistSession({
      accuracy:  accuracy,
      avgRt:     avgRt,
      correct:   correct,
      incorrect: incorrect,
      rating:    rating
    });
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

  /* ══════════════════════════════════════════════════════════
     SESSION STORAGE
  ══════════════════════════════════════════════════════════ */

  function persistSession(scores) {
    var user = {};
    try {
      user = JSON.parse(sessionStorage.getItem('cognitrack_user') || '{}');
    } catch (e) { /* user data unavailable */ }

    var session = {
      timestamp:  new Date().toISOString(),
      user:       user,
      assessment: 'executive',
      questions:  TOTAL_QUESTIONS,
      results:    results,
      scores:     scores
    };

    try {
      sessionStorage.setItem('cognitrack_session_executive', JSON.stringify(session));
    } catch (e) { /* private browsing / storage quota */ }
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    questions = generateQuestions();
    goToPhase('test');
    setTimeout(function () { showQuestion(0); }, 500);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  goToPhase('intro');

});
