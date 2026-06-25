/* ============================================================
   CogniTrack — Processing Speed Assessment
   processing.js — Symbol Match Test (DSST-inspired)
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════════════════════ */

  /* Five visually distinct Unicode symbols */
  var SYMBOL_POOL = ['▲', '●', '■', '★', '◆'];

  /* Human-readable names for accessible aria-labels */
  var SYMBOL_NAMES = {
    '▲': 'Triangle',
    '●': 'Circle',
    '■': 'Square',
    '★': 'Star',
    '◆': 'Diamond'
  };

  var TOTAL_QUESTIONS = 20;

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */

  var keyMap         = {};    /* { 1: '▲', 2: '●', 3: '■', 4: '★', 5: '◆' } — randomised */
  var questions      = [];    /* { num, correct, options:[4 symbols] } */
  var currentQuestion = 0;
  var results        = [];    /* { correct, rt, num, answered } */
  var questionStart  = 0;     /* performance.now() when question displayed */
  var totalStartTime = 0;     /* performance.now() when first question displayed */
  var totalMs        = 0;     /* elapsed ms for all 20 questions */
  var answerPending  = false;

  /* ══════════════════════════════════════════════════════════
     DOM REFERENCES
  ══════════════════════════════════════════════════════════ */

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

  var symButtonEls  = Array.prototype.slice.call(
    document.querySelectorAll('#symbol-buttons .proc-sym-btn')
  );

  /* ── Phase config ───────────────────────────────────────── */
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
     SESSION INITIALISATION
     Randomises the symbol key and generates 20 questions.
     Called once on DOMContentLoaded so the key is visible
     during the intro phase.
  ══════════════════════════════════════════════════════════ */

  function initSession() {
    var shuffled = shuffleArray(SYMBOL_POOL);
    for (var i = 0; i < shuffled.length; i++) {
      keyMap[i + 1] = shuffled[i]; /* keys 1–5 */
    }
    questions = generateQuestions();
    buildKeyBar(keyPreviewEl, false);
    buildKeyBar(keyTestEl,    true);
  }

  /* ══════════════════════════════════════════════════════════
     KEY BAR BUILDER
     Injects 5 key cells into the given container element.
     compact = true → compact variant (no extra wrapper class needed,
     handled by CSS on .proc-key-bar--compact on the parent)
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
    /* suppress unused-var warning — compact param reserved for future use */
    void compact;
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION GENERATION
     20 questions with random digit (1–5) and shuffled options.
     Each question has 1 correct symbol + 3 unique distractors.
  ══════════════════════════════════════════════════════════ */

  function generateQuestions() {
    var qs = [];
    for (var i = 0; i < TOTAL_QUESTIONS; i++) {
      var num     = randInt(1, 5);
      var correct = keyMap[num];
      var others  = SYMBOL_POOL.filter(function (s) { return s !== correct; });
      var options = shuffleArray([correct].concat(shuffleArray(others).slice(0, 3)));
      qs.push({ num: num, correct: correct, options: options });
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
    var pct = Math.round((idx / PHASE_ORDER.length) * 100);
    phaseBar.style.width   = pct + '%';
    phaseLabel.textContent = PHASE_LABELS[name];
    phaseNum.textContent   = idx;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     SHOW QUESTION
  ══════════════════════════════════════════════════════════ */

  function showQuestion(idx) {
    var q = questions[idx];

    /* Update counter and inner progress bar */
    qCurrentEl.textContent = idx + 1;
    procQBarEl.style.width = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    /* Brief opacity dip between questions */
    procNumberEl.classList.add('is-swapping');

    setTimeout(function () {
      procNumberEl.textContent = String(q.num);
      procNumberEl.setAttribute('aria-label', 'Number: ' + q.num);
      procNumberEl.classList.remove('is-swapping');

      /* Update the 4 symbol buttons */
      symButtonEls.forEach(function (btn, i) {
        var sym = q.options[i];
        btn.textContent = sym;
        btn.setAttribute('data-symbol', sym);
        btn.setAttribute('aria-label', SYMBOL_NAMES[sym]);
        btn.disabled = false;
        btn.classList.remove('is-correct', 'is-incorrect', 'is-hint');
      });

      /* Start timing after word is visible */
      if (idx === 0) {
        totalStartTime = performance.now();
      }
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

    results.push({
      correct:  isCorrect,
      rt:       rt,
      num:      q.num,
      answered: symbol
    });

    /* Disable all buttons to block double-clicks */
    disableButtons();

    /* Feedback on clicked button */
    var clickedBtn = getButtonBySymbol(symbol);
    if (clickedBtn) {
      clickedBtn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
    }

    /* On wrong answer: briefly reveal the correct button as a hint */
    if (!isCorrect) {
      var correctBtn = getButtonBySymbol(q.correct);
      if (correctBtn) {
        correctBtn.classList.add('is-hint');
      }
    }

    currentQuestion++;

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
      if (symButtonEls[i].getAttribute('data-symbol') === sym) {
        return symButtonEls[i];
      }
    }
    return null;
  }

  /* Attach click listener to each button */
  symButtonEls.forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAnswer(btn.getAttribute('data-symbol'));
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
    var totalSecs = (totalMs / 1000).toFixed(1);

    /* Performance rating based on accuracy */
    var rating, ratingClass;
    if (accuracy >= 90) {
      rating      = 'Excellent';
      ratingClass = 'excellent';
    } else if (accuracy >= 70) {
      rating      = 'Good';
      ratingClass = 'good';
    } else {
      rating      = 'Needs Improvement';
      ratingClass = 'needs-improvement';
    }

    /* Inject 4 metric tiles (2 × 2 grid) */
    summaryGridEl.innerHTML =
      procTile('Accuracy',    accuracy + '%',        'highlight')                   +
      procTile('Correct',     correct + ' / 20',     correct >= 18 ? 'good' : '')  +
      procTile('Avg. Time',   avgRt + ' ms',         '')                            +
      procTile('Total Time',  totalSecs + ' s',      '');

    /* Inject performance rating pill */
    perfStatusEl.innerHTML =
      '<div class="proc-status-pill proc-status-pill--' + ratingClass + '">'        +
        '<span class="proc-status-pill__dot" aria-hidden="true"></span>'             +
        '<span class="proc-status-pill__label">Performance: ' + rating + '</span>'  +
      '</div>';

    /* Re-render Lucide icons injected into the DOM (arrow-right on continue btn) */
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    goToPhase('summary');

    persistSession({
      accuracy:   accuracy,
      correct:    correct,
      incorrect:  incorrect,
      avgRt:      avgRt,
      totalMs:    totalMs,
      totalSecs:  parseFloat(totalSecs),
      rating:     rating
    });
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

  /* ══════════════════════════════════════════════════════════
     SESSION STORAGE
  ══════════════════════════════════════════════════════════ */

  function persistSession(scores) {
    var user = {};
    try {
      user = JSON.parse(sessionStorage.getItem('cognitrack_user') || '{}');
    } catch (e) { /* user data unavailable */ }

    var session = {
      timestamp:   new Date().toISOString(),
      user:        user,
      assessment:  'processing',
      keyMap:      keyMap,
      questions:   TOTAL_QUESTIONS,
      results:     results,
      scores:      scores
    };

    try {
      sessionStorage.setItem('cognitrack_session_processing', JSON.stringify(session));
    } catch (e) { /* private browsing / storage quota */ }
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    goToPhase('test');
    /* Small delay lets the phase animation settle before first question */
    setTimeout(function () { showQuestion(0); }, 500);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
     Key generated immediately so it shows in the intro phase.
  ══════════════════════════════════════════════════════════ */

  initSession();
  goToPhase('intro');

});
