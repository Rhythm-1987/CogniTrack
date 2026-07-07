/* ============================================================
   CogniTrack — Spatial Reasoning Assessment
   visual.js   Sprint 4.0

   Angular complexity scaling (rotation of correct answer):
     Q  1– 3  → 90°  (easiest)
     Q  4– 7  → 180°
     Q  8–10  → 270° (hardest)

   Final module: triggers confetti + results consolidation.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     SHAPE LIBRARY
     Eight 4×4 asymmetric binary matrices.
     No rotation equals the mirror — guarantees well-formed questions.
  ══════════════════════════════════════════════════════════ */

  var SHAPE_LIBRARY = [
    /* 0 — J */
    [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,0,0]],
    /* 1 — F-pentomino */
    [[1,1,1,0],[1,0,0,0],[1,1,0,0],[0,0,0,0]],
    /* 2 — Z-stair */
    [[0,0,1,0],[0,1,1,0],[0,1,0,0],[1,1,0,0]],
    /* 3 — L-Z */
    [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,1,1,0]],
    /* 4 — Hook-T */
    [[1,1,1,0],[0,0,1,0],[0,1,1,0],[0,0,0,0]],
    /* 5 — Y-extended */
    [[0,1,0,0],[1,1,0,0],[0,1,0,0],[0,1,1,0]],
    /* 6 — Corner-step */
    [[1,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,1,1]],
    /* 7 — S-hook */
    [[0,1,1,0],[0,1,0,0],[1,1,0,0],[1,0,0,0]]
  ];

  var TOTAL_QUESTIONS = 10;

  /* Angular complexity per question index:
     Q1–3  (idx 0–2)  → 90°
     Q4–7  (idx 3–6)  → 180°
     Q8–10 (idx 7–9)  → 270°                                 */
  var ANSWER_ANGLES = [90,90,90, 180,180,180,180, 270,270,270];

  /* ── State ──────────────────────────────────────────────── */
  var questions       = [];
  var currentQuestion = 0;
  var results         = [];
  var questionStart   = 0;
  var answerPending   = false;
  var startedAt       = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:   document.getElementById('phase-intro'),
    test:    document.getElementById('phase-test'),
    summary: document.getElementById('phase-summary')
  };

  var phaseBar      = document.getElementById('vis-phase-bar');
  var phaseLabel    = document.getElementById('vis-phase-label');
  var phaseNum      = document.getElementById('vis-phase-num');
  var qCurrentEl    = document.getElementById('q-current');
  var visQBarEl     = document.getElementById('vis-q-bar');
  var refShapeEl    = document.getElementById('ref-shape');
  var summaryGridEl = document.getElementById('vis-summary-grid');
  var perfStatusEl  = document.getElementById('vis-perf-status');

  var candidateBtns   = [];
  var candidateShapes = [];
  for (var k = 0; k < 4; k++) {
    candidateBtns.push(document.getElementById('cand-' + k));
    candidateShapes.push(document.getElementById('cand-shape-' + k));
  }

  var PHASE_ORDER  = ['intro', 'test', 'summary'];
  var PHASE_LABELS = {
    intro:   'Introduction',
    test:    'Spatial Reasoning',
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

  function cloneMatrix(m) {
    return m.map(function (row) { return row.slice(); });
  }

  /* ══════════════════════════════════════════════════════════
     MATRIX OPERATIONS
  ══════════════════════════════════════════════════════════ */

  function rotate90(matrix) {
    var n = matrix.length, r = [];
    for (var i = 0; i < n; i++) {
      r[i] = [];
      for (var j = 0; j < n; j++) { r[i][j] = matrix[n - 1 - j][i]; }
    }
    return r;
  }

  function rotate(matrix, deg) {
    var steps = (((deg % 360) + 360) % 360) / 90;
    var m = cloneMatrix(matrix);
    for (var i = 0; i < steps; i++) { m = rotate90(m); }
    return m;
  }

  function mirrorH(matrix) {
    var n = matrix.length, r = [];
    for (var i = 0; i < n; i++) {
      r[i] = [];
      for (var j = 0; j < n; j++) { r[i][j] = matrix[i][n - 1 - j]; }
    }
    return r;
  }

  function matricesEqual(a, b) {
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < a[i].length; j++) {
        if (a[i][j] !== b[i][j]) { return false; }
      }
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     SHAPE RENDERING
  ══════════════════════════════════════════════════════════ */

  function renderShape(matrix, containerEl, extraCellClass) {
    containerEl.innerHTML = '';
    for (var row = 0; row < matrix.length; row++) {
      for (var col = 0; col < matrix[row].length; col++) {
        var cell = document.createElement('div');
        cell.className = matrix[row][col]
          ? 'vis-cell vis-cell--filled' + (extraCellClass ? ' ' + extraCellClass : '')
          : 'vis-cell';
        containerEl.appendChild(cell);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     INTRO EXAMPLES
  ══════════════════════════════════════════════════════════ */

  function buildIntroExamples() {
    var base     = SHAPE_LIBRARY[0];
    var rotated  = rotate(base, 180);
    var mirrored = mirrorH(base);

    var exEl = document.getElementById('vis-intro-examples');
    exEl.innerHTML =
      '<div class="vis-ex-group vis-ex-group--ok">' +
        '<div class="vis-ex-shapes">' +
          '<div class="vis-shape vis-shape--example" id="ex-base-1"></div>' +
          '<div class="vis-ex-arrow">&#8594;</div>' +
          '<div class="vis-shape vis-shape--example" id="ex-rotated"></div>' +
        '</div>' +
        '<p class="vis-ex-label vis-ex-label--ok">Same shape, rotated &#10003;</p>' +
      '</div>' +
      '<div class="vis-ex-sep" aria-hidden="true">vs</div>' +
      '<div class="vis-ex-group vis-ex-group--no">' +
        '<div class="vis-ex-shapes">' +
          '<div class="vis-shape vis-shape--example" id="ex-base-2"></div>' +
          '<div class="vis-ex-arrow">&#8594;</div>' +
          '<div class="vis-shape vis-shape--example vis-shape--ex-no" id="ex-mirrored"></div>' +
        '</div>' +
        '<p class="vis-ex-label vis-ex-label--no">Mirror image &#8212; incorrect &#10007;</p>' +
      '</div>';

    renderShape(base,     document.getElementById('ex-base-1'));
    renderShape(rotated,  document.getElementById('ex-rotated'));
    renderShape(base,     document.getElementById('ex-base-2'));
    renderShape(mirrored, document.getElementById('ex-mirrored'));
  }

  /* ══════════════════════════════════════════════════════════
     QUESTION GENERATION — angular complexity per slot

     base     → reference shape (at angle 0)
     corrAngle → forced rotation for the correct option
     3 distractors = rotations of the horizontally-mirrored base
  ══════════════════════════════════════════════════════════ */

  function generateQuestion(base, corrAngle) {
    var reference = cloneMatrix(base);        /* always shown at 0° */
    var correct   = rotate(base, corrAngle);
    var mirror    = mirrorH(base);

    var ANGLES = [0, 90, 180, 270];
    var mirrorRotations = ANGLES.map(function (a) { return rotate(mirror, a); });

    var distractors = shuffleArray(
      mirrorRotations.filter(function (m) { return !matricesEqual(m, correct); })
    ).slice(0, 3);

    /* Guard: pad if filter yields < 3 (should not happen for asymmetric shapes) */
    var maxPadIter = mirrorRotations.length * 4;
    for (var i = 0; distractors.length < 3; i++) {
      if (i > maxPadIter) { break; }
      distractors.push(mirrorRotations[i % mirrorRotations.length]);
    }

    return {
      reference: reference,
      corrAngle: corrAngle,
      options: shuffleArray([
        { matrix: correct,        isCorrect: true  },
        { matrix: distractors[0], isCorrect: false },
        { matrix: distractors[1], isCorrect: false },
        { matrix: distractors[2], isCorrect: false }
      ])
    };
  }

  function generateAllQuestions() {
    /* Cycle through all 8 shapes in shuffled order — trim to 10 */
    var indices = [];
    while (indices.length < TOTAL_QUESTIONS) {
      var pass = [];
      for (var i = 0; i < SHAPE_LIBRARY.length; i++) { pass.push(i); }
      indices = indices.concat(shuffleArray(pass));
    }
    indices = indices.slice(0, TOTAL_QUESTIONS);

    return indices.map(function (shapeIdx, qIdx) {
      return generateQuestion(SHAPE_LIBRARY[shapeIdx], ANSWER_ANGLES[qIdx]);
    });
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
      CT.updateStage('spatial', PHASE_ORDER.indexOf(name), {
        currentQuestion: currentQuestion,
        results:         results,
        startedAt:       startedAt
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     SHOW QUESTION
  ══════════════════════════════════════════════════════════ */

  function showQuestion(idx) {
    var q = questions[idx];

    qCurrentEl.textContent = idx + 1;
    visQBarEl.style.width  = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    renderShape(q.reference, refShapeEl);

    for (var i = 0; i < 4; i++) {
      renderShape(q.options[i].matrix, candidateShapes[i]);
      candidateBtns[i].setAttribute('data-correct', q.options[i].isCorrect ? '1' : '0');
      candidateBtns[i].disabled = false;
      candidateBtns[i].classList.remove('is-correct', 'is-incorrect', 'is-hint');
    }

    questionStart = performance.now();
    answerPending = true;
  }

  /* ══════════════════════════════════════════════════════════
     ANSWER HANDLING
  ══════════════════════════════════════════════════════════ */

  function handleAnswer(btnIndex) {
    if (!answerPending) { return; }
    answerPending = false;

    var rt        = Math.round(performance.now() - questionStart);
    var isCorrect = (candidateBtns[btnIndex].getAttribute('data-correct') === '1');

    results.push({ correct: isCorrect, rt: rt });

    for (var i = 0; i < 4; i++) { candidateBtns[i].disabled = true; }

    candidateBtns[btnIndex].classList.add(isCorrect ? 'is-correct' : 'is-incorrect');

    if (!isCorrect) {
      for (var j = 0; j < 4; j++) {
        if (candidateBtns[j].getAttribute('data-correct') === '1') {
          candidateBtns[j].classList.add('is-hint');
          break;
        }
      }
    }

    currentQuestion++;

    /* Save after each answer */
    if (typeof CT !== 'undefined') {
      CT.updateStage('spatial', 1, {
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
    }, isCorrect ? 420 : 720);
  }

  /* Click listeners */
  (function () {
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        candidateBtns[idx].addEventListener('click', function () {
          handleAnswer(idx);
        });
      }(i));
    }
  }());

  /* ══════════════════════════════════════════════════════════
     KEYBOARD — keys 1 2 3 4 map to candidate buttons
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (!phases.test.classList.contains('is-active')) { return; }
    if (!answerPending) { return; }

    var idx = parseInt(e.key, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx > 3) { return; }

    e.preventDefault();
    if (!candidateBtns[idx].disabled) { handleAnswer(idx); }
  });

  /* ══════════════════════════════════════════════════════════
     SUMMARY — clinical metrics + standardised session + confetti
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var correct   = results.filter(function (r) { return r.correct; }).length;
    var incorrect = TOTAL_QUESTIONS - correct;
    var accuracy  = Math.round((correct / TOTAL_QUESTIONS) * 100);
    var totalRt   = results.reduce(function (s, r) { return s + r.rt; }, 0);
    var avgRt     = Math.round(totalRt / results.length);

    /* Phase-accuracy breakdown */
    var p1 = results.slice(0, 3);
    var p2 = results.slice(3, 7);
    var p3 = results.slice(7);
    var pAcc = function (arr) {
      return arr.length ? Math.round(arr.filter(function (r) { return r.correct; }).length / arr.length * 100) : 0;
    };

    var score     = accuracy;
    var ratingObj = (typeof CT !== 'undefined') ? CT.getRating(score) : legacyRating(accuracy);

    summaryGridEl.innerHTML =
      visTile('Accuracy',   accuracy + '%',    'highlight')                  +
      visTile('Correct',    correct + ' / 10', correct >= 9  ? 'good' : '') +
      visTile('Avg. Time',  avgRt + ' ms',     '')                           +
      visTile('Incorrect',  incorrect,          incorrect > 3 ? 'warn' : '');

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
      CT.writeSession('spatial', startedAt, score, accuracy, avgRt, {
        questions:       TOTAL_QUESTIONS,
        results:         results,
        q1_3Accuracy:    pAcc(p1),
        q4_7Accuracy:    pAcc(p2),
        q8_10Accuracy:   pAcc(p3)
      });

      CT.completeModule('spatial');

      /* Consolidate all 5 modules into cognitrack_results */
      CT.consolidateResults();

      /* Lock continue button during the 4.2 s finale countdown */
      var continueEl = document.querySelector('.vis-continue-btn');
      if (continueEl && CT.lockButton) { CT.lockButton(continueEl); }

      /* Finale portal — confetti + report generation + redirect */
      CT.showFinalePortal();
    }
  }

  function legacyRating(accuracy) {
    if (accuracy >= 87) return { label: 'Excellent',    sub: '↑ Above Average',       cls: 'excellent'    };
    if (accuracy >= 67) return { label: 'Good',         sub: 'Within Normal Range',    cls: 'good'         };
    return                     { label: 'Needs Review', sub: 'Consider Re-assessment', cls: 'needs-review' };
  }

  function visTile(label, value, modifier) {
    var valueClass = 'vis-summary-item__value' +
      (modifier ? ' vis-summary-item__value--' + modifier : '');
    return (
      '<div class="vis-summary-item">'                                   +
        '<span class="vis-summary-item__label">' + label + '</span>'    +
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

    if (progress.modules && progress.modules.spatial) {
      var session = null;
      try { session = JSON.parse(sessionStorage.getItem('cognitrack_session_spatial') || 'null'); } catch (e) {}
      if (session && session.rawData) {
        startedAt       = session.startedAt;
        results         = session.rawData.results || [];
        currentQuestion = TOTAL_QUESTIONS;
        questions       = generateAllQuestions();
        buildSummary();
        return true;
      }
    }

    if (progress.currentModule === 'spatial' && progress.currentStage > 0) {
      var saved = CT.getModuleState('spatial');
      if (saved) {
        results         = saved.results         || [];
        currentQuestion = saved.currentQuestion || 0;
        startedAt       = saved.startedAt;
      }
      questions = generateAllQuestions();
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
    questions = generateAllQuestions();
    goToPhase('test');
    setTimeout(function () { showQuestion(0); }, 500);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  buildIntroExamples();

  if (!attemptRecovery()) {
    goToPhase('intro');
  }

});
