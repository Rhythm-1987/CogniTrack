/* ============================================================
   CogniTrack — Memory Assessment
   memory.js   Sprint 4.0

   Two-trial design:
     Trial 1 — 5 easy concrete nouns (15 s study window)
     Trial 2 — 6 abstract / medium nouns (15 s study window)
   Distraction phase (3 arithmetic questions) between trials.
   Free recall + recognition covering all 11 target words.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     WORD TIERS
     Easy  — simple, high-imageability, 1-2 syllable nouns
     Medium — abstract, multi-syllable, lower imageability
  ══════════════════════════════════════════════════════════ */

  var EASY_WORDS = [
    'Apple',  'Chair',   'Cloud',  'Eagle',   'Flame',
    'Horse',  'Honey',   'Lemon',  'Maple',   'Nest',
    'Oak',    'Plum',    'Rock',   'Snow',    'Swan',
    'Wolf',   'Crane',   'Crown',  'Daisy',   'Fern',
    'Flower', 'Heron',   'Lily',   'Moss',    'Pine',
    'Rabbit', 'Raven',   'River',  'Robin',   'Sand',
    'Silver', 'Stone',   'Storm',  'Stream',  'Sugar',
    'Thorn',  'Turtle',  'Willow', 'Window',  'Spider'
  ];

  var MEDIUM_WORDS = [
    'Anchor',  'Arrow',   'Bamboo',  'Barrel',  'Blanket',
    'Boulder', 'Candle',  'Cedar',   'Cobble',  'Cricket',
    'Dolphin', 'Ember',   'Glacier', 'Harbor',  'Hazel',
    'Horizon', 'Lantern', 'Leopard', 'Linen',   'Marble',
    'Meadow',  'Mirror',  'Opal',    'Paddle',  'Planet',
    'Quartz',  'Saddle',  'Salmon',  'Temple',  'Torch',
    'Tower',   'Tunnel',  'Vapor',   'Vessel',  'Violet',
    'Walnut',  'Acorn',   'Timber',  'Pillow',  'Mushroom'
  ];

  /* Remaining words used as recognition distractors */
  var DISTRACTOR_POOL = [
    'Bridge', 'Bucket', 'Button', 'Cabin', 'Carpet',
    'Chalk',  'Chisel', 'Comet',  'Copper','Cymbal',
    'Feather','Figure', 'Funnel', 'Garden','Geyser',
    'Glacier','Gravel', 'Hammer', 'Helmet','Island',
    'Jungle', 'Kettle', 'Knuckle','Ladder','Lantern'
  ];

  /* ── Config ─────────────────────────────────────────────── */
  var TIMER_DURATION    = 15;
  var CIRCUMFERENCE     = 2 * Math.PI * 24;   /* ≈ 150.80 */
  var TRIAL1_COUNT      = 5;
  var TRIAL2_COUNT      = 6;
  var DISTRACTOR_COUNT  = 6;
  var QUESTION_COUNT    = 3;

  /* ── Session state ──────────────────────────────────────── */
  var trial1Words     = [];
  var trial2Words     = [];
  var targetWords     = [];   /* trial1 + trial2 combined */
  var distractors     = [];
  var questions       = [];
  var selectedWords   = {};
  var recallText      = '';
  var assessmentStart = null;
  var startedAt       = null;
  var timerInterval   = null;
  var timeLeft        = TIMER_DURATION;
  var currentQuestion = 0;
  var activeTimer     = 1;    /* 1 = timer for trial1, 2 = timer for trial2 */

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:       document.getElementById('phase-intro'),
    trial1:      document.getElementById('phase-trial1'),
    distraction: document.getElementById('phase-distraction'),
    trial2:      document.getElementById('phase-trial2'),
    recall:      document.getElementById('phase-recall'),
    recognition: document.getElementById('phase-recognition'),
    complete:    document.getElementById('phase-complete')
  };

  var phaseBar         = document.getElementById('phase-bar');
  var phaseLabel       = document.getElementById('phase-label');
  var phaseNum         = document.getElementById('phase-num');

  /* Trial 1 timer refs */
  var timerCount       = document.getElementById('timer-count');
  var ringFill         = document.getElementById('timer-ring-fill');

  /* Trial 2 timer refs */
  var timerCount2      = document.getElementById('timer-count-2');
  var ringFill2        = document.getElementById('timer-ring-fill-2');

  var trial1WordsGrid  = document.querySelector('#phase-trial1 .memory-words');
  var trial2WordsGrid  = document.getElementById('trial2-words');
  var qText            = document.getElementById('q-text');
  var qCurrent         = document.getElementById('q-current');
  var distractInput    = document.getElementById('distraction-input');
  var distractError    = document.getElementById('distraction-error');
  var recallInput      = document.getElementById('recall-input');
  var recognitionGrid  = document.getElementById('recognition-grid');
  var recognitionError = document.getElementById('recognition-error');
  var completeStats    = document.getElementById('complete-stats');

  /* ── Phase meta ─────────────────────────────────────────── */
  var PHASE_ORDER = [
    'intro', 'trial1', 'distraction', 'trial2', 'recall', 'recognition', 'complete'
  ];

  var PHASE_LABELS = {
    intro:       'Introduction',
    trial1:      'Trial 1 — Study',
    distraction: 'Distraction Task',
    trial2:      'Trial 2 — Study',
    recall:      'Free Recall',
    recognition: 'Recognition',
    complete:    'Complete'
  };

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
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
    var shuffledEasy   = shuffleArray(EASY_WORDS);
    var shuffledMedium = shuffleArray(MEDIUM_WORDS);

    trial1Words = shuffledEasy.slice(0, TRIAL1_COUNT);
    trial2Words = shuffledMedium.slice(0, TRIAL2_COUNT);
    targetWords = trial1Words.concat(trial2Words);     /* 11 total */

    /* Distractors: words not in either target set */
    var usedLower  = targetWords.map(function (w) { return w.toLowerCase(); });
    var distPool   = shuffleArray(
      DISTRACTOR_POOL.filter(function (w) {
        return usedLower.indexOf(w.toLowerCase()) === -1;
      })
    );
    distractors = distPool.slice(0, DISTRACTOR_COUNT);

    selectedWords = {};
    recallText    = '';
    questions     = generateQuestions(QUESTION_COUNT);

    populateTrial1Grid();
    populateTrial2Grid();
    populateRecognitionGrid();

    /* Save intermediate state for session recovery */
    saveIntermediateState(0);
  }

  function populateTrial1Grid() {
    trial1WordsGrid.innerHTML = '';
    trial1Words.forEach(function (word, i) {
      var div = document.createElement('div');
      div.className   = 'word-card anim-fade-up anim-delay-' + (i + 1);
      div.setAttribute('role', 'listitem');
      div.textContent = word;
      trial1WordsGrid.appendChild(div);
    });
  }

  function populateTrial2Grid() {
    trial2WordsGrid.innerHTML = '';
    trial2Words.forEach(function (word, i) {
      var div = document.createElement('div');
      div.className   = 'word-card word-card--medium anim-fade-up anim-delay-' + (i + 1);
      div.setAttribute('role', 'listitem');
      div.textContent = word;
      trial2WordsGrid.appendChild(div);
    });
  }

  /* Fisher-Yates shuffled combined grid */
  function populateRecognitionGrid() {
    var combined = shuffleArray(targetWords.concat(distractors));
    recognitionGrid.innerHTML = '';

    combined.forEach(function (word) {
      var isTarget = targetWords.some(function (t) {
        return t.toLowerCase() === word.toLowerCase();
      });

      var btn = document.createElement('button');
      btn.className      = 'recognition-word';
      btn.type           = 'button';
      btn.dataset.word   = word.toLowerCase();
      btn.dataset.target = isTarget ? 'true' : 'false';
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent    = word;
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

    /* Persist current stage for refresh recovery */
    saveIntermediateState(PHASE_ORDER.indexOf(name));

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 1 → 2: BEGIN
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-begin').addEventListener('click', function () {
    startedAt       = new Date().toISOString();
    assessmentStart = Date.now();
    goToPhase('trial1');
    startTimer(1);
  });

  /* ══════════════════════════════════════════════════════════
     COUNTDOWN TIMER  (shared by both trials)
     trialNum: 1 | 2
  ══════════════════════════════════════════════════════════ */

  function startTimer(trialNum) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    activeTimer = trialNum;
    timeLeft    = TIMER_DURATION;

    var countEl = trialNum === 1 ? timerCount  : timerCount2;
    var fillEl  = trialNum === 1 ? ringFill    : ringFill2;

    fillEl.style.strokeDasharray  = CIRCUMFERENCE;
    fillEl.style.strokeDashoffset = 0;
    updateTimerDisplay(countEl, fillEl);

    timerInterval = setInterval(function () {
      timeLeft -= 1;
      updateTimerDisplay(countEl, fillEl);

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;

        if (trialNum === 1) {
          goToPhase('distraction');
          loadQuestion(0);
        } else {
          goToPhase('recall');
          recallInput.focus();
        }
      }
    }, 1000);
  }

  function updateTimerDisplay(countEl, fillEl) {
    countEl.textContent = timeLeft;
    var offset = CIRCUMFERENCE * (1 - timeLeft / TIMER_DURATION);
    fillEl.style.strokeDashoffset = offset;

    fillEl.classList.remove('is-warning', 'is-danger');
    if (timeLeft <= 5)      fillEl.classList.add('is-danger');
    else if (timeLeft <= 8) fillEl.classList.add('is-warning');
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 3: DISTRACTION
  ══════════════════════════════════════════════════════════ */

  function generateQuestions(count) {
    var ops = shuffleArray(['add', 'sub', 'mul', 'div']).slice(0, count);
    return ops.map(generateQuestion);
  }

  function generateQuestion(op) {
    var a, b, answer, text;
    switch (op) {
      case 'add':
        a = randInt(11, 59); b = randInt(11, 59);
        text = a + ' + ' + b; answer = a + b; break;
      case 'sub':
        a = randInt(30, 89); b = randInt(10, a - 10);
        text = a + ' − ' + b; answer = a - b; break;
      case 'mul':
        a = randInt(3, 9); b = randInt(3, 9);
        text = a + ' × ' + b; answer = a * b; break;
      default:
        b = randInt(2, 9); var q = randInt(3, 9); a = b * q;
        text = a + ' ÷ ' + b; answer = q; break;
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
    if (e.key === 'Enter') {
      e.preventDefault();
      advanceQuestion();
    }
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
      goToPhase('trial2');
      startTimer(2);
    }
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 5: FREE RECALL
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btn-recall-continue').addEventListener('click', function () {
    recallText = recallInput.value.trim();
    goToPhase('recognition');
  });

  /* ══════════════════════════════════════════════════════════
     PHASE 6: RECOGNITION
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
    if (typeof CT !== 'undefined' && CT.lockButton) { CT.lockButton(this); }
    buildSummary();
    goToPhase('complete');
  });

  /* ══════════════════════════════════════════════════════════
     PHASE 7: CLINICAL SUMMARY + SESSION PERSISTENCE
  ══════════════════════════════════════════════════════════ */

  function buildSummary() {
    var targetLower = targetWords.map(function (w) { return w.toLowerCase(); });
    var normalised  = recallText.toLowerCase().replace(/[^a-z\s]/g, '');

    var recallCount = targetLower.filter(function (w) {
      return new RegExp('\\b' + w + '\\b').test(normalised);
    }).length;

    var recognitionCount = targetLower.filter(function (w) {
      return selectedWords[w] === true;
    }).length;

    var timeTaken = assessmentStart
      ? Math.round((Date.now() - assessmentStart) / 1000)
      : 0;

    var totalTargets   = targetWords.length;                         /* 11 */
    var recallPct      = Math.round((recallCount / totalTargets) * 100);
    var recognitionPct = Math.round((recognitionCount / totalTargets) * 100);
    var score          = Math.round(recognitionPct * 0.6 + recallPct * 0.4);

    var ratingObj = (typeof CT !== 'undefined') ? CT.getRating(score) : null;
    var ratingLabel = ratingObj ? ratingObj.label : (
      score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Average' : 'Needs Review'
    );

    /* ── Rich assessment summary card ──────────────────── */
    completeStats.className = 'ct-summary-card';
    completeStats.innerHTML =
      '<div class="ct-summary-score">' +
        '<span class="ct-summary-score__num" data-target="' + score + '">0</span>' +
        '<span class="ct-summary-score__label">Score</span>' +
      '</div>' +
      '<div class="ct-summary-grid">' +
        summaryTile('Words Shown',     totalTargets)                          +
        summaryTile('Recalled',        recallCount + ' / ' + totalTargets)   +
        summaryTile('Recognised',      recognitionCount + ' / ' + totalTargets) +
        summaryTile('Recall Accuracy', recallPct + '%')                      +
        summaryTile('Time Taken',      timeTaken + 's')                      +
      '</div>' +
      '<div class="ct-summary-rating ct-summary-rating--' +
          (ratingObj ? ratingObj.cls : 'good') + '">' +
        '<span class="ct-summary-rating__label">' + ratingLabel + '</span>' +
        (ratingObj ? '<span class="ct-summary-rating__sub">' + ratingObj.sub + '</span>' : '') +
      '</div>';

    animateScore(completeStats.querySelector('[data-target]'), score);

    /* ── Persist standardised session ────────────────────── */
    if (typeof CT !== 'undefined') {
      CT.writeSession('memory', startedAt, score, recognitionPct, 0, {
        trial1Words:        trial1Words,
        trial2Words:        trial2Words,
        distractors:        distractors,
        recallText:         recallText,
        recallCount:        recallCount,
        recognitionCount:   recognitionCount,
        totalTargets:       totalTargets,
        recallPct:          recallPct,
        recognitionPct:     recognitionPct,
        mathAnswered:       currentQuestion + 1,
        selectedWords:      Object.keys(selectedWords)
      });

      CT.completeModule('memory');

      /* Automated handshake — transition card after 1.8 s */
      setTimeout(function () {
        CT.showTransitionCard(CT.getNextModuleUrl(), CT.getNextModuleName());
      }, 1800);
    }
  }

  function summaryTile(label, value) {
    return (
      '<div class="ct-summary-item">' +
        '<span class="ct-summary-item__label">' + label + '</span>' +
        '<span class="ct-summary-item__value">' + value + '</span>' +
      '</div>'
    );
  }

  /* CSS counting animation for the score number */
  function animateScore(el, target) {
    if (!el) { return; }
    var start   = 0;
    var dur     = 900;
    var begin   = performance.now();

    function step(now) {
      var p = Math.min((now - begin) / dur, 1);
      el.textContent = Math.round(p * target);
      if (p < 1) { requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════════════════════════
     SESSION RECOVERY
  ══════════════════════════════════════════════════════════ */

  function saveIntermediateState(phaseIndex) {
    if (typeof CT === 'undefined') { return; }
    CT.updateStage('memory', phaseIndex, {
      trial1Words:  trial1Words,
      trial2Words:  trial2Words,
      distractors:  distractors,
      startedAt:    startedAt
    });
  }

  function attemptRecovery() {
    if (typeof CT === 'undefined') { return false; }

    var progress = CT.loadProgress();
    if (!progress) { return false; }

    /* Module already completed — go straight to complete */
    if (progress.modules && progress.modules.memory) {
      var session = null;
      try {
        session = JSON.parse(sessionStorage.getItem('cognitrack_session_memory') || 'null');
      } catch (e) {}

      if (session) {
        /* Restore summary data from saved session */
        startedAt = session.startedAt;
        var raw   = session.rawData || {};
        trial1Words  = raw.trial1Words  || [];
        trial2Words  = raw.trial2Words  || [];
        targetWords  = trial1Words.concat(trial2Words);
        recallText   = raw.recallText   || '';
        /* Rebuild selectedWords map */
        (raw.selectedWords || []).forEach(function (w) { selectedWords[w] = true; });
        buildSummary();
        goToPhase('complete');
        return true;
      }
    }

    /* Module in progress — restore to saved phase */
    if (progress.currentModule === 'memory' && progress.currentStage > 0) {
      var saved = CT.getModuleState('memory');
      if (saved) {
        if (saved.trial1Words) { trial1Words = saved.trial1Words; }
        if (saved.trial2Words) { trial2Words = saved.trial2Words; }
        if (saved.distractors) { distractors = saved.distractors; }
        if (saved.startedAt)   { startedAt   = saved.startedAt; }
        targetWords = trial1Words.concat(trial2Words);
        populateTrial1Grid();
        populateTrial2Grid();
        populateRecognitionGrid();
      }

      var phaseName = PHASE_ORDER[progress.currentStage] || 'intro';
      goToPhase(phaseName);
      return true;
    }

    return false;
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD NAVIGATION
     Enter: advances phases and submits inputs
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }

    /* Only fire keyboard shortcuts when we are NOT inside a textarea */
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'TEXTAREA') { return; }

    e.preventDefault();

    /* Determine active phase */
    var active = PHASE_ORDER.find
      ? PHASE_ORDER.find(function (p) {
          return phases[p] && phases[p].classList.contains('is-active');
        })
      : (function () {
          for (var i = 0; i < PHASE_ORDER.length; i++) {
            if (phases[PHASE_ORDER[i]] && phases[PHASE_ORDER[i]].classList.contains('is-active')) {
              return PHASE_ORDER[i];
            }
          }
          return null;
        }());

    if (!active) { return; }

    switch (active) {
      case 'trial1':
      case 'trial2':
        e.preventDefault();
        break;
      case 'intro':
        document.getElementById('btn-begin').click();
        break;
      case 'distraction':
        document.getElementById('btn-distraction-next').click();
        break;
      case 'recall':
        document.getElementById('btn-recall-continue').click();
        break;
      case 'recognition':
        document.getElementById('btn-recognition-submit').click();
        break;
      default:
        break;
    }
  });

  /* ══════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════ */

  function showError(el, msg) { el.textContent = msg; el.hidden = false; }
  function hideError(el)       { el.hidden = true; }

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  ringFill.style.strokeDasharray  = CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = 0;
  ringFill2.style.strokeDasharray  = CIRCUMFERENCE;
  ringFill2.style.strokeDashoffset = 0;

  initSession();

  if (!attemptRecovery()) {
    goToPhase('intro');
  }

});
