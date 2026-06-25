/* ============================================================
   CogniTrack — Visuospatial Assessment
   visual.js — Mental Rotation Test
   Shapes: 4×4 binary matrices, rotated and mirrored in JS.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     SHAPE LIBRARY
     Eight 4×4 binary matrices.
     All shapes are asymmetric: no rotation equals the mirror.
     This guarantees the test is well-formed for every question.
  ══════════════════════════════════════════════════════════ */

  var SHAPE_LIBRARY = [

    /* 0 — J (classic corner hook) */
    [[1,0,0,0],
     [1,0,0,0],
     [1,0,0,0],
     [1,1,0,0]],

    /* 1 — F-pentomino */
    [[1,1,1,0],
     [1,0,0,0],
     [1,1,0,0],
     [0,0,0,0]],

    /* 2 — Z-stair (diagonal steps) */
    [[0,0,1,0],
     [0,1,1,0],
     [0,1,0,0],
     [1,1,0,0]],

    /* 3 — L-Z (L base with opposite hook) */
    [[1,0,0,0],
     [1,1,0,0],
     [0,1,0,0],
     [0,1,1,0]],

    /* 4 — Hook-T (T with bent arm) */
    [[1,1,1,0],
     [0,0,1,0],
     [0,1,1,0],
     [0,0,0,0]],

    /* 5 — Y-extended (vertical stem with offset branch) */
    [[0,1,0,0],
     [1,1,0,0],
     [0,1,0,0],
     [0,1,1,0]],

    /* 6 — Corner-step (diagonal staircase) */
    [[1,1,0,0],
     [0,1,1,0],
     [0,0,1,0],
     [0,0,1,1]],

    /* 7 — S-hook (reverse S with tail) */
    [[0,1,1,0],
     [0,1,0,0],
     [1,1,0,0],
     [1,0,0,0]]

  ];

  var TOTAL_QUESTIONS = 10;

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */

  var questions       = [];
  var currentQuestion = 0;
  var results         = [];   /* { correct, rt } */
  var questionStart   = 0;    /* performance.now() */
  var answerPending   = false;

  /* ══════════════════════════════════════════════════════════
     DOM REFERENCES
  ══════════════════════════════════════════════════════════ */

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

  /* Candidate buttons + their inner shape containers */
  var candidateBtns   = [];
  var candidateShapes = [];
  for (var k = 0; k < 4; k++) {
    candidateBtns.push(document.getElementById('cand-' + k));
    candidateShapes.push(document.getElementById('cand-shape-' + k));
  }

  /* Phase config */
  var PHASE_ORDER  = ['intro', 'test', 'summary'];
  var PHASE_LABELS = {
    intro:   'Introduction',
    test:    'Rotation Test',
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

  /* Rotate 90° clockwise: new[i][j] = old[n-1-j][i] */
  function rotate90(matrix) {
    var n = matrix.length;
    var r = [];
    for (var i = 0; i < n; i++) {
      r[i] = [];
      for (var j = 0; j < n; j++) {
        r[i][j] = matrix[n - 1 - j][i];
      }
    }
    return r;
  }

  /* Rotate by 0, 90, 180, or 270 degrees clockwise */
  function rotate(matrix, deg) {
    var steps = (((deg % 360) + 360) % 360) / 90; /* 0, 1, 2, or 3 */
    var m = cloneMatrix(matrix);
    for (var i = 0; i < steps; i++) { m = rotate90(m); }
    return m;
  }

  /* Horizontal mirror: new[i][j] = old[i][n-1-j] */
  function mirrorH(matrix) {
    var n = matrix.length;
    var r = [];
    for (var i = 0; i < n; i++) {
      r[i] = [];
      for (var j = 0; j < n; j++) {
        r[i][j] = matrix[i][n - 1 - j];
      }
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
     Injects 16 .vis-cell divs into a .vis-shape container.
  ══════════════════════════════════════════════════════════ */

  function renderShape(matrix, containerEl, extraCellClass) {
    containerEl.innerHTML = '';
    for (var row = 0; row < matrix.length; row++) {
      for (var col = 0; col < matrix[row].length; col++) {
        var cell = document.createElement('div');
        if (matrix[row][col]) {
          cell.className = 'vis-cell vis-cell--filled' +
            (extraCellClass ? ' ' + extraCellClass : '');
        } else {
          cell.className = 'vis-cell';
        }
        containerEl.appendChild(cell);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     INTRO EXAMPLES
     Shows the J-shape: base, 180° rotation (correct), mirror (incorrect).
  ══════════════════════════════════════════════════════════ */

  function buildIntroExamples() {
    var base     = SHAPE_LIBRARY[0];
    var rotated  = rotate(base, 180);  /* clearly visually different from base */
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
     QUESTION GENERATION

     Each question:
       - Reference = rotate(base, refAngle)
       - Correct   = rotate(base, differentAngle)
       - Distractors = 3 rotations of mirrorH(base) that differ
         from the correct option (guaranteed for our asymmetric shapes)

     Strategy for 10 questions from 8 shapes:
       Fill two shuffled passes through the library, trim to 10.
  ══════════════════════════════════════════════════════════ */

  function generateQuestion(base) {
    var ANGLES      = [0, 90, 180, 270];
    var twoAngles   = shuffleArray(ANGLES).slice(0, 2);
    var refAngle    = twoAngles[0];
    var corrAngle   = twoAngles[1];

    var reference = rotate(base, refAngle);
    var correct   = rotate(base, corrAngle);
    var mirror    = mirrorH(base);

    /* All 4 rotations of the mirror; filter out any that happen to
       equal the correct option (edge-case guard) */
    var mirrorRotations = ANGLES.map(function (a) { return rotate(mirror, a); });
    var distractors = shuffleArray(
      mirrorRotations.filter(function (m) { return !matricesEqual(m, correct); })
    ).slice(0, 3);

    /* Belt-and-suspenders: if filter left < 3, pad with remaining */
    if (distractors.length < 3) {
      for (var i = 0; distractors.length < 3; i++) {
        distractors.push(mirrorRotations[i % mirrorRotations.length]);
      }
    }

    return {
      reference: reference,
      options: shuffleArray([
        { matrix: correct,        isCorrect: true  },
        { matrix: distractors[0], isCorrect: false },
        { matrix: distractors[1], isCorrect: false },
        { matrix: distractors[2], isCorrect: false }
      ])
    };
  }

  function generateAllQuestions() {
    /* Cycle through all 8 shapes in shuffled order, twice, trim to 10 */
    var indices = [];
    while (indices.length < TOTAL_QUESTIONS) {
      var pass = [];
      for (var i = 0; i < SHAPE_LIBRARY.length; i++) { pass.push(i); }
      indices = indices.concat(shuffleArray(pass));
    }
    indices = indices.slice(0, TOTAL_QUESTIONS);

    return indices.map(function (idx) {
      return generateQuestion(SHAPE_LIBRARY[idx]);
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

    qCurrentEl.textContent = idx + 1;
    visQBarEl.style.width  = ((idx / TOTAL_QUESTIONS) * 100) + '%';

    /* Render reference shape */
    renderShape(q.reference, refShapeEl);

    /* Render and arm each candidate */
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

    /* Disable all buttons */
    for (var i = 0; i < 4; i++) { candidateBtns[i].disabled = true; }

    /* Feedback on clicked button */
    candidateBtns[btnIndex].classList.add(isCorrect ? 'is-correct' : 'is-incorrect');

    /* If wrong: highlight the correct option as hint */
    if (!isCorrect) {
      for (var j = 0; j < 4; j++) {
        if (candidateBtns[j].getAttribute('data-correct') === '1') {
          candidateBtns[j].classList.add('is-hint');
          break;
        }
      }
    }

    currentQuestion++;

    setTimeout(function () {
      if (currentQuestion < TOTAL_QUESTIONS) {
        showQuestion(currentQuestion);
      } else {
        buildSummary();
      }
    }, isCorrect ? 420 : 720);
  }

  /* Attach click listeners */
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
     SUMMARY — clinical metrics
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var correct   = results.filter(function (r) { return r.correct; }).length;
    var incorrect = TOTAL_QUESTIONS - correct;
    var accuracy  = Math.round((correct / TOTAL_QUESTIONS) * 100);
    var totalRt   = results.reduce(function (s, r) { return s + r.rt; }, 0);
    var avgRt     = Math.round(totalRt / results.length);

    var rating, ratingClass;
    if (accuracy >= 87) {
      rating      = 'Excellent';
      ratingClass = 'excellent';
    } else if (accuracy >= 67) {
      rating      = 'Good';
      ratingClass = 'good';
    } else {
      rating      = 'Needs Improvement';
      ratingClass = 'needs-improvement';
    }

    summaryGridEl.innerHTML =
      visTile('Accuracy',    accuracy + '%',    'highlight')                   +
      visTile('Correct',     correct + ' / 10', correct >= 13 ? 'good' : '')  +
      visTile('Avg. Time',   avgRt + ' ms',     '')                            +
      visTile('Incorrect',   incorrect,          incorrect > 5  ? 'warn' : '');

    perfStatusEl.innerHTML =
      '<div class="vis-status-pill vis-status-pill--' + ratingClass + '">'         +
        '<span class="vis-status-pill__dot" aria-hidden="true"></span>'             +
        '<span class="vis-status-pill__label">Performance: ' + rating + '</span>'  +
      '</div>';

    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    goToPhase('summary');

    persistSession({
      accuracy:  accuracy,
      correct:   correct,
      incorrect: incorrect,
      avgRt:     avgRt,
      rating:    rating
    });
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
      assessment: 'visual',
      questions:  TOTAL_QUESTIONS,
      results:    results,
      scores:     scores
    };

    try {
      sessionStorage.setItem('cognitrack_session_visual', JSON.stringify(session));
    } catch (e) { /* private browsing / storage quota */ }
  }

  /* ══════════════════════════════════════════════════════════
     BEGIN BUTTON
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    questions = generateAllQuestions();
    goToPhase('test');
    setTimeout(function () { showQuestion(0); }, 500);
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
     Build intro examples immediately so shapes appear before
     the user clicks Begin.
  ══════════════════════════════════════════════════════════ */

  buildIntroExamples();
  goToPhase('intro');

});
