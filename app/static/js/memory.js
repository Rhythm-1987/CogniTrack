/* ============================================================
   CogniTrack — Memory Assessment
   memory.js   Sprint 8 (redesign)

   Encoding  ->  Interference  ->  Recognition

   Encoding: all 11 words (5 easy + 6 medium) shown once, one 20 s
   study window (replaces the old two-timed-trial split).

   Interference: a short, non-verbal visuospatial tile-sequence task
   modeled on the Corsi block-tapping paradigm — a well-established way
   to occupy visuospatial working memory without touching language or
   arithmetic (which the free-recall/math-distraction design it
   replaces both did). 3 rounds of increasing sequence length (3, 4,
   5 tiles); tiles flash in order, the user taps them back in the same
   order. This is a description of the paradigm's lineage, not a
   clinical claim.

   Recognition: unchanged mechanic (click every word you saw from a
   combined target+distractor grid), but now also tracks false
   positives (selecting a distractor) — never captured before.

   Score = recognition accuracy alone. The old 0.6 recognition / 0.4
   typed-recall blend is gone along with typed recall itself; this
   avoids inventing a new unvalidated weighting. Interference metrics
   are stored in raw_data for a future scoring algorithm, not blended
   into today's score.
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
  var EASY_COUNT        = 5;
  var MEDIUM_COUNT       = 6;
  var DISTRACTOR_COUNT   = 6;
  var TIMER_DURATION     = 20;
  var CIRCUMFERENCE      = 2 * Math.PI * 24;   /* ≈ 150.80 */
  var GRID_SIZE          = 9;                  /* 3x3 interference grid */
  var ROUND_LENGTHS      = [3, 4, 5];
  var TILE_FLASH_MS      = 700;
  var TILE_GAP_MS        = 300;
  var TAP_FEEDBACK_MS    = 300;
  var ROUND_PAUSE_MS     = 900;

  /* ── Session state ──────────────────────────────────────── */
  var easyWords        = [];
  var mediumWords       = [];
  var targetWords       = [];   /* easyWords + mediumWords combined */
  var distractors       = [];
  var selectedWords     = {};
  var startedAt         = null;
  var encodingStart     = 0;
  var encodingDurationMs = 0;
  var recognitionStart  = 0;
  var timerInterval     = null;
  var timeLeft          = TIMER_DURATION;

  var tileEls           = [];
  var interferenceRounds = [];
  var currentRoundIndex  = 0;
  var currentSequence    = [];
  var currentTaps        = [];
  var currentTapRTs      = [];
  var tappingEnabled     = false;
  var lastTapEventTime   = 0;

  /* ── DOM refs ───────────────────────────────────────────── */
  var phases = {
    intro:        document.getElementById('phase-intro'),
    encoding:     document.getElementById('phase-encoding'),
    interference: document.getElementById('phase-interference'),
    recognition:  document.getElementById('phase-recognition'),
    complete:     document.getElementById('phase-complete')
  };

  var phaseBar         = document.getElementById('phase-bar');
  var phaseLabel       = document.getElementById('phase-label');
  var phaseNum         = document.getElementById('phase-num');

  var timerCount       = document.getElementById('timer-count');
  var ringFill         = document.getElementById('timer-ring-fill');

  var encodingWordsGrid   = document.getElementById('encoding-words');
  var interferenceGridEl  = document.getElementById('interference-grid');
  var interferenceStatusEl = document.getElementById('interference-status');
  var roundCurrentEl      = document.getElementById('interference-round-current');
  var roundTotalEl        = document.getElementById('interference-round-total');
  var recognitionGrid  = document.getElementById('recognition-grid');
  var recognitionError = document.getElementById('recognition-error');
  var completeStats    = document.getElementById('complete-stats');

  /* ── Phase meta ─────────────────────────────────────────── */
  var PHASE_ORDER = ['intro', 'encoding', 'interference', 'recognition', 'complete'];

  var PHASE_LABELS = {
    intro:        'Introduction',
    encoding:     'Encoding',
    interference: 'Sequence Task',
    recognition:  'Recognition',
    complete:     'Complete'
  };

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */

  function shuffleArray(arr) { return CT.shuffle(arr); }

  function rangeArray(n) {
    var a = [];
    for (var i = 0; i < n; i++) { a.push(i); }
    return a;
  }

  /* ══════════════════════════════════════════════════════════
     SESSION INIT
  ══════════════════════════════════════════════════════════ */

  function initSession() {
    var shuffledEasy   = shuffleArray(EASY_WORDS);
    var shuffledMedium = shuffleArray(MEDIUM_WORDS);

    easyWords   = shuffledEasy.slice(0, EASY_COUNT);
    mediumWords = shuffledMedium.slice(0, MEDIUM_COUNT);
    targetWords = easyWords.concat(mediumWords);     /* 11 total */

    /* Distractors: words not in the target set */
    var usedLower  = targetWords.map(function (w) { return w.toLowerCase(); });
    var distPool   = shuffleArray(
      DISTRACTOR_POOL.filter(function (w) {
        return usedLower.indexOf(w.toLowerCase()) === -1;
      })
    );
    distractors = distPool.slice(0, DISTRACTOR_COUNT);

    selectedWords = {};
    interferenceRounds = [];

    populateEncodingGrid();
    populateInterferenceGrid();
    populateRecognitionGrid();

    /* Save intermediate state for session recovery */
    saveIntermediateState(0);
  }

  function populateEncodingGrid() {
    encodingWordsGrid.innerHTML = '';

    easyWords.forEach(function (word, i) {
      var div = document.createElement('div');
      div.className   = 'word-card anim-fade-up anim-delay-' + ((i % 5) + 1);
      div.setAttribute('role', 'listitem');
      div.textContent = word;
      encodingWordsGrid.appendChild(div);
    });

    mediumWords.forEach(function (word, i) {
      var div = document.createElement('div');
      div.className   = 'word-card word-card--medium anim-fade-up anim-delay-' + ((i % 5) + 1);
      div.setAttribute('role', 'listitem');
      div.textContent = word;
      encodingWordsGrid.appendChild(div);
    });
  }

  /* Built once — tile click handlers stay attached across rounds. */
  function populateInterferenceGrid() {
    interferenceGridEl.innerHTML = '';
    tileEls = [];

    for (var i = 0; i < GRID_SIZE; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'interference-tile';
      btn.setAttribute('data-index', i);
      btn.setAttribute('aria-label', 'Tile ' + (i + 1));
      btn.addEventListener('click', onTileClick);
      interferenceGridEl.appendChild(btn);
      tileEls.push(btn);
    }
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
    startedAt = new Date().toISOString();
    goToPhase('encoding');
    startTimer();
  });

  /* ══════════════════════════════════════════════════════════
     ENCODING TIMER
  ══════════════════════════════════════════════════════════ */

  function startTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timeLeft      = TIMER_DURATION;
    encodingStart = Date.now();

    ringFill.style.strokeDasharray  = CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = 0;
    updateTimerDisplay();

    timerInterval = setInterval(function () {
      timeLeft -= 1;
      updateTimerDisplay();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        encodingDurationMs = Date.now() - encodingStart;
        goToPhase('interference');
        startInterference();
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
     PHASE 3: INTERFERENCE — Corsi-style tile sequence
  ══════════════════════════════════════════════════════════ */

  function startInterference() {
    interferenceRounds = [];
    roundTotalEl.textContent = ROUND_LENGTHS.length;
    runRound(0);
  }

  function runRound(idx) {
    currentRoundIndex = idx;
    roundCurrentEl.textContent = idx + 1;

    currentSequence = shuffleArray(rangeArray(GRID_SIZE)).slice(0, ROUND_LENGTHS[idx]);
    currentTaps     = [];
    currentTapRTs   = [];
    tappingEnabled  = false;

    interferenceStatusEl.textContent = 'Watch carefully…';
    playSequence(currentSequence, 0);
  }

  function playSequence(seq, step) {
    if (step >= seq.length) {
      interferenceStatusEl.textContent = 'Now tap them in order';
      tappingEnabled   = true;
      lastTapEventTime = performance.now();
      return;
    }

    var tile = tileEls[seq[step]];
    tile.classList.add('is-lit');
    setTimeout(function () {
      tile.classList.remove('is-lit');
      setTimeout(function () { playSequence(seq, step + 1); }, TILE_GAP_MS);
    }, TILE_FLASH_MS);
  }

  function onTileClick() {
    if (!tappingEnabled) { return; }

    var idx = parseInt(this.getAttribute('data-index'), 10);
    var now = performance.now();
    currentTaps.push(idx);
    currentTapRTs.push(Math.round(now - lastTapEventTime));
    lastTapEventTime = now;

    var isRightSoFar = currentSequence[currentTaps.length - 1] === idx;
    var el = this;
    el.classList.add(isRightSoFar ? 'is-correct' : 'is-incorrect');
    setTimeout(function () { el.classList.remove('is-correct', 'is-incorrect'); }, TAP_FEEDBACK_MS);

    if (currentTaps.length === currentSequence.length) {
      tappingEnabled = false;
      finishRound();
    }
  }

  function finishRound() {
    var correct = currentSequence.length === currentTaps.length &&
      currentSequence.every(function (v, i) { return v === currentTaps[i]; });

    interferenceRounds.push({
      length:   currentSequence.length,
      sequence: currentSequence.slice(),
      taps:     currentTaps.slice(),
      tapRTs:   currentTapRTs.slice(),
      correct:  correct
    });

    interferenceStatusEl.textContent = correct ? 'Correct!' : 'Not quite — moving on';

    setTimeout(function () {
      if (currentRoundIndex + 1 < ROUND_LENGTHS.length) {
        runRound(currentRoundIndex + 1);
      } else {
        recognitionStart = Date.now();
        goToPhase('recognition');
      }
    }, ROUND_PAUSE_MS);
  }

  function computeInterferenceStats(rounds) {
    var correctRounds = rounds.filter(function (r) { return r.correct; }).length;

    var longestCorrectLength = 0;
    rounds.forEach(function (r) {
      if (r.correct && r.length > longestCorrectLength) { longestCorrectLength = r.length; }
    });

    var allTapRTs = [];
    rounds.forEach(function (r) { (r.tapRTs || []).forEach(function (rt) { allTapRTs.push(rt); }); });
    var meanTapRT = allTapRTs.length
      ? Math.round(allTapRTs.reduce(function (a, b) { return a + b; }, 0) / allTapRTs.length)
      : 0;

    return { correctRounds: correctRounds, longestCorrectLength: longestCorrectLength, meanTapRT: meanTapRT };
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 4: RECOGNITION
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

  function computeRecognitionMetrics() {
    var targetLower = targetWords.map(function (w) { return w.toLowerCase(); });
    var selectedCount = Object.keys(selectedWords).length;

    var hitCount = targetLower.filter(function (w) { return selectedWords[w] === true; }).length;
    var missCount = targetWords.length - hitCount;
    var falsePositiveCount = selectedCount - hitCount;
    var recognitionPct = targetWords.length ? Math.round((hitCount / targetWords.length) * 100) : 0;

    return {
      hitCount: hitCount,
      missCount: missCount,
      falsePositiveCount: falsePositiveCount,
      recognitionPct: recognitionPct
    };
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 5: SUMMARY + SESSION PERSISTENCE
  ══════════════════════════════════════════════════════════ */

  function buildSummary(isRecovery) {
    var metrics = computeRecognitionMetrics();
    var interferenceStats = computeInterferenceStats(interferenceRounds);
    var score = metrics.recognitionPct;
    var ratingObj = CT.getRating(score);

    /* ── Rich assessment summary card ──────────────────── */
    completeStats.className = 'ct-summary-card';
    completeStats.innerHTML =
      '<div class="ct-summary-score">' +
        '<span class="ct-summary-score__num" data-target="' + score + '">0</span>' +
        '<span class="ct-summary-score__label">Score</span>' +
      '</div>' +
      '<div class="ct-summary-grid">' +
        summaryTile('Words Shown',     targetWords.length)                          +
        summaryTile('Recognised',      metrics.hitCount + ' / ' + targetWords.length) +
        summaryTile('Missed',          metrics.missCount)                            +
        summaryTile('False Positives', metrics.falsePositiveCount)                   +
        summaryTile('Sequence Rounds', interferenceStats.correctRounds + ' / ' + ROUND_LENGTHS.length) +
      '</div>' +
      '<div class="ct-summary-rating ct-summary-rating--' + ratingObj.cls + '">' +
        '<span class="ct-summary-rating__label">' + ratingObj.label + '</span>' +
        '<span class="ct-summary-rating__sub">' + ratingObj.sub + '</span>' +
      '</div>';

    animateScore(completeStats.querySelector('[data-target]'), score);

    /* ── Persist standardised session ────────────────────── */
    if (typeof CT !== 'undefined') {
      if (isRecovery) {
        /* Module was already completed — this is a render-only revisit
           (refresh, back button). Never re-write the session or re-show
           the transition card; only resume a background save if the
           previous attempt never reached the server. */
        if (!CT.isModuleSynced('memory')) {
          CT.syncModule('memory', function () {});
        }
        return;
      }

      CT.writeSession('memory', startedAt, score, metrics.recognitionPct, 0, {
        targetWords:         targetWords,
        distractors:         distractors,
        encodingDurationMs:  encodingDurationMs,
        interference: {
          rounds:               interferenceRounds,
          correctRounds:        interferenceStats.correctRounds,
          longestCorrectLength: interferenceStats.longestCorrectLength,
          meanTapRT:            interferenceStats.meanTapRT
        },
        recognitionDurationMs: Date.now() - recognitionStart,
        hitCount:            metrics.hitCount,
        missCount:           metrics.missCount,
        falsePositiveCount:  metrics.falsePositiveCount,
        totalTargets:        targetWords.length,
        recognitionPct:      metrics.recognitionPct,
        selectedWords:       Object.keys(selectedWords)
      });

      /* Automated handshake — transition card after 1.8 s */
      CT.syncModule('memory', function () {
        setTimeout(function () {
          CT.showTransitionCard();
        }, 1800);
      });
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
  function animateScore(el, target) { CT.animateCounter(el, target); }

  /* ══════════════════════════════════════════════════════════
     SESSION RECOVERY
  ══════════════════════════════════════════════════════════ */

  function saveIntermediateState(phaseIndex) {
    if (typeof CT === 'undefined') { return; }
    CT.updateStage('memory', phaseIndex, {
      targetWords: targetWords,
      distractors: distractors,
      startedAt:   startedAt
    });
  }

  function attemptRecovery() {
    if (typeof CT === 'undefined') { return false; }

    var progress = CT.loadProgress();
    if (!progress) { return false; }

    /* Module already completed — go straight to complete */
    if (progress.modules && progress.modules.memory) {
      var session = CT.readSession('memory');

      if (session) {
        startedAt = session.startedAt;
        var raw   = session.rawData || {};
        targetWords = raw.targetWords || [];
        distractors = raw.distractors || [];
        easyWords   = targetWords.slice(0, EASY_COUNT);
        mediumWords = targetWords.slice(EASY_COUNT);
        (raw.selectedWords || []).forEach(function (w) { selectedWords[w] = true; });
        interferenceRounds = (raw.interference && raw.interference.rounds) || [];

        populateEncodingGrid();
        populateInterferenceGrid();
        populateRecognitionGrid();
        buildSummary(true);
        goToPhase('complete');
        return true;
      }
    }

    /* Module in progress — restore word set, restart current phase fresh
       (mid-round interference state isn't meaningfully resumable, same
       simplification the other 4 modules make for their own timed/
       round-based phases). */
    if (progress.currentModule === 'memory' && progress.currentStage > 0) {
      var saved = CT.getModuleState('memory');
      if (saved && saved.targetWords && saved.targetWords.length) {
        targetWords = saved.targetWords;
        distractors = saved.distractors || [];
        easyWords   = targetWords.slice(0, EASY_COUNT);
        mediumWords = targetWords.slice(EASY_COUNT);
        startedAt   = saved.startedAt;
        populateEncodingGrid();
        populateInterferenceGrid();
        populateRecognitionGrid();
      } else {
        initSession();
      }

      var phaseName = PHASE_ORDER[progress.currentStage] || 'intro';
      goToPhase(phaseName);

      if (phaseName === 'encoding') { startTimer(); }
      else if (phaseName === 'interference') { startInterference(); }
      else if (phaseName === 'recognition') { recognitionStart = Date.now(); }

      return true;
    }

    return false;
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD NAVIGATION
     Enter: advances phases and submits inputs (Interference tiles are
     real <button> elements, so Enter/Space already activates a focused
     tile natively — that phase is deliberately excluded below so this
     handler never swallows the keystroke before it gets there).
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }

    var active = Object.keys(phases).find(function (p) {
      return phases[p] && phases[p].classList.contains('is-active');
    });
    if (!active || active === 'interference') { return; }

    e.preventDefault();

    switch (active) {
      case 'intro':
        document.getElementById('btn-begin').click();
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

  if (typeof CT !== 'undefined' && CT.warnBeforeUnload) { CT.warnBeforeUnload(); }

  /* attemptRecovery() must run before initSession(): initSession() ends
     by writing currentStage=0 via saveIntermediateState(0), which would
     otherwise clobber the saved stage before recovery ever reads it,
     making a mid-assessment refresh silently discard all progress and
     restart from the intro screen. Only run initSession() (fresh word
     lists) when there is nothing to recover. */
  if (!attemptRecovery()) {
    initSession();
    goToPhase('intro');
  }

});
