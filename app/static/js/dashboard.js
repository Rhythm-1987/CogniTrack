/* ============================================================
   CogniTrack — Dashboard  (Sprint 5 · UI/UX Refinement)
   dashboard.js

   Architecture:
     Data   — sessionStorage reads + score computation + demo history
     Radar  — custom SVG radar chart with animated polygon draw
     Trend  — custom SVG sparkline trend graphs per domain
     UI     — per-section DOM builders
     init() — orchestrator; called on DOMContentLoaded
============================================================ */

(function () {
  'use strict';

  /* ── Domain configuration ──────────────────────────────── */

  /* sessionSuffix/fallbackSuffix are appended to a namespace prefix
     ("cognitrack_" for a real session, "cognitrack_demo_" for a demo
     one) so Data.load() can read either namespace without duplicating
     this table. See resolveMode() / Data.load() below. */
  var DOMAINS = [
    {
      key:            'memory',
      sessionSuffix:  'session_memory',
      label:       'Memory Recall',
      fullLabel:   'Memory Recall',
      icon:        'database',
      color:       '#2563EB',
      colorLight:  '#EFF6FF',
      colorAccent: 'rgba(37, 99, 235, 0.12)',
      radarIndex:  0
    },
    {
      key:            'attention',
      sessionSuffix:  'session_attention',
      label:       'Focus & Attention',
      fullLabel:   'Focus & Attention',
      icon:        'crosshair',
      color:       '#7C3AED',
      colorLight:  '#F5F3FF',
      colorAccent: 'rgba(124, 58, 237, 0.12)',
      radarIndex:  1
    },
    {
      key:            'executive',
      sessionSuffix:  'session_executive',
      label:       'Decision Making',
      fullLabel:   'Decision Making',
      icon:        'sliders',
      color:       '#EA580C',
      colorLight:  '#FFF7ED',
      colorAccent: 'rgba(234, 88, 12, 0.12)',
      radarIndex:  2
    },
    {
      key:            'processing',
      sessionSuffix:  'session_processing',
      label:       'Thinking Speed',
      fullLabel:   'Thinking Speed',
      icon:        'activity',
      color:       '#0891B2',
      colorLight:  '#ECFEFF',
      colorAccent: 'rgba(8, 145, 178, 0.12)',
      radarIndex:  3
    },
    {
      key:              'visual',
      sessionSuffix:    'session_visual',
      fallbackSuffix:   'session_spatial',
      label:       'Visual Reasoning',
      fullLabel:   'Visual Reasoning',
      icon:        'box',
      color:       '#059669',
      colorLight:  '#ECFDF5',
      colorAccent: 'rgba(5, 150, 105, 0.12)',
      radarIndex:  4
    }
  ];

  /* Radar axis labels (ordered to match DOMAINS) */
  var AXIS_LABELS = ['Memory Recall', 'Focus & Attn', 'Decision Mkg', 'Thinking Spd', 'Visual Rsng'];

  /* Plain-English label + one-line explanation for each normalized metric
     key app/core/cci.py emits under a domain's `metrics` (see
     _NORMALIZERS there). Deliberately no numbers/formulas here — this
     powers "Why this score?" (Data.getDomainExplanation), which names
     which behavioural signals fed a domain's score without exposing the
     underlying JSON. Keys must match cci.py's normalizer output keys
     exactly, but stay flat (not nested per-domain) since every key is
     already unique across domains. */
  var METRIC_INFO = {
    nps: {
      label: 'Recognition accuracy',
      blurb: 'How reliably you told previously-seen items apart from new ones.'
    },
    corsiSpan: {
      label: 'Sequence memory span',
      blurb: 'The longest tile sequence you reproduced correctly, in order.'
    },
    reactionSpeed: {
      label: 'Reaction speed',
      blurb: 'How quickly you responded once the target appeared.'
    },
    interferenceControl: {
      label: 'Interference control',
      blurb: 'How little a conflicting cue slowed you down — smaller slowdowns score higher.'
    },
    processingEfficiency: {
      label: 'Processing efficiency',
      blurb: 'A blend of speed and accuracy across the matching questions.'
    },
    rotationComposite: {
      label: 'Spatial accuracy & speed',
      blurb: 'A blend of how many rotations you answered correctly and how quickly.'
    }
  };


  /* ══════════════════════════════════════════════════════════
     DATA LAYER
  ══════════════════════════════════════════════════════════ */

  var Data = {

    user:            null,
    sessions:        {},
    scores:          {},
    overallScore:    0,

    /* CCI (see app/core/cci.py) — computed on read server-side, mirrored
       into sessionStorage by CT.hydrateDashboardData(). null whenever
       unavailable (demo mode never has it; older cached payloads may
       not either) — every reader below must handle that. */
    cci:             null,

    /* Real completed-assessment history, oldest → latest. Populated by
       setHistory() from /api/history for a signed-in user, or backfilled
       to a single real entry by finalizeHistory() for guests/demo (see
       below) — never fabricated. assessmentCount === history.length is
       the single source of truth for "is this a baseline profile?" used
       throughout the UI layer. */
    history:         [],
    assessmentCount: 0,
    remoteHistory:   null,

    /* mode is 'real' or 'demo' — selects which sessionStorage
       namespace to read from. Never both, never guessed. */
    load: function (mode) {
      var prefix = (mode === 'demo') ? 'cognitrack_demo_' : 'cognitrack_';

      try {
        var raw = sessionStorage.getItem(prefix + 'user');
        this.user = raw ? JSON.parse(raw) : null;
      } catch (e) { this.user = null; }

      try {
        var cciRaw = sessionStorage.getItem(prefix + 'cci');
        this.cci = cciRaw ? JSON.parse(cciRaw) : null;
      } catch (e) { this.cci = null; }

      DOMAINS.forEach(function (d) {
        try {
          var raw = sessionStorage.getItem(prefix + d.sessionSuffix);
          if (!raw && d.fallbackSuffix) raw = sessionStorage.getItem(prefix + d.fallbackSuffix);
          Data.sessions[d.key] = raw ? JSON.parse(raw) : null;
        } catch (e) { Data.sessions[d.key] = null; }
      });

      /* Prefer the CCI's literature-grounded domain score (see
         app/core/cci.py) over the legacy per-module `session.score` — e.g.
         Attention's on-screen score is an arbitrary RT formula and
         Executive/Processing/Visuospatial's is accuracy-only, all flagged
         as scientifically weak in research/*.md. Falls back to the legacy
         score whenever the CCI has no value for that domain (demo mode,
         older cached sessions, or a domain whose raw_data didn't produce a
         usable metric) — same graceful-degradation contract this file
         already applies everywhere else. Same 0-100 scale either way, so
         every downstream reader (radar, cards, table, recommendations,
         summary) needs no changes. */
      var total = 0, count = 0;
      DOMAINS.forEach(function (d) {
        var s   = Data.sessions[d.key];
        var cciDomain = Data.getDomainConfidence(d.key);
        var cciScore  = cciDomain && typeof cciDomain.score === 'number' ? cciDomain.score : null;

        if (cciScore !== null) {
          Data.scores[d.key] = Math.round(cciScore);
          total += cciScore;
          count++;
        } else if (s && typeof s.score === 'number') {
          Data.scores[d.key] = Math.round(s.score);
          total += s.score;
          count++;
        } else {
          Data.scores[d.key] = null;
        }
      });

      var cciOverall = this.cci && this.cci.overall && typeof this.cci.overall.score === 'number'
        ? this.cci.overall.score : null;
      this.overallScore = cciOverall !== null ? Math.round(cciOverall) : (count > 0 ? Math.round(total / count) : 0);
    },

    getRating: function (score) {
      if (score === null || score === undefined) return { label: 'N/A', sub: 'No data available', cls: 'neutral' };
      return CT.getRating(score);
    },

    getGreeting: function () {
      var h = new Date().getHours();
      if (h < 12) return { text: 'Good Morning',   icon: 'sun' };
      if (h < 17) return { text: 'Good Afternoon', icon: 'cloud-sun' };
      return              { text: 'Good Evening',   icon: 'moon' };
    },

    getFirstName: function () {
      if (!this.user) return 'there';
      var name = this.user.name || this.user.firstName || this.user.full_name || '';
      return (name.trim().split(/\s+/)[0]) || 'there';
    },

    getTotalDuration: function () {
      var total = 0;
      DOMAINS.forEach(function (d) {
        var s = Data.sessions[d.key];
        if (s && typeof s.duration === 'number') total += s.duration;
      });
      return total;
    },

    getCompletedCount: function () {
      return DOMAINS.filter(function (d) { return Data.sessions[d.key] !== null; }).length;
    },

    getTopStrengths: function () {
      return DOMAINS
        .filter(function (d) { return Data.scores[d.key] !== null; })
        .map(function (d)    { return { domain: d, score: Data.scores[d.key] }; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 3);
    },

    getReactionMetrics: function () {
      var s = this.sessions['attention'];
      if (!s) return null;
      var raw     = s.rawData || {};
      var avg     = typeof s.avgTime === 'number' ? s.avgTime : null;
      var fastest = raw.fastest || raw.minRT || raw.fastestRT || raw.minTime || raw.bestRT || null;
      var slowest = raw.slowest || raw.maxRT || raw.slowestRT || raw.maxTime || raw.worstRT || null;
      return { avg: avg, fastest: fastest, slowest: slowest };
    },

    /* A domain's key in DOMAINS vs. the key it's stored under server-side
       ('visual' locally, 'spatial' in the DB/API — see cognitrack-core.js
       MODULE_ORDER) — the one place that mapping needs to happen when
       reading history entries. */
    domainHistoryKey: function (key) { return key === 'visual' ? 'spatial' : key; },

    /* This domain's CCI confidence entry (see app/core/cci.py), or null
       if no CCI payload is available at all. Never returns a score —
       confidence is a separate, parallel value that never moves score. */
    getDomainConfidence: function (domainKey) {
      if (!this.cci || !this.cci.domains) return null;
      return this.cci.domains[this.domainHistoryKey(domainKey)] || null;
    },

    /* "Why this score?" — turns a domain's already-computed `metrics` and
       `confidenceNotes` (see app/core/cci.py) into plain-English content:
       which behavioural metrics contributed (via METRIC_INFO) and one
       readable confidence sentence. Returns null whenever there's nothing
       to explain (no CCI payload, or this domain never scored) — same
       null-safety contract as getDomainConfidence above. */
    getDomainExplanation: function (domainKey) {
      var conf = this.getDomainConfidence(domainKey);
      if (!conf || conf.score === null) return null;

      var metrics = Object.keys(conf.metrics || {})
        .filter(function (k) { return conf.metrics[k] !== null && METRIC_INFO[k]; })
        .map(function (k) { return METRIC_INFO[k]; });

      var notes = conf.confidenceNotes || [];
      var joinedNotes = notes.length > 1
        ? notes.slice(0, -1).join(', ') + ' and ' + notes[notes.length - 1]
        : notes[0];

      var confidenceSentence = conf.confidenceLabel
        ? conf.confidenceLabel + ' confidence' + (joinedNotes ? ' — based on ' + joinedNotes + '.' : '.')
        : null;

      return { metrics: metrics, confidenceSentence: confidenceSentence };
    },

    /* Normalizes the raw /api/history payload (newest-first, per-domain
       scores keyed by the server's domain names) into Data.history:
       oldest → latest, every entry a real completed AssessmentSession.
       Called with null/undefined for guests, the demo route, or a failed
       fetch — in all of those cases history stays empty here and
       finalizeHistory() below decides what (if anything) to backfill. */
    setHistory: function (rawEntries) {
      var normalized = (rawEntries || []).map(function (e) {
        return {
          assessmentId:    e.assessmentId,
          completedAt:     e.completedAt ? new Date(e.completedAt) : null,
          overallScore:    typeof e.overallScore === 'number' ? Math.round(e.overallScore) : null,
          duration:        e.duration,
          domains:         e.domains || {},
          /* Per-session CCI confidence (see assessment_service.get_history) —
             null on older rows with no CCI payload, same null-safety
             contract as every other confidence reader in this file. */
          confidenceLabel: e.confidenceLabel || null
        };
      }).filter(function (e) { return e.completedAt && e.overallScore !== null; });

      normalized.sort(function (a, b) { return a.completedAt - b.completedAt; });
      this.history = normalized;
      this.assessmentCount = normalized.length;
    },

    /* If no real backend history came back (guest, demo route, or an
       authenticated fetch that failed) but a completed assessment IS
       sitting in sessionStorage, that one assessment is itself real data
       — wrap it as a single history entry rather than inventing a second
       point to draw a line against. This is what makes assessmentCount
       correctly settle at 1 (baseline) instead of 0 for every caller
       that already has a completed run in hand. */
    finalizeHistory: function () {
      if (this.history.length > 0) { return; }
      if (this.getCompletedCount() === 0) { this.assessmentCount = 0; return; }

      var domains = {};
      DOMAINS.forEach(function (d) {
        var s = Data.sessions[d.key];
        if (s && typeof s.score === 'number') {
          domains[Data.domainHistoryKey(d.key)] = Math.round(s.score);
        }
      });

      this.history = [{
        assessmentId:    null,
        completedAt:     new Date(),
        overallScore:    this.overallScore,
        duration:        this.getTotalDuration(),
        domains:         domains,
        confidenceLabel: (this.cci && this.cci.overall && this.cci.overall.confidenceLabel) || null
      }];
      this.assessmentCount = 1;
    },

    /* Real trend vs. the immediately preceding real assessment — null
       (not zero, not estimated) until a second real assessment exists.
       This is the only thing allowed to answer "is the user improving?" */
    getOverallTrend: function () {
      if (this.history.length < 2) { return null; }
      var latest   = this.history[this.history.length - 1];
      var previous = this.history[this.history.length - 2];
      var delta    = latest.overallScore - previous.overallScore;
      var pct      = previous.overallScore > 0 ? Math.round((delta / previous.overallScore) * 100) : 0;
      return { delta: delta, pct: pct };
    },

    /* Overall trend status. "Improving"/"Declining" only ever appear once
       a real second assessment exists to compare against — a single
       assessment is always presented as a baseline, never a trend. */
    getOverallStatus: function () {
      if (this.assessmentCount < 2) {
        return { label: 'Baseline Assessment', cls: 'neutral', icon: 'flag' };
      }
      var trend = this.getOverallTrend();
      if (trend && trend.delta > 0) return { label: 'Improving', cls: 'good',          icon: 'trending-up'   };
      if (trend && trend.delta < 0) return { label: 'Declining', cls: 'needs-review',  icon: 'trending-down' };
      return                              { label: 'Stable',    cls: 'average',       icon: 'minus'          };
    },

    /* Suggested check-in window — never medical scheduling, just a
       deterministic cadence heuristic from data already on hand (overall
       CCI confidence, assessment count, and the same trend already
       computed above). null hides the section entirely when there's
       nothing completed yet to base a suggestion on. */
    getNextAssessmentRecommendation: function () {
      if (this.assessmentCount === 0) return null;

      var overallConfidence = this.cci && this.cci.overall && this.cci.overall.confidenceLabel;
      if (overallConfidence === 'Low') {
        return {
          days: 3,
          reason: 'Today’s result carries low confidence — repeating sooner, under better conditions, gives a clearer baseline.'
        };
      }

      if (this.assessmentCount === 1) {
        return {
          days: 14,
          reason: 'A second assessment establishes whether today’s scores are a stable pattern or a one-off.'
        };
      }

      var trend = this.getOverallTrend();
      if (trend && trend.delta < 0) {
        return {
          days: 14,
          reason: 'Your last two assessments moved in different directions — a sooner check-in helps confirm the trend.'
        };
      }

      return {
        days: 30,
        reason: 'Regular monthly check-ins are enough to track long-term changes without over-testing.'
      };
    },

    /* Real assessment history for the History section — one row per real
       completed AssessmentSession, latest first. Each row's trend is
       computed against the assessment immediately before it; the oldest
       row (and every row when assessmentCount === 1) has no comparison. */
    getHistory: function () {
      var list = this.history.slice().reverse(); /* latest -> oldest */
      return list.map(function (h, i) {
        var rating  = Data.getRating(h.overallScore);
        var earlier = list[i + 1]; /* chronologically-previous entry */
        var hasComparison = !!earlier;
        return {
          /* 1-indexed, oldest = 1 — the list here is latest-first, so
             the oldest entry (last in `list`) is assessment #1. */
          number:        list.length - i,
          date:          h.completedAt
            ? h.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
          score:         h.overallScore,
          rating:        rating.label,
          ratingCls:     rating.cls,
          duration:      h.duration,
          confidenceLabel: h.confidenceLabel,
          isLatest:      i === 0,
          isOldest:      i === list.length - 1,
          hasComparison: hasComparison,
          delta:         hasComparison ? h.overallScore - earlier.overallScore : null
        };
      });
    },

    /* Real per-domain score series (oldest → latest), one point per real
       completed assessment that included that domain. Returns null only
       when there is no real data for the domain at all. Length is always
       >= 1 whenever the dashboard itself is showing data, and callers
       must handle length === 1 (baseline — no line, no trend) themselves. */
    getDomainSeries: function (domainKey) {
      var apiKey = this.domainHistoryKey(domainKey);
      var series = this.history
        .filter(function (h) { return typeof h.domains[apiKey] === 'number'; })
        .map(function (h) { return { score: Math.round(h.domains[apiKey]), date: h.completedAt }; });
      return series.length ? series : null;
    },

    /* Richer recommendations — up to 3 per weak domain, max 6 total */
    getRecommendations: function () {
      var recs   = [];
      var scores = this.scores;

      var tips = {
        memory: {
          label: 'Memory Recall',
          color: '#2563EB',
          icon:  'database',
          low: [
            'Use spaced repetition apps like Anki to strengthen long-term retention.',
            'Practice the method of loci: associate items with vivid spatial landmarks.',
            'Prioritize 7–9 hours of sleep — deep sleep consolidates new memories.'
          ],
          mid: [
            'Try the "teach-back" method: explain what you just learned out loud.',
            'Add mnemonic devices or mind-maps before tackling complex material.',
            'Read for 20 minutes daily to build working memory capacity over time.'
          ],
          high: [
            'Maintain your edge with dual n-back training three times per week.',
            'Learn a new skill or language to keep memory circuits actively engaged.'
          ]
        },
        attention: {
          label: 'Focus & Attention',
          color: '#7C3AED',
          icon:  'crosshair',
          low: [
            'Practice 10-minute mindfulness meditation daily to reduce cognitive scatter.',
            'Use the Pomodoro technique: 25 minutes focused work, 5-minute break.',
            'Minimize phone notifications during cognitively demanding tasks.'
          ],
          mid: [
            'Experiment with binaural beats or white noise during focused work sessions.',
            'Keep a distraction log: write down intrusive thoughts to clear mental space.',
            'Brief aerobic exercise before important tasks measurably sharpens attention.'
          ],
          high: [
            'Try single-task deep work blocks of 90 minutes for peak attention training.',
            'Challenge yourself with increasingly complex reaction-time games.'
          ]
        },
        executive: {
          label: 'Decision Making',
          color: '#EA580C',
          icon:  'sliders',
          low: [
            'Play strategy games like chess or Go to build inhibitory control.',
            'Practice daily journaling to reflect on decision quality and outcomes.',
            'Reduce decision fatigue by simplifying routine choices each morning.'
          ],
          mid: [
            'Try dual-task exercises: solve puzzles while tracking secondary stimuli.',
            'Read about cognitive biases — awareness reduces impulsive decision-making.',
            'Use structured decision frameworks (pros/cons, 10-10-10 rule) regularly.'
          ],
          high: [
            'Take on mentorship or teaching roles to further sharpen planning skills.',
            'Explore complex simulation games that require multi-step strategic thinking.'
          ]
        },
        processing: {
          label: 'Thinking Speed',
          color: '#0891B2',
          icon:  'activity',
          low: [
            'Use speed-reading exercises to train rapid information processing.',
            'Play fast-paced matching or sorting games for 10 minutes daily.',
            'Regular cardiovascular exercise increases neural processing velocity.'
          ],
          mid: [
            'Try mental math drills to accelerate number processing without tools.',
            'Use typing practice apps — keyboard speed correlates with processing speed.',
            'Reaction-time apps (e.g., Human Benchmark) track and improve response time.'
          ],
          high: [
            'Challenge your limits with competitive real-time strategy games.',
            'Try sight-reading music or rapid foreign language listening exercises.'
          ]
        },
        visual: {
          label: 'Visual Reasoning',
          color: '#059669',
          icon:  'box',
          low: [
            'Solve 3-D jigsaw puzzles or Rubik\'s Cube to train spatial reasoning.',
            'Use mental rotation apps or spatial IQ puzzle books regularly.',
            'Practice map reading and navigating without GPS to build spatial memory.'
          ],
          mid: [
            'Try origami or technical drawing to sharpen visual-spatial processing.',
            'Explore architectural or interior design tools that require 3-D thinking.',
            'Play spatial navigation video games — research shows measurable skill gains.'
          ],
          high: [
            'Challenge yourself with advanced mental rotation or perspective puzzles.',
            'Consider STEM hobbies like electronics or robotics for ongoing spatial growth.'
          ]
        }
      };

      DOMAINS.forEach(function (d) {
        var score = scores[d.key];
        if (score === null) return;
        var t = tips[d.key];
        if (!t) return;

        var pool;
        if (score < 60)      pool = t.low;
        else if (score < 75) pool = t.mid;
        else if (score < 88) pool = t.high;
        else return;

        pool.slice(0, 3).forEach(function (text) {
          recs.push({ text: text, label: t.label, color: t.color, icon: t.icon });
        });
      });

      if (recs.length === 0) {
        recs.push({
          text:  'Outstanding across all domains. Maintain your edge with novel learning — a new language, instrument, or complex sport skill.',
          label: 'General',
          color: '#2563EB',
          icon:  'star'
        });
        recs.push({
          text:  'Prioritize 7–9 hours of quality sleep nightly — it is the single highest-leverage habit for sustaining cognitive performance.',
          label: 'Lifestyle',
          color: '#059669',
          icon:  'moon'
        });
      }

      /* Confidence-aware notes (see app/core/cci.py) — placed ahead of the
         generic tips above so they survive the slice(0,6) cap below. Each
         one names the domain and the actual observed reason (session
         check-in factor, trial count, or false-start behavior) rather than
         a generic warning, and is deliberately hedged ("consider") rather
         than diagnostic — Phase 5/6 brief. Never shown for High confidence
         or when no CCI payload exists (demo mode, older cached sessions). */
      var confRecs = [];
      DOMAINS.forEach(function (d) {
        var conf = Data.getDomainConfidence(d.key);
        if (!conf || !conf.confidenceLabel || conf.confidenceLabel === 'High') return;
        var reason = (conf.confidenceNotes || [])[0];
        confRecs.push({
          text:  'Today’s ' + d.label + ' result carries ' + conf.confidenceLabel.toLowerCase() + ' confidence' +
                 (reason ? ' (' + reason + ')' : '') +
                 ' — consider repeating this assessment on a lower-distraction day before drawing conclusions from it.',
          label: d.label + ' · Confidence',
          color: d.color,
          icon:  'info'
        });
      });

      return confRecs.concat(recs).slice(0, 6);
    },

    /* Dynamic cognitive summary paragraph */
    getCognitiveSummary: function () {
      var scores = this.scores;
      var name   = this.getFirstName();
      var lines  = [];

      function scoreDesc(score) {
        if (score === null) return null;
        if (score >= 90) return 'exceptionally strong';
        if (score >= 80) return 'consistently strong';
        if (score >= 70) return 'solid';
        if (score >= 60) return 'moderate';
        return 'an area with room to grow';
      }

      var overall = this.overallScore;
      var rating  = this.getRating(overall);

      lines.push(
        'Your cognitive profile reveals an overall score of ' + overall + '/100 — rated ' + rating.label + '. ' +
        (overall >= 85
          ? name + ', your results reflect a well-functioning cognitive system performing above the norm across most domains.'
          : overall >= 70
            ? name + ', your results indicate a capable cognitive baseline with targeted areas available for further development.'
            : name + ', your results highlight several domains that would benefit from focused cognitive training and lifestyle adjustments.')
      );

      var sorted = DOMAINS
        .filter(function (d) { return scores[d.key] !== null; })
        .map(function (d) { return { label: d.label, score: scores[d.key] }; })
        .sort(function (a, b) { return b.score - a.score; });

      if (sorted.length > 0) {
        var top    = sorted[0];
        var bottom = sorted[sorted.length - 1];
        var desc   = scoreDesc(top.score);
        lines.push(
          top.label + ' stands out as your strongest domain at ' + top.score + ' — ' + desc + '. ' +
          (bottom.score < 75 && bottom.label !== top.label
            ? bottom.label + ' scored ' + bottom.score + ', presenting the most meaningful opportunity for improvement.'
            : 'All other domains are performing within a healthy range.')
        );
      }

      if (scores['memory'] !== null && scores['attention'] !== null) {
        var memScore  = scores['memory'];
        var attnScore = scores['attention'];
        if (Math.abs(memScore - attnScore) <= 8) {
          lines.push('Memory Recall and Focus & Attention are closely aligned, suggesting coherent working memory and sustained concentration systems.');
        } else if (memScore > attnScore) {
          lines.push('Memory Recall outperforms Focus & Attention — consider attention training to unlock your full retention potential.');
        } else {
          lines.push('Your Focus & Attention exceeds Memory Recall — with sustained attention already strong, targeted memory practice could yield rapid gains.');
        }
      }

      lines.push('Continue regular assessments to track longitudinal changes in your cognitive profile over time.');

      return lines.join(' ');
    }
  };


  /* ══════════════════════════════════════════════════════════
     RADAR CHART
  ══════════════════════════════════════════════════════════ */

  var Radar = {

    cx: 155, cy: 148, R: 90,
    SVG_NS: 'http://www.w3.org/2000/svg',

    angle: function (i) { return ((-90 + i * 72) * Math.PI) / 180; },

    pt: function (i, f) {
      var a = this.angle(i);
      return { x: this.cx + f * this.R * Math.cos(a), y: this.cy + f * this.R * Math.sin(a) };
    },

    ptStr: function (i, f) {
      var p = this.pt(i, f);
      return p.x.toFixed(2) + ',' + p.y.toFixed(2);
    },

    el: function (tag) { return document.createElementNS(this.SVG_NS, tag); },

    render: function (scores) {
      var self    = this;
      var gridEl  = document.getElementById('js-radar-grid');
      var axesEl  = document.getElementById('js-radar-axes');
      var polyEl  = document.getElementById('js-radar-polygon');
      var fillEl  = document.getElementById('js-radar-fill');
      var labsEl  = document.getElementById('js-radar-labels');
      var dotsEl  = document.getElementById('js-radar-dots');

      if (!gridEl) return;

      [0.25, 0.5, 0.75, 1.0].forEach(function (f) {
        var pts  = DOMAINS.map(function (_, i) { return self.ptStr(i, f); }).join(' ');
        var poly = self.el('polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'radar-grid-ring' + (f === 1 ? ' radar-grid-ring--outer' : ''));
        gridEl.appendChild(poly);

        if (f < 1) {
          var lp = self.pt(0, f);
          var t  = self.el('text');
          t.setAttribute('x', (lp.x + 5).toFixed(2));
          t.setAttribute('y', (lp.y - 3).toFixed(2));
          t.setAttribute('class', 'radar-grid-label');
          t.textContent = Math.round(f * 100);
          gridEl.appendChild(t);
        }
      });

      DOMAINS.forEach(function (_, i) {
        var outer = self.pt(i, 1);
        var line  = self.el('line');
        line.setAttribute('x1', self.cx); line.setAttribute('y1', self.cy);
        line.setAttribute('x2', outer.x.toFixed(2)); line.setAttribute('y2', outer.y.toFixed(2));
        line.setAttribute('class', 'radar-axis-line');
        axesEl.appendChild(line);
      });

      var dataPoints = DOMAINS.map(function (d, i) {
        var score = scores[d.key];
        var f     = (score !== null) ? Math.max(0.04, score / 100) : 0.04;
        return self.ptStr(i, f);
      });

      var finalPtsStr = dataPoints.join(' ');
      var centerPts   = DOMAINS.map(function () { return self.cx + ',' + self.cy; }).join(' ');

      polyEl.setAttribute('points', centerPts);
      fillEl.setAttribute('points', centerPts);

      var nudge = [
        { dx: 0,   dy: -16 },
        { dx: 10,  dy: -8  },
        { dx: 10,  dy: 10  },
        { dx: -10, dy: 10  },
        { dx: -10, dy: -8  }
      ];

      DOMAINS.forEach(function (d, i) {
        var lp     = self.pt(i, 1.28);
        var tx     = lp.x + nudge[i].dx;
        var ty     = lp.y + nudge[i].dy;
        var anchor = tx > self.cx + 8 ? 'start' : tx < self.cx - 8 ? 'end' : 'middle';

        var nameEl = self.el('text');
        nameEl.setAttribute('x', tx.toFixed(2)); nameEl.setAttribute('y', ty.toFixed(2));
        nameEl.setAttribute('class', 'radar-axis-label'); nameEl.setAttribute('text-anchor', anchor);
        nameEl.textContent = AXIS_LABELS[i];
        labsEl.appendChild(nameEl);

        var score = scores[d.key];
        if (score !== null) {
          var scoreEl = self.el('text');
          scoreEl.setAttribute('x', tx.toFixed(2)); scoreEl.setAttribute('y', (ty + 14).toFixed(2));
          scoreEl.setAttribute('class', 'radar-axis-score'); scoreEl.setAttribute('text-anchor', anchor);
          scoreEl.textContent = score;
          labsEl.appendChild(scoreEl);
        }
      });

      DOMAINS.forEach(function (d, i) {
        var score = scores[d.key];
        var f     = (score !== null) ? Math.max(0.04, score / 100) : 0.04;
        var p     = self.pt(i, f);
        var dot   = self.el('circle');
        dot.setAttribute('cx', p.x.toFixed(2)); dot.setAttribute('cy', p.y.toFixed(2));
        dot.setAttribute('r', '5'); dot.setAttribute('class', 'radar-data-dot');
        dotsEl.appendChild(dot);
      });

      self._animatePolygon(polyEl, fillEl, finalPtsStr, centerPts);
    },

    _animatePolygon: function (polyEl, fillEl, finalPtsStr, centerPts) {
      var duration     = 900;
      var start        = null;
      var finalCoords  = finalPtsStr.split(' ').map(function (pair) {
        var parts = pair.split(',');
        return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
      });
      var cx = this.cx, cy = this.cy;

      function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

      function step(ts) {
        if (!start) start = ts;
        var raw  = Math.min((ts - start) / duration, 1);
        var ease = easeOutCubic(raw);
        var pts  = finalCoords.map(function (fc) {
          return (cx + (fc.x - cx) * ease).toFixed(2) + ',' + (cy + (fc.y - cy) * ease).toFixed(2);
        }).join(' ');
        polyEl.setAttribute('points', pts);
        fillEl.setAttribute('points', pts);
        if (raw < 1) requestAnimationFrame(step);
      }

      setTimeout(function () { requestAnimationFrame(step); }, 350);
    }
  };


  /* ══════════════════════════════════════════════════════════
     TREND SPARKLINE (SVG)
     Renders any real number of data points (oldest → latest):
       1 point   → a single centered baseline dot, no line, no fill
       2+ points → the polyline/area/dot chart, generalized to N
                   (no assumption of exactly 3 anywhere below)
  ══════════════════════════════════════════════════════════ */

  var Trend = {

    SVG_NS: 'http://www.w3.org/2000/svg',
    W: 120, H: 48, PAD: 6,

    /* Build a single SVG sparkline and append it to `container`.
       points.length is always >= 1 — callers never pass an empty
       series (Data.getDomainSeries returns null for that case). */
    render: function (container, points, color, domainKey) {
      if (points.length === 1) {
        this._renderBaseline(container, color);
        return;
      }

      var W = this.W, H = this.H, pad = this.PAD;
      var min  = Math.min.apply(null, points) - 5;
      var max  = Math.max.apply(null, points) + 5;
      min = Math.max(0, min); max = Math.min(100, max);
      var range = max - min || 1;

      var ns   = this.SVG_NS;
      var svg  = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('class', 'trend-svg');
      svg.setAttribute('aria-hidden', 'true');

      var gradId = 'tg-' + (domainKey || Math.random().toString(36).slice(2, 7));

      var defs = document.createElementNS(ns, 'defs');

      var lg = document.createElementNS(ns, 'linearGradient');
      lg.setAttribute('id', gradId); lg.setAttribute('x1', '0%'); lg.setAttribute('y1', '0%');
      lg.setAttribute('x2', '0%'); lg.setAttribute('y2', '100%');

      var s1 = document.createElementNS(ns, 'stop');
      s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', color); s1.setAttribute('stop-opacity', '0.2');
      var s2 = document.createElementNS(ns, 'stop');
      s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', color); s2.setAttribute('stop-opacity', '0');

      lg.appendChild(s1); lg.appendChild(s2);
      defs.appendChild(lg);
      svg.appendChild(defs);

      /* points.length >= 2 here, so this division is always safe —
         and works identically whether there are 2, 3, or 50 points. */
      var xStep = (W - pad * 2) / (points.length - 1);
      var coords = points.map(function (v, i) {
        return {
          x: pad + i * xStep,
          y: H - pad - ((v - min) / range) * (H - pad * 2)
        };
      });

      /* Area fill polygon */
      var areaPoints = coords.map(function (c) { return c.x + ',' + c.y; }).join(' ');
      areaPoints += ' ' + coords[coords.length - 1].x + ',' + (H - pad);
      areaPoints += ' ' + coords[0].x + ',' + (H - pad);

      var area = document.createElementNS(ns, 'polygon');
      area.setAttribute('points', areaPoints);
      area.setAttribute('fill', 'url(#' + gradId + ')');
      svg.appendChild(area);

      /* Line */
      var lineEl = document.createElementNS(ns, 'polyline');
      var linePoints = coords.map(function (c) { return c.x + ',' + c.y; }).join(' ');
      lineEl.setAttribute('points', linePoints);
      lineEl.setAttribute('fill', 'none');
      lineEl.setAttribute('stroke', color);
      lineEl.setAttribute('stroke-width', '2');
      lineEl.setAttribute('stroke-linejoin', 'round');
      lineEl.setAttribute('stroke-linecap', 'round');
      lineEl.setAttribute('class', 'trend-line');

      /* Animate line draw using stroke-dasharray trick */
      var len = this._polylineLength(coords);
      lineEl.style.strokeDasharray  = len;
      lineEl.style.strokeDashoffset = len;
      svg.appendChild(lineEl);

      /* Dots — animation delay is set inline per index rather than via
         fixed trend-dot--0/1/2 classes, so any real N (not just 3)
         animates in correctly instead of dots beyond index 2 staying
         permanently invisible. */
      coords.forEach(function (c, i) {
        var dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', c.x); dot.setAttribute('cy', c.y); dot.setAttribute('r', '3');
        dot.setAttribute('fill', color); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
        dot.setAttribute('class', 'trend-dot');
        dot.style.animationDelay = (0.5 + i * 0.12) + 's';
        svg.appendChild(dot);
      });

      container.appendChild(svg);

      /* Trigger animation on next frame */
      setTimeout(function () {
        lineEl.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        lineEl.style.strokeDashoffset = '0';
      }, 200);
    },

    /* A single real assessment has nothing to draw a line against —
       one centered dot on a flat guide, no connecting line, no
       fabricated slope. */
    _renderBaseline: function (container, color) {
      var W = this.W, H = this.H, ns = this.SVG_NS;
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('class', 'trend-svg trend-svg--baseline');
      svg.setAttribute('aria-hidden', 'true');

      var guide = document.createElementNS(ns, 'line');
      guide.setAttribute('x1', 10); guide.setAttribute('y1', H / 2);
      guide.setAttribute('x2', W - 10); guide.setAttribute('y2', H / 2);
      guide.setAttribute('class', 'trend-baseline-guide');
      svg.appendChild(guide);

      var dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', W / 2); dot.setAttribute('cy', H / 2); dot.setAttribute('r', '4');
      dot.setAttribute('fill', color); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
      dot.setAttribute('class', 'trend-dot trend-dot--baseline');
      svg.appendChild(dot);

      container.appendChild(svg);
    },

    _polylineLength: function (coords) {
      var len = 0;
      for (var i = 1; i < coords.length; i++) {
        var dx = coords[i].x - coords[i - 1].x;
        var dy = coords[i].y - coords[i - 1].y;
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return len;
    }
  };


  /* ══════════════════════════════════════════════════════════
     UI BUILDERS
  ══════════════════════════════════════════════════════════ */

  var UI = {

    /* ── Demo Badge ────────────────────────────────────────── */
    demoBadge: function (mode) {
      var el = document.getElementById('js-demo-badge');
      if (!el) return;
      el.hidden = (mode !== 'demo');
    },

    /* ── Guest Banner ──────────────────────────────────────────
       Shown only for a real (non-demo) dashboard belonging to a guest
       (no account) — never for a signed-in user, never on the demo
       route. Friendly, not blocking: guests keep full access to their
       one dashboard, this just explains what an account additionally
       unlocks (saved history, long-term trends). */
    guestBanner: function (mode) {
      var el = document.getElementById('js-guest-banner');
      if (!el) return;
      el.hidden = !(mode === 'real' && typeof CT !== 'undefined' && CT.isAuthenticated && !CT.isAuthenticated());
    },

    /* ── Hero ──────────────────────────────────────────────── */
    hero: function () {
      var greeting = Data.getGreeting();
      var badgeEl  = document.getElementById('js-time-badge');
      var nameEl   = document.getElementById('js-user-name');
      var metaEl   = document.getElementById('js-hero-meta');

      if (badgeEl) {
        badgeEl.innerHTML = '<i data-lucide="' + greeting.icon + '"></i>' + greeting.text;
      }
      if (nameEl) nameEl.textContent = Data.getFirstName();

      if (metaEl) {
        var now     = new Date();
        var dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        var count   = Data.getCompletedCount();
        metaEl.innerHTML =
          '<span class="dash-hero__chip"><i data-lucide="calendar"></i>' + dateStr + '</span>' +
          '<span class="dash-hero__chip"><i data-lucide="check-circle-2"></i>' + count + ' of 5 Assessments Completed</span>';
      }
    },

    /* ── Score Ring ────────────────────────────────────────── */
    score: function () {
      var scoreEl      = document.getElementById('js-overall-score');
      var badgeEl      = document.getElementById('js-rating-badge');
      var subEl        = document.getElementById('js-rating-sub');
      var ringEl       = document.getElementById('js-ring-fill');
      var statusEl     = document.getElementById('js-overall-status');
      var trendEl      = document.getElementById('js-trend-badge');
      var changeLblEl  = document.getElementById('js-score-change-label');
      var changeEl     = document.getElementById('js-score-change');

      var score  = Data.overallScore;
      var rating = Data.getRating(score);
      var status = Data.getOverallStatus();
      var trend  = Data.getOverallTrend(); /* null until a real 2nd assessment exists */

      if (scoreEl) UI._counter(scoreEl, 0, score, 1300);

      if (badgeEl) {
        badgeEl.textContent = rating.label;
        badgeEl.className   = 'dash-rating-badge dash-rating-badge--' + rating.cls;
      }
      if (subEl) subEl.textContent = rating.sub;

      if (statusEl) {
        statusEl.innerHTML  = '<i data-lucide="' + status.icon + '"></i>' + status.label;
        statusEl.className  = 'dash-overall-status dash-overall-status--' + status.cls;
      }

      if (trendEl) {
        if (trend) {
          var sign = trend.delta >= 0 ? '+' : '';
          trendEl.innerHTML = '<i data-lucide="' + (trend.delta >= 0 ? 'trending-up' : 'trending-down') + '"></i>' +
                               sign + trend.pct + '% since last assessment';
          trendEl.className = 'dash-trend-badge dash-trend-badge--' + (trend.delta >= 0 ? 'up' : 'down');
        } else {
          trendEl.innerHTML = '<i data-lucide="info"></i>No comparison available yet';
          trendEl.className = 'dash-trend-badge dash-trend-badge--neutral';
        }
      }

      if (changeLblEl) changeLblEl.textContent = trend ? 'Compared with your previous completed assessment' : 'Comparison';

      if (changeEl) {
        if (trend) {
          var chgSign = trend.delta >= 0 ? '+' : '';
          changeEl.textContent = chgSign + trend.delta + ' pts';
          changeEl.className   = 'dash-score-change ' + (trend.delta >= 0 ? 'dash-score-change--up' : 'dash-score-change--down');
        } else {
          changeEl.textContent = 'No comparison available yet';
          changeEl.className   = 'dash-score-change dash-score-change--neutral';
        }
      }

      UI.cciConfidence();

      if (ringEl) {
        var C      = 2 * Math.PI * 80;
        var target = C * (1 - score / 100);

        var colorMap = {
          excellent:      ['#22C55E', '#4ADE80'],
          good:           ['#2563EB', '#60A5FA'],
          average:        ['#F59E0B', '#FCD34D'],
          'needs-review': ['#EF4444', '#F87171'],
          neutral:        ['#94A3B8', '#CBD5E1']
        };
        var cols = colorMap[rating.cls] || colorMap.good;
        var gs   = document.getElementById('ring-grad-start');
        var ge   = document.getElementById('ring-grad-end');
        if (gs) gs.setAttribute('stop-color', cols[0]);
        if (ge) ge.setAttribute('stop-color', cols[1]);

        ringEl.style.strokeDasharray  = C;
        ringEl.style.strokeDashoffset = C;
        setTimeout(function () {
          ringEl.style.transition      = 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
          ringEl.style.strokeDashoffset = target;
        }, 300);
      }
    },

    /* ── CCI Confidence (overall) ─────────────────────────────
       Confidence never changes the score above it — it's a parallel
       signal about how much to trust today's number (stress, sleep,
       caffeine, distractions, medication, family history, trial count,
       practice effects — see app/core/cci.py). Hidden entirely when no
       CCI payload is available (demo mode, or an older cached session). */
    cciConfidence: function () {
      var wrapEl  = document.getElementById('js-cci-confidence');
      var badgeEl = document.getElementById('js-cci-confidence-badge');
      if (!wrapEl || !badgeEl) return;

      var overall = Data.cci && Data.cci.overall;
      if (!overall || overall.confidenceLabel == null) { wrapEl.hidden = true; return; }

      wrapEl.hidden = false;
      badgeEl.textContent = overall.confidenceLabel;
      badgeEl.className   = 'dash-cci-confidence__badge dash-cci-confidence__badge--' +
        overall.confidenceLabel.toLowerCase();
    },

    /* ── Domain Cards ──────────────────────────────────────── */
    domainCards: function () {
      var grid = document.getElementById('js-domain-grid');
      if (!grid) return;

      DOMAINS.forEach(function (d, idx) {
        var session = Data.sessions[d.key];
        var score   = Data.scores[d.key];
        var rating  = Data.getRating(score);
        var delay   = Math.min(idx + 1, 5);
        var series  = Data.getDomainSeries(d.key);

        var card = document.createElement('div');
        card.className = 'card dash-domain-card scroll-reveal anim-delay-' + delay;
        card.style.setProperty('--domain-color',        d.color);
        card.style.setProperty('--domain-color-light',  d.colorLight);
        card.style.setProperty('--domain-color-accent', d.colorAccent);

        var scoreDisplay = score !== null ? score : '—';
        var timeHtml     = session
          ? '<span class="dash-domain-card__time"><i data-lucide="clock"></i>' + UI._dur(session.duration) + '</span>'
          : '';

        /* Only ever shown once a real second assessment gives this
           domain something real to compare against — a baseline domain
           card never carries a trend arrow. */
        var trendHtml = '';
        var trendSentence = null;
        if (series && series.length >= 2) {
          var delta      = series[series.length - 1].score - series[series.length - 2].score;
          var sign       = delta >= 0 ? '+' : '';
          var trendCls   = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
          var trendIcon  = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
          trendHtml = '<span class="dash-domain-trend dash-domain-trend--' + trendCls + '">' +
                      trendIcon + ' ' + sign + delta +
                      '</span>';

          /* One-sentence version of the same comparison, for the "Why
             this score?" panel below — same data, no fabricated pct
             when the previous score was 0. */
          var prevScore = series[series.length - 2].score;
          var pct = prevScore > 0 ? Math.round((delta / prevScore) * 100) : 0;
          trendSentence = delta === 0
            ? 'Stable across your last two completed assessments.'
            : 'This domain ' + (delta > 0 ? 'improved' : 'declined') + ' by ' + Math.abs(pct) +
              '% compared with your previous completed assessment.';
        }

        /* Confidence badge — only when a CCI payload has this domain
           (see app/core/cci.py). Purely informational, never affects
           the score/bar/rating already rendered above. No title=
           tooltip (screen readers largely ignore it) — the full
           explanation lives in the accessible <details> below instead. */
        var confidenceHtml = '';
        var confidence = Data.getDomainConfidence(d.key);
        if (confidence && confidence.confidenceLabel) {
          confidenceHtml = '<span class="dash-domain-confidence dash-domain-confidence--' +
            confidence.confidenceLabel.toLowerCase() + '">' +
            confidence.confidenceLabel + ' Confidence' +
          '</span>';
        }

        /* "Why this score?" — plain-English metric + confidence
           explanation built entirely from Data.cci (see
           getDomainExplanation). Native <details>: keyboard and
           screen-reader accessible with no extra ARIA wiring. Omitted
           whenever there's nothing to explain. */
        var whyHtml = '';
        var explanation = Data.getDomainExplanation(d.key);
        var hasMetrics = explanation && explanation.metrics.length;
        var confidenceSentence = explanation && explanation.confidenceSentence;
        if (hasMetrics || confidenceSentence || trendSentence) {
          var metricsHtml = hasMetrics ? explanation.metrics.map(function (m) {
            return '<li><strong>' + UI._escape(m.label) + ':</strong> ' + UI._escape(m.blurb) + '</li>';
          }).join('') : '';
          whyHtml =
            '<details class="dash-domain-why">' +
              '<summary>Why this score?</summary>' +
              (metricsHtml ? '<ul class="dash-domain-why__metrics">' + metricsHtml + '</ul>' : '') +
              (trendSentence ? '<p class="dash-domain-why__trend">' + UI._escape(trendSentence) + '</p>' : '') +
              (confidenceSentence
                ? '<p class="dash-domain-why__confidence">' + UI._escape(confidenceSentence) + '</p>'
                : '') +
            '</details>';
        }

        card.innerHTML =
          '<div class="dash-domain-card__header">' +
            '<div class="dash-domain-card__icon"><i data-lucide="' + d.icon + '"></i></div>' +
            '<span class="dash-domain-card__name">' + d.label + '</span>' +
          '</div>' +
          '<div class="dash-domain-card__score' + (score === null ? ' dash-domain-card__score--empty' : '') + '">' +
            scoreDisplay +
          '</div>' +
          '<div class="dash-domain-card__bar">' +
            '<div class="dash-domain-card__bar-fill" data-target="' + (score || 0) + '"></div>' +
          '</div>' +
          '<div class="dash-domain-card__footer">' +
            '<span class="dash-domain-rating dash-domain-rating--' + rating.cls + '">' + rating.label + '</span>' +
            confidenceHtml +
            trendHtml +
            timeHtml +
          '</div>' +
          whyHtml;

        grid.appendChild(card);
      });

      setTimeout(function () {
        document.querySelectorAll('.dash-domain-card__bar-fill').forEach(function (bar) {
          bar.style.transition = 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)';
          bar.style.width      = bar.dataset.target + '%';
        });
      }, 650);
    },

    /* ── Trend Graphs (5 SVG sparklines) ──────────────────────
       Renders correctly for any real series length (1, 2, 3, 10+) —
       see Trend.render's own length===1 branch for the no-line,
       no-arrow baseline case. Nothing here is ever fabricated: a
       domain with only one real assessment shows exactly one point. */
    trendGraphs: function () {
      var container = document.getElementById('js-trend-graphs');
      var subEl      = document.getElementById('js-trend-section-sub');
      if (!container) return;

      if (subEl) {
        subEl.textContent = Data.assessmentCount >= 2
          ? 'Score trajectory across your ' + Data.assessmentCount + ' completed assessments per domain'
          : 'Your baseline scores — trends appear after your next assessment';
      }

      DOMAINS.forEach(function (d) {
        var series = Data.getDomainSeries(d.key);
        if (!series) return;

        var isBaseline = series.length < 2;
        var latest     = series[series.length - 1];

        var card = document.createElement('div');
        card.className = 'trend-card scroll-reveal' + (isBaseline ? ' trend-card--baseline' : '');
        card.style.setProperty('--domain-color', d.color);

        var svgWrap = document.createElement('div');
        svgWrap.className = 'trend-card__graph';

        Trend.render(svgWrap, series.map(function (p) { return p.score; }), d.color, d.key);

        var deltaHtml;
        var deltaNote = '';
        if (isBaseline) {
          deltaHtml = '<span class="trend-card__delta trend-card__delta--baseline">Baseline</span>';
        } else {
          var prev     = series[series.length - 2];
          var delta    = latest.score - prev.score;
          var sign     = delta >= 0 ? '+' : '';
          var trendCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
          deltaHtml =
            '<span class="trend-card__delta trend-card__delta--' + trendCls + '">' +
              (delta > 0 ? '▲' : delta < 0 ? '▼' : '—') + ' ' + sign + delta + ' pts' +
            '</span>';
          deltaNote = '<span class="trend-card__delta-note">Compared with your previous completed assessment</span>';
        }

        card.innerHTML =
          '<div class="trend-card__header">' +
            '<div class="trend-card__icon-wrap"><i data-lucide="' + d.icon + '"></i></div>' +
            '<div class="trend-card__meta">' +
              '<span class="trend-card__label">' + d.label + '</span>' +
              deltaHtml +
              deltaNote +
            '</div>' +
            '<span class="trend-card__score">' + latest.score + '</span>' +
          '</div>';

        card.appendChild(svgWrap);

        if (isBaseline) {
          var note = document.createElement('div');
          note.className = 'trend-card__baseline-note';
          note.textContent = 'No comparison available yet';
          card.appendChild(note);
        } else {
          var labels = document.createElement('div');
          labels.className = 'trend-card__labels';
          labels.innerHTML = series.map(function (p) { return '<span>' + p.score + '</span>'; }).join('');
          card.appendChild(labels);

          var sublabels = document.createElement('div');
          sublabels.className = 'trend-card__sublabels';
          var firstDate = UI._shortDate(series[0].date);
          var lastDate  = UI._shortDate(series[series.length - 1].date);
          sublabels.innerHTML = series.length === 2
            ? '<span>' + firstDate + '</span><span>' + lastDate + '</span>'
            : '<span>' + firstDate + '</span><span>' + series.length + ' assessments</span><span>' + lastDate + '</span>';
          card.appendChild(sublabels);
        }

        container.appendChild(card);
      });
    },

    /* ── Assessment History ────────────────────────────────────
       One row per real completed AssessmentSession — never a
       fabricated entry, never an "(estimated)" placeholder. Renders
       correctly whether there's 1 real session or 50. */
    history: function () {
      var container = document.getElementById('js-history-list');
      var subEl      = document.getElementById('js-history-section-sub');
      if (!container) return;

      var hist = Data.getHistory();

      if (subEl) {
        subEl.textContent = Data.assessmentCount === 1
          ? 'Baseline Established — no comparison available yet'
          : 'Latest and previous sessions at a glance';
      }

      container.innerHTML = hist.map(function (h) {
        var trendHtml;
        if (h.hasComparison) {
          var sign     = h.delta >= 0 ? '+' : '';
          var trendCls = h.delta > 0 ? 'up' : h.delta < 0 ? 'down' : 'flat';
          trendHtml =
            '<span class="hist-trend hist-trend--' + trendCls + '">' +
              '<i data-lucide="' + (h.delta >= 0 ? 'trending-up' : 'trending-down') + '"></i>' +
              sign + h.delta + ' pts' +
            '</span>';
        } else {
          trendHtml = '<span class="hist-trend hist-trend--neutral">No comparison available yet</span>';
        }

        var badgeHtml = '';
        if (Data.assessmentCount === 1) {
          badgeHtml = '<span class="hist-latest-badge">First Assessment</span>';
        } else if (h.isLatest) {
          badgeHtml = '<span class="hist-latest-badge">Latest</span>';
        } else if (h.isOldest) {
          badgeHtml = '<span class="hist-baseline-badge">Baseline</span>';
        }

        var confidenceHtml = h.confidenceLabel
          ? '<span class="dash-domain-confidence dash-domain-confidence--' + h.confidenceLabel.toLowerCase() + '">' +
              h.confidenceLabel + ' Confidence' +
            '</span>'
          : '';

        return (
          '<div class="hist-item' + (h.isLatest ? ' hist-item--latest' : '') + '">' +
            '<div class="hist-item__left">' +
              badgeHtml +
              '<span class="hist-item__date">' +
                '<span class="hist-item__number">#' + h.number + '</span>' +
                '<i data-lucide="calendar"></i>' + h.date +
              '</span>' +
            '</div>' +
            '<div class="hist-item__center">' +
              '<span class="hist-item__score">' + h.score + '</span>' +
              '<span class="hist-item__denom">/100</span>' +
              trendHtml +
            '</div>' +
            '<div class="hist-item__right">' +
              '<span class="dash-rating-badge dash-rating-badge--' + h.ratingCls + '">' + h.rating + '</span>' +
              confidenceHtml +
              '<span class="hist-item__status">Completed</span>' +
              '<span class="hist-item__dur"><i data-lucide="clock"></i>' + UI._dur(h.duration) + '</span>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    },

    /* ── Cognitive Summary ─────────────────────────────────── */
    cognitiveSummary: function () {
      var el = document.getElementById('js-cognitive-summary');
      if (!el) return;
      el.textContent = Data.getCognitiveSummary();
    },

    /* ── Recommended Next Assessment ──────────────────────────
       Hidden entirely when Data.getNextAssessmentRecommendation()
       has nothing to suggest yet (no completed assessment). */
    nextAssessment: function () {
      var sectionEl = document.getElementById('js-next-assessment-section');
      var windowEl  = document.getElementById('js-next-assessment-window');
      var reasonEl  = document.getElementById('js-next-assessment-reason');
      if (!sectionEl) return;

      var rec = Data.getNextAssessmentRecommendation();
      if (!rec) { sectionEl.hidden = true; return; }

      sectionEl.hidden = false;
      if (windowEl) windowEl.textContent = 'In about ' + rec.days + ' day' + (rec.days === 1 ? '' : 's');
      if (reasonEl) reasonEl.textContent = rec.reason;
    },

    /* ── Reaction Metrics ──────────────────────────────────── */
    reactionMetrics: function () {
      var el = document.getElementById('js-reaction-metrics');
      if (!el) return;
      var m = Data.getReactionMetrics();
      if (!m) { el.innerHTML = '<p class="dash-stat-empty">Focus & Attention data unavailable.</p>'; return; }
      function fmtRT(v) { return v ? Math.round(v) + ' ms' : 'N/A'; }
      el.innerHTML =
        UI._statItem(fmtRT(m.avg),     'Average RT',  '') +
        UI._statItem(fmtRT(m.fastest), 'Fastest RT',  'dash-stat-value--success') +
        UI._statItem(fmtRT(m.slowest), 'Slowest RT',  'dash-stat-value--warning');
    },

    /* ── Session Summary ───────────────────────────────────── */
    timeline: function () {
      var el = document.getElementById('js-timeline-stats');
      if (!el) return;
      var count    = Data.getCompletedCount();
      var totalDur = Data.getTotalDuration();
      var now      = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      el.innerHTML =
        UI._statItem(count + ' / 5',   'Completed',      '') +
        UI._statItem(UI._dur(totalDur), 'Total Duration', '') +
        UI._statItem(now,               'Finished At',    '');
    },

    /* ── Top Strengths ─────────────────────────────────────── */
    strengths: function () {
      var el = document.getElementById('js-strengths');
      if (!el) return;
      var top = Data.getTopStrengths();
      if (!top.length) { el.innerHTML = '<li class="dash-empty">Complete assessments to see your strengths.</li>'; return; }
      var medals = ['🥇', '🥈', '🥉'];
      el.innerHTML = top.map(function (item, i) {
        var d      = item.domain;
        var rating = Data.getRating(item.score);
        return (
          '<li class="dash-strength-item" style="--domain-color:' + d.color + '">' +
            '<span class="dash-strength-rank">' + (medals[i] || '#' + (i + 1)) + '</span>' +
            '<div class="dash-strength-info">' +
              '<span class="dash-strength-name">' + d.label + '</span>' +
              '<span class="dash-strength-score-text">' + rating.sub + '</span>' +
            '</div>' +
            '<span class="dash-strength-pts">' + item.score + '</span>' +
          '</li>'
        );
      }).join('');
    },

    /* ── Recommendations (richer, grouped) ────────────────── */
    recommendations: function () {
      var el = document.getElementById('js-recommendations');
      if (!el) return;
      var recs = Data.getRecommendations();

      el.innerHTML = recs.map(function (rec, i) {
        return (
          '<li class="dash-rec-item" style="--rec-color:' + rec.color + '">' +
            '<div class="dash-rec-icon"><i data-lucide="' + rec.icon + '"></i></div>' +
            '<div class="dash-rec-body">' +
              '<span class="dash-rec-domain">' + rec.label + '</span>' +
              '<p class="dash-rec-text">' + UI._escape(rec.text) + '</p>' +
            '</div>' +
          '</li>'
        );
      }).join('');
    },

    /* ── Breakdown Table ───────────────────────────────────── */
    table: function () {
      var tbody = document.getElementById('js-table-body');
      if (!tbody) return;

      tbody.innerHTML = DOMAINS.map(function (d) {
        var session = Data.sessions[d.key];
        var score   = Data.scores[d.key];
        var rating  = Data.getRating(score);

        var domainCell =
          '<div class="dash-table-domain" style="--domain-color:' + d.color + '">' +
            '<div class="dash-table-icon"><i data-lucide="' + d.icon + '"></i></div>' +
            '<span>' + d.fullLabel + '</span>' +
          '</div>';

        if (!session) {
          return '<tr><td>' + domainCell + '</td><td colspan="4" class="dash-table-empty">Not completed</td></tr>';
        }

        var accuracy = session.accuracy != null ? session.accuracy + '%' : 'N/A';

        return '<tr>' +
          '<td>' + domainCell + '</td>' +
          '<td><span class="dash-table-score">' + (score !== null ? score : '—') + '</span></td>' +
          '<td><span class="dash-table-accuracy">' + accuracy + '</span></td>' +
          '<td>' + UI._dur(session.duration) + '</td>' +
          '<td><span class="dash-table-rating dash-table-rating--' + rating.cls + '">' + rating.label + '</span></td>' +
        '</tr>';
      }).join('');
    },

    /* ── Helpers ───────────────────────────────────────────── */

    _statItem: function (value, label, valueClass) {
      return (
        '<div class="dash-stat-item">' +
          '<span class="dash-stat-value ' + (valueClass || '') + '">' + value + '</span>' +
          '<span class="dash-stat-label">' + label + '</span>' +
        '</div>'
      );
    },

    _dur: function (seconds) {
      if (seconds == null || isNaN(seconds)) return 'N/A';
      var m = Math.floor(seconds / 60);
      var s = Math.round(seconds % 60);
      if (m === 0) return s + 's';
      return m + 'm ' + (s > 0 ? s + 's' : '');
    },

    _shortDate: function (d) {
      return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    },

    _escape: function (str) {
      return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _counter: function (el, from, to, duration) {
      var start = null;
      function tick(ts) {
        if (!start) start = ts;
        var raw  = Math.min((ts - start) / duration, 1);
        var ease = 1 - Math.pow(1 - raw, 3);
        el.textContent = Math.round(from + (to - from) * ease);
        if (raw < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  };


  /* ══════════════════════════════════════════════════════════
     SCROLL REVEAL
  ══════════════════════════════════════════════════════════ */

  function initScrollReveal() {
    var els = document.querySelectorAll('.scroll-reveal');
    if (!els.length || !window.IntersectionObserver) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) { observer.observe(el); });
  }

  function refreshIcons() {
    if (typeof CT !== 'undefined') { CT.renderIcons(); }
  }

  /* Retaking must always start clean. From a REAL dashboard that
     means clearing the real namespace and going straight to /memory
     (identity is already known). From a DEMO dashboard, the demo
     identity ("Sarah Williams") isn't the visitor's own, so it clears
     the demo namespace and sends them to /user to enter real details
     first — matching the demo's fictional persona never leaking into
     a real attempt. */
  function wireRetake(mode) {
    var btn = document.getElementById('js-retake-btn');
    if (!btn) return;

    if (mode === 'demo') {
      btn.setAttribute('href', '/user');
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof CT === 'undefined') { window.location.href = this.getAttribute('href'); return; }
      if (mode === 'demo') {
        if (CT.clearDemoData) { CT.clearDemoData(); }
      } else {
        if (CT.clearAssessmentData) { CT.clearAssessmentData(); }
      }
      window.location.href = this.getAttribute('href');
    });
  }

  /* Mode is decided by which ROUTE this page is, not by a flag or
     query param:
       - /dashboard/demo is a dedicated controller. Every visit to it
         regenerates the canonical demo dataset (the ONLY place in the
         app that calls CT.loadDemoData()) and always renders 'demo'.
       - /dashboard (any other path this script runs on) never shows
         demo content — it resolves only between 'real' (a completed
         real assessment exists) and 'empty'.
     This makes it structurally impossible for a plain /dashboard
     visit to render demo content: that code path doesn't exist here. */
  function resolveMode() {
    var isDemoRoute = window.location.pathname.indexOf('/dashboard/demo') === 0;

    if (isDemoRoute) {
      if (typeof CT !== 'undefined' && CT.loadDemoData) { CT.loadDemoData(); }
      return 'demo';
    }

    var progress = (typeof CT !== 'undefined' && CT.loadProgress) ? CT.loadProgress() : null;
    if (progress && progress.assessmentCompleted) {
      return 'real';
    }
    return 'empty';
  }


  /* ══════════════════════════════════════════════════════════
     INIT
     For a signed-in user (not on /dashboard/demo), the database is
     the source of truth: fetch /api/dashboard once and, if it has a
     completed assessment, mirror it into the same sessionStorage
     keys resolveMode()/Data.load() already read via
     CT.hydrateDashboardData() — every rendering function below is
     unaware anything changed. A fetch failure, or no completed
     assessment yet, simply falls through to the existing
     sessionStorage-only resolution.

     Guests get the same database-first treatment now via
     /api/guest/dashboard (no /api/history equivalent for guests —
     see guest_assessment_service, which only tracks the single latest
     guest run, matching the existing single-slot guest experience).
     A guest with no guest_id cookie yet (never reached Check-In) gets
     an empty object back and falls through exactly like a fetch
     failure would. The demo route never touches the network here.
  ══════════════════════════════════════════════════════════ */

  function init() {
    var isDemoRoute = window.location.pathname.indexOf('/dashboard/demo') === 0;
    var isAuthed    = typeof CT !== 'undefined' && CT.isAuthenticated && CT.isAuthenticated();

    if (isDemoRoute) {
      renderDashboard();
      return;
    }

    if (isAuthed) {
      /* /api/dashboard hydrates the current (latest) assessment into
         sessionStorage as before; /api/history is the real source of
         every completed assessment — Data.setHistory() below is the
         only thing allowed to populate trend/history data, so both
         are fetched up front. A failure on either falls back to
         Data.finalizeHistory()'s single-real-entry behaviour rather
         than fabricating anything. */
      Promise.all([
        CT.apiGet('/api/dashboard').catch(function () { return null; }),
        CT.apiGet('/api/history').catch(function () { return null; })
      ]).then(function (results) {
        var dashboardData = results[0];
        var historyData   = results[1];
        if (dashboardData && dashboardData.modules && CT.hydrateDashboardData) {
          CT.hydrateDashboardData(dashboardData);
        }
        Data.remoteHistory = Array.isArray(historyData) ? historyData : null;
        renderDashboard();
      });
      return;
    }

    CT.apiGet('/api/guest/dashboard').catch(function () { return null; }).then(function (dashboardData) {
      if (dashboardData && dashboardData.modules && CT.hydrateDashboardData) {
        CT.hydrateDashboardData(dashboardData);
      }
      renderDashboard();
    });
  }

  function renderDashboard() {
    var mode        = resolveMode();
    var emptyEl     = document.getElementById('js-dashboard-empty');
    var dashboardEl = document.getElementById('js-dashboard');
    var loadingEl   = document.getElementById('js-dashboard-loading');

    if (loadingEl) loadingEl.hidden = true;

    if (mode === 'empty') {
      if (emptyEl)     emptyEl.hidden     = false;
      if (dashboardEl) dashboardEl.hidden = true;
      /* Both buttons here are plain links (Start Assessment -> /user,
         View Demo Dashboard -> /dashboard/demo) — no JS wiring needed. */
      refreshIcons();
      return;
    }

    if (emptyEl)     emptyEl.hidden     = true;
    if (dashboardEl) dashboardEl.hidden = false;

    Data.load(mode);
    Data.setHistory(Data.remoteHistory);
    Data.finalizeHistory();

    UI.demoBadge(mode);
    UI.guestBanner(mode);
    UI.hero();
    UI.score();
    UI.reactionMetrics();
    UI.timeline();
    UI.strengths();
    UI.recommendations();
    UI.cognitiveSummary();
    UI.nextAssessment();

    UI.domainCards();
    UI.trendGraphs();
    UI.history();
    UI.table();

    refreshIcons();
    wireRetake(mode);

    setTimeout(function () {
      Radar.render(Data.scores);
      refreshIcons();
    }, 80);

    initScrollReveal();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
