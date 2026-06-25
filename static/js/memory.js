/* ============================================================
   CogniTrack — Memory Assessment
   memory.js   Sprint 3.5
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     WORD BANK — 90 concrete, neutral nouns
  ══════════════════════════════════════════════════════════ */
  var WORD_BANK = [
    'Apple',   'Acorn',   'Anchor',  'Arrow',   'Bamboo',
    'Barrel',  'Blanket', 'Boulder', 'Bridge',  'Candle',
    'Cedar',   'Cloud',   'Cobble',  'Coral',   'Crane',
    'Cricket', 'Crown',   'Daisy',   'Dolphin', 'Eagle',
    'Ember',   'Fern',    'Flame',   'Flint',   'Flower',
    'Forest',  'Glacier', 'Granite', 'Harbor',  'Hazel',
    'Heron',   'Honey',   'Horizon', 'Horse',   'Lantern',
    'Lemon',   'Leopard', 'Lily',    'Linen',   'Maple',
    'Marble',  'Meadow',  'Mirror',  'Moss',    'Mountain',
    'Mushroom','Nest',    'Oak',     'Opal',    'Otter',
    'Paddle',  'Pebble',  'Pepper',  'Pillow',  'Pine',
    'Planet',  'Plum',    'Quartz',  'Rabbit',  'Rainbow',
    'Raven',   'River',   'Robin',   'Rock',    'Saddle',
    'Salmon',  'Sand',    'Silver',  'Snow',    'Sparrow',
    'Spider',  'Stone',   'Storm',   'Stream',  'Sugar',
    'Swan',    'Temple',  'Thorn',   'Timber',  'Torch',
    'Tower',   'Tunnel',  'Turtle',  'Vapor',   'Vessel',
    'Violet',  'Walnut',  'Willow',  'Window',  'Wolf'
  ];

  /* ── Config ─────────────────────────────────────────────── */
  var TIMER_DURATION   = 15;
  var CIRCUMFERENCE    = 2 * Math.PI * 24; /* ≈ 150.80 */
  var TARGET_COUNT     = 5;
  var DISTRACTOR_COUNT = 5;
  var QUESTION_COUNT   = 3;

  /* ── Session State ──────────────────────────────────────── */
  var targetWords     = [];
  var distractors     = [];
  var questions       = [];
  var selectedWords   = {};
  var recallText      = '';
  var assessmentStart = null;
  var timerInterval   = null;
  var timeLeft        = TIMER_DURATION;
  var currentQuestion = 0;

  /* ── DOM Refs ───────────────────────────────────────────── */
  var phases = {
    intro:       document.getElementById('phase-intro'),
    words:       document.getElementById('phase-words'),
    distraction: document.getElementById('phase-distraction'),
    recall:      document.getElementById('phase-recall'),
    recognition: document.getElementById('phase-recognition'),
    complete:    document.getElementById('phase-complete')
  };

  var phaseBar         = document.getElementById('phase-bar');
  var phaseLabel       = document.getElementById('phase-label');
  var phaseNum         = document.getElementById('phase-num');
  var timerCount       = document.getElementById('timer-count');
  var ringFill         = document.getElementById('timer-ring-fill');
  var wordGrid         = document.querySelector('.memory-words');
  var qText            = document.getElementById('q-text');
  var qCurrent         = document.getElementById('q-current');
  var distractInput    = document.getElementById('distraction-input');
  var distractError    = document.getElementById('distraction-error');
  var recallInput      = document.getElementById('recall-input');
  var recognitionGrid  = document.getElementById('recognition-grid');
  var recognitionError = document.getElementById('recognition-error');
  var completeStats    = document.querySelector('.complete-stats');

  /* ── Phase Config ───────────────────────────────────────── */
  var PHASE_ORDER = [
    'intro', 'words', 'distraction', 'recall', 'recognition', 'complete'
  ];

  var PHASE_LABELS = {
    intro:       'Introduction',
    words:       'Study Words',
    distraction: 'Distraction',
    recall:      'Free Recall',
    recognition: 'Recognition',
    complete:    'Complete'
  };

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */

  /* Fisher-Yates shuffle — returns a new shuffled copy */
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* Integer in [min, max] inclusive */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ══════════════════════════════════════════════════════════
     SESSION INIT — called once on page load
  ══════════════════════════════════════════════════════════ */

  function initSession() {
    /* Shuffle the full bank; first 5 = targets, next 5 = distractors */
    var shuffled  = shuffleArray(WORD_BANK);
    targetWords   = shuffled.slice(0, TARGET_COUNT);
    distractors   = shuffled.slice(TARGET_COUNT, TARGET_COUNT + DISTRACTOR_COUNT);
    selectedWords = {};
    recallText    = '';

    /* Generate fresh arithmetic questions */
    questions = generateQuestions(QUESTION_COUNT);

    /* Hydrate the dynamic DOM regions */
    populateWordDisplay();
    populateRecognitionGrid();
  }

  /* ── Phase 2: word cards ────────────────────────────────── */
  function populateWordDisplay() {
    wordGrid.innerHTML = '';
    targetWords.forEach(function (word, i) {
      var div = document.createElement('div');
      div.className   = 'word-card anim-fade-up anim-delay-' + (i + 1);
      div.setAttribute('role', 'listitem');
      div.textContent = word;
      wordGrid.appendChild(div);
    });
  }

  /* ── Phase 5: recognition grid ──────────────────────────── */
  function populateRecognitionGrid() {
    /* Combine and shuffle targets + distractors */
    var combined = shuffleArray(targetWords.concat(distractors));
    recognitionGrid.innerHTML = '';

    combined.forEach(function (word) {
      var isTarget = targetWords.indexOf(word) !== -1;
      var btn = document.createElement('button');
      btn.className        = 'recognition-word';
      btn.type             = 'button';
      btn.dataset.word     = word.toLowerCase();
      btn.dataset.target   = isTarget ? 'true' : 'false';
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent      = word;
      btn.addEventListener('click', onRecognitionWordClick);
      recognitionGrid.appendChild(btn);
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
     PHASE 1 → 2: BEGIN
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    assessmentStart = Date.now();
    goToPhase('words');
    startTimer();
  });

  /* ══════════════════════════════════════════════════════════
     PHASE 2: COUNTDOWN TIMER
  ══════════════════════════════════════════════════════════ */

  function startTimer() {
    timeLeft = TIMER_DURATION;
    ringFill.style.strokeDasharray  = CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = 0;
    updateTimerDisplay();

    timerInterval = setInterval(function () {
      timeLeft -= 1;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        goToPhase('distraction');
        loadQuestion(0);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    timerCount.textContent = timeLeft;
    var offset = CIRCUMFERENCE * (1 - timeLeft / TIMER_DURATION);
    ringFill.style.strokeDashoffset = offset;

    ringFill.classList.remove('is-warning', 'is-danger');
    if (timeLeft <= 5)      ringFill.classList.add('is-danger');
    else if (timeLeft <= 8) ringFill.classList.add('is-warning');
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 3: DYNAMIC ARITHMETIC DISTRACTION
  ══════════════════════════════════════════════════════════ */

  /* Pick `count` unique operations then generate one question each */
  function generateQuestions(count) {
    var ops = shuffleArray(['add', 'sub', 'mul', 'div']).slice(0, count);
    return ops.map(generateQuestion);
  }

  function generateQuestion(op) {
    var a, b, answer, text;
    switch (op) {
      case 'add':
        a      = randInt(11, 59);
        b      = randInt(11, 59);
        text   = a + ' + ' + b;
        answer = a + b;
        break;

      case 'sub':
        a      = randInt(30, 89);
        b      = randInt(10, a - 10);
        text   = a + ' − ' + b;   /* − */
        answer = a - b;
        break;

      case 'mul':
        a      = randInt(3, 9);
        b      = randInt(3, 9);
        text   = a + ' × ' + b;   /* × */
        answer = a * b;
        break;

      default: /* div — guaranteed exact integer result */
        b      = randInt(2, 9);
        var q  = randInt(3, 9);
        a      = b * q;
        text   = a + ' ÷ ' + b;   /* ÷ */
        answer = q;
        break;
    }
    return { text: text, answer: answer };
  }

  function loadQuestion(idx) {
    currentQuestion      = idx;
    qText.textContent    = questions[idx].text;
    qCurrent.textContent = idx + 1;
    distractInput.value  = '';
    hideError(distractError);
    distractInput.focus();
  }

  document.getElementById('btn-distraction-next').addEventListener('click', advanceQuestion);

  distractInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { advanceQuestion(); }
  });

  function advanceQuestion() {
    if (distractInput.value.trim() === '') {
      showError(distractError, 'Please enter an answer before continuing.');
      return;
    }
    var next = currentQuestion + 1;
    if (next < questions.length) {
      loadQuestion(next);
    } else {
      goToPhase('recall');
      recallInput.focus();
    }
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 4: FREE RECALL
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-recall-continue').addEventListener('click', function () {
    recallText = recallInput.value.trim();
    goToPhase('recognition');
  });

  /* ══════════════════════════════════════════════════════════
     PHASE 5: RECOGNITION
  ══════════════════════════════════════════════════════════ */

  function onRecognitionWordClick() {
    var word    = this.dataset.word;
    var pressed = this.getAttribute('aria-pressed') === 'true';

    if (pressed) {
      this.setAttribute('aria-pressed', 'false');
      this.classList.remove('is-selected');
      delete selectedWords[word];
    } else {
      this.setAttribute('aria-pressed', 'true');
      this.classList.add('is-selected');
      selectedWords[word] = true;
    }
    hideError(recognitionError);
  }

  document.getElementById('btn-recognition-submit').addEventListener('click', function () {
    if (Object.keys(selectedWords).length === 0) {
      showError(recognitionError, 'Please select at least one word before submitting.');
      return;
    }
    buildSummary();
    goToPhase('complete');
  });

  /* ══════════════════════════════════════════════════════════
     PHASE 6: CLINICAL SUMMARY SCREEN
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var targetLower = targetWords.map(function (w) { return w.toLowerCase(); });
    var normalised  = recallText.toLowerCase().replace(/[^a-z\s]/g, '');

    var recallCount = targetLower.filter(function (w) {
      return normalised.indexOf(w) !== -1;
    }).length;

    var recognitionCount = targetLower.filter(function (w) {
      return selectedWords[w] === true;
    }).length;

    var timeTaken = assessmentStart
      ? Math.round((Date.now() - assessmentStart) / 1000)
      : 0;

    var recallPct = Math.round((recallCount / TARGET_COUNT) * 100);

    /* Classify performance on recognition accuracy */
    var status, statusClass;
    if (recognitionCount === 5) {
      status = 'Excellent';     statusClass = 'excellent';
    } else if (recognitionCount >= 3) {
      status = 'Good';          statusClass = 'good';
    } else {
      status = 'Needs Review';  statusClass = 'needs-review';
    }

    /* Replace .complete-stats with a rich summary grid */
    completeStats.className  = 'summary-grid';
    completeStats.innerHTML  =
      tile('Words Presented',   '5')                       +
      tile('Words Recalled',    recallCount + ' / 5') +
      tile('Recognition',       recognitionCount + ' / 5') +
      tile('Recall Accuracy',   recallPct + '%')           +
      tile('Time Taken',        timeTaken + 's')           +
      '<div class="summary-status summary-status--' + statusClass + '">' +
        '<span class="summary-status__dot" aria-hidden="true"></span>' +
        '<span class="summary-status__label">' + status + '</span>'   +
      '</div>';

    /* Persist full session object */
    persistSession({
      recallCount:      recallCount,
      recallPct:        recallPct,
      recognitionCount: recognitionCount,
      timeTaken:        timeTaken,
      status:           status
    });
  }

  function tile(label, value) {
    return (
      '<div class="summary-item">' +
        '<span class="summary-item__label">' + label + '</span>' +
        '<span class="summary-item__value">' + value + '</span>' +
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
    } catch (e) { /* demographic data not available */ }

    var session = {
      timestamp:            new Date().toISOString(),
      user:                 user,
      assessment:           'memory',
      targetWords:          targetWords,
      recallText:           recallText,
      selectedWords:        Object.keys(selectedWords),
      mathQuestionsAnswered: currentQuestion + 1,
      scores:               scores
    };

    try {
      sessionStorage.setItem('cognitrack_session_memory', JSON.stringify(session));
    } catch (e) { /* private browsing or storage quota exceeded */ }
  }

  /* ══════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════ */

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden      = false;
  }

  function hideError(el) {
    el.hidden = true;
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  ringFill.style.strokeDasharray  = CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = 0;
  initSession();
  goToPhase('intro');

});
