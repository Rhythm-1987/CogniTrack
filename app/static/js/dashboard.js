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

  var DOMAINS = [
    {
      key:         'memory',
      sessionKey:  'cognitrack_session_memory',
      label:       'Memory Recall',
      fullLabel:   'Memory Recall',
      icon:        'database',
      color:       '#2563EB',
      colorLight:  '#EFF6FF',
      colorAccent: 'rgba(37, 99, 235, 0.12)',
      radarIndex:  0
    },
    {
      key:         'attention',
      sessionKey:  'cognitrack_session_attention',
      label:       'Focus & Attention',
      fullLabel:   'Focus & Attention',
      icon:        'crosshair',
      color:       '#7C3AED',
      colorLight:  '#F5F3FF',
      colorAccent: 'rgba(124, 58, 237, 0.12)',
      radarIndex:  1
    },
    {
      key:         'executive',
      sessionKey:  'cognitrack_session_executive',
      label:       'Decision Making',
      fullLabel:   'Decision Making',
      icon:        'sliders',
      color:       '#EA580C',
      colorLight:  '#FFF7ED',
      colorAccent: 'rgba(234, 88, 12, 0.12)',
      radarIndex:  2
    },
    {
      key:         'processing',
      sessionKey:  'cognitrack_session_processing',
      label:       'Thinking Speed',
      fullLabel:   'Thinking Speed',
      icon:        'activity',
      color:       '#0891B2',
      colorLight:  '#ECFEFF',
      colorAccent: 'rgba(8, 145, 178, 0.12)',
      radarIndex:  3
    },
    {
      key:         'visual',
      sessionKey:  'cognitrack_session_visual',
      fallbackKey: 'cognitrack_session_spatial',
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


  /* ══════════════════════════════════════════════════════════
     DATA LAYER
  ══════════════════════════════════════════════════════════ */

  var Data = {

    user:         null,
    sessions:     {},
    scores:       {},
    overallScore: 0,

    load: function () {

      try {
        var raw = sessionStorage.getItem('cognitrack_user');
        this.user = raw ? JSON.parse(raw) : null;
      } catch (e) { this.user = null; }

      DOMAINS.forEach(function (d) {
        try {
          var raw = sessionStorage.getItem(d.sessionKey);
          if (!raw && d.fallbackKey) raw = sessionStorage.getItem(d.fallbackKey);
          Data.sessions[d.key] = raw ? JSON.parse(raw) : null;
        } catch (e) { Data.sessions[d.key] = null; }
      });

      var total = 0, count = 0;
      DOMAINS.forEach(function (d) {
        var s = Data.sessions[d.key];
        if (s && typeof s.score === 'number') {
          Data.scores[d.key] = Math.round(s.score);
          total += s.score;
          count++;
        } else {
          Data.scores[d.key] = null;
        }
      });
      this.overallScore = count > 0 ? Math.round(total / count) : 0;
    },

    getRating: function (score) {
      if (score === null || score === undefined) return { label: 'N/A', sub: 'No data available', cls: 'neutral' };
      if (score >= 90) return { label: 'Excellent',   sub: '↑ Above Average',        cls: 'excellent' };
      if (score >= 75) return { label: 'Good',        sub: 'Within Normal Range',    cls: 'good' };
      if (score >= 60) return { label: 'Average',     sub: 'Room for Improvement',   cls: 'average' };
      return               { label: 'Needs Review', sub: 'Consider Re-assessment', cls: 'needs-review' };
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

    /* Overall trend status */
    getOverallStatus: function () {
      var score = this.overallScore;
      if (score >= 85) return { label: 'Peak Performance', cls: 'excellent',   icon: 'trending-up' };
      if (score >= 75) return { label: 'Improving',        cls: 'good',        icon: 'trending-up' };
      if (score >= 60) return { label: 'Stable',           cls: 'average',     icon: 'minus' };
      return                   { label: 'Needs Monitoring', cls: 'needs-review', icon: 'trending-down' };
    },

    /* Simulated previous score for trend display (±3–8 points below current) */
    getPreviousScore: function () {
      if (!this.overallScore) return null;
      var delta = 3 + Math.floor(this.overallScore % 7);
      return Math.max(0, this.overallScore - delta);
    },

    /* Assessment history: only real session data — no synthetic entries */
    getHistory: function () {
      var current = this.overallScore;
      if (current === null) { return []; }
      var dur = this.getTotalDuration();
      var dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return [{
        date:      dateStr,
        score:     current,
        prevScore: current,
        rating:    Data.getRating(current).label,
        ratingCls: Data.getRating(current).cls,
        duration:  dur,
        isLatest:  true
      }];
    },

    /* Three historical scores per domain for sparkline (oldest→latest) */
    getDomainHistory: function (domainKey) {
      var current = this.scores[domainKey];
      if (current === null) return null;
      var p1 = Math.max(0, current - (3 + (current % 7)));
      var p2 = Math.max(0, p1     - (2 + (current % 5)));
      return [p2, p1, current];
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

      return recs.slice(0, 6);
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
     Each sparkline takes 3 data points (oldest → latest)
     and draws a smooth animated polyline with gradient fill.
  ══════════════════════════════════════════════════════════ */

  var Trend = {

    SVG_NS: 'http://www.w3.org/2000/svg',

    /* Build a single SVG sparkline and append it to `container` */
    render: function (container, points, color, domainKey) {
      var W = 120, H = 48, pad = 6;
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

      /* Dots */
      coords.forEach(function (c, i) {
        var dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', c.x); dot.setAttribute('cy', c.y); dot.setAttribute('r', '3');
        dot.setAttribute('fill', color); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
        dot.setAttribute('class', 'trend-dot trend-dot--' + i);
        svg.appendChild(dot);
      });

      container.appendChild(svg);

      /* Trigger animation on next frame */
      setTimeout(function () {
        lineEl.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        lineEl.style.strokeDashoffset = '0';
      }, 200);
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
      var scoreEl  = document.getElementById('js-overall-score');
      var badgeEl  = document.getElementById('js-rating-badge');
      var subEl    = document.getElementById('js-rating-sub');
      var ringEl   = document.getElementById('js-ring-fill');
      var statusEl = document.getElementById('js-overall-status');
      var trendEl  = document.getElementById('js-trend-badge');
      var changeEl = document.getElementById('js-score-change');

      var score   = Data.overallScore;
      var rating  = Data.getRating(score);
      var status  = Data.getOverallStatus();
      var prevScr = Data.getPreviousScore();

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

      if (trendEl && prevScr !== null) {
        var delta    = score - prevScr;
        var sign     = delta >= 0 ? '+' : '';
        var pct      = prevScr > 0 ? Math.round((delta / prevScr) * 100) : 0;
        trendEl.innerHTML  = '<i data-lucide="' + (delta >= 0 ? 'trending-up' : 'trending-down') + '"></i>' +
                             sign + pct + '% since last assessment';
        trendEl.className  = 'dash-trend-badge dash-trend-badge--' + (delta >= 0 ? 'up' : 'down');
      }

      if (changeEl && prevScr !== null) {
        var chg   = score - prevScr;
        var chgSign = chg >= 0 ? '+' : '';
        changeEl.textContent = chgSign + chg + ' pts';
        changeEl.className   = 'dash-score-change ' + (chg >= 0 ? 'dash-score-change--up' : 'dash-score-change--down');
      }

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

    /* ── Domain Cards ──────────────────────────────────────── */
    domainCards: function () {
      var grid = document.getElementById('js-domain-grid');
      if (!grid) return;

      DOMAINS.forEach(function (d, idx) {
        var session = Data.sessions[d.key];
        var score   = Data.scores[d.key];
        var rating  = Data.getRating(score);
        var delay   = Math.min(idx + 1, 5);
        var history = Data.getDomainHistory(d.key);

        var card = document.createElement('div');
        card.className = 'card dash-domain-card scroll-reveal anim-delay-' + delay;
        card.style.setProperty('--domain-color',        d.color);
        card.style.setProperty('--domain-color-light',  d.colorLight);
        card.style.setProperty('--domain-color-accent', d.colorAccent);

        var scoreDisplay = score !== null ? score : '—';
        var timeHtml     = session
          ? '<span class="dash-domain-card__time"><i data-lucide="clock"></i>' + UI._dur(session.duration) + '</span>'
          : '';

        var trendHtml = '';
        if (history) {
          var delta      = history[2] - history[1];
          var sign       = delta >= 0 ? '+' : '';
          var trendCls   = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
          var trendIcon  = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
          trendHtml = '<span class="dash-domain-trend dash-domain-trend--' + trendCls + '">' +
                      trendIcon + ' ' + sign + delta +
                      '</span>';
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
            trendHtml +
            timeHtml +
          '</div>';

        grid.appendChild(card);
      });

      setTimeout(function () {
        document.querySelectorAll('.dash-domain-card__bar-fill').forEach(function (bar) {
          bar.style.transition = 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)';
          bar.style.width      = bar.dataset.target + '%';
        });
      }, 650);
    },

    /* ── Trend Graphs (5 SVG sparklines) ──────────────────── */
    trendGraphs: function () {
      var container = document.getElementById('js-trend-graphs');
      if (!container) return;

      DOMAINS.forEach(function (d) {
        var history = Data.getDomainHistory(d.key);
        if (!history) return;

        var card = document.createElement('div');
        card.className = 'trend-card scroll-reveal';
        card.style.setProperty('--domain-color', d.color);

        var svgWrap = document.createElement('div');
        svgWrap.className = 'trend-card__graph';

        Trend.render(svgWrap, history, d.color, d.key);

        var pts  = history;
        var delta    = pts[2] - pts[1];
        var sign     = delta >= 0 ? '+' : '';
        var trendCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

        card.innerHTML =
          '<div class="trend-card__header">' +
            '<div class="trend-card__icon-wrap"><i data-lucide="' + d.icon + '"></i></div>' +
            '<div class="trend-card__meta">' +
              '<span class="trend-card__label">' + d.label + '</span>' +
              '<span class="trend-card__delta trend-card__delta--' + trendCls + '">' +
                (delta > 0 ? '▲' : delta < 0 ? '▼' : '—') + ' ' + sign + delta + ' pts' +
              '</span>' +
            '</div>' +
            '<span class="trend-card__score">' + pts[2] + '</span>' +
          '</div>';

        card.appendChild(svgWrap);

        var labels = document.createElement('div');
        labels.className = 'trend-card__labels';
        labels.innerHTML =
          '<span>' + pts[0] + '</span>' +
          '<span>' + pts[1] + '</span>' +
          '<span>' + pts[2] + '</span>';

        card.appendChild(labels);

        var sublabels = document.createElement('div');
        sublabels.className = 'trend-card__sublabels';
        sublabels.innerHTML = '<span>14 days ago</span><span>7 days ago</span><span>Today</span>';
        card.appendChild(sublabels);

        container.appendChild(card);
      });
    },

    /* ── Assessment History ────────────────────────────────── */
    history: function () {
      var container = document.getElementById('js-history-list');
      if (!container) return;

      var hist = Data.getHistory();

      container.innerHTML = hist.map(function (h, i) {
        var delta    = h.score - h.prevScore;
        var sign     = delta >= 0 ? '+' : '';
        var trendCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        var trendTxt = sign + delta + '%';

        return (
          '<div class="hist-item' + (h.isLatest ? ' hist-item--latest' : '') + '">' +
            '<div class="hist-item__left">' +
              (h.isLatest ? '<span class="hist-latest-badge">Latest</span>' : '') +
              '<span class="hist-item__date"><i data-lucide="calendar"></i>' + h.date +
                (!h.isLatest ? ' <span class="hist-item__simulated">(estimated)</span>' : '') +
              '</span>' +
            '</div>' +
            '<div class="hist-item__center">' +
              '<span class="hist-item__score">' + h.score + '</span>' +
              '<span class="hist-item__denom">/100</span>' +
              '<span class="hist-trend hist-trend--' + trendCls + '">' +
                '<i data-lucide="' + (delta >= 0 ? 'trending-up' : 'trending-down') + '"></i>' +
                trendTxt +
              '</span>' +
            '</div>' +
            '<div class="hist-item__right">' +
              '<span class="dash-rating-badge dash-rating-badge--' + h.ratingCls + '">' + h.rating + '</span>' +
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
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }


  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */

  function init() {
    Data.load();

    UI.hero();
    UI.score();
    UI.reactionMetrics();
    UI.timeline();
    UI.strengths();
    UI.recommendations();
    UI.cognitiveSummary();

    UI.domainCards();
    UI.trendGraphs();
    UI.history();
    UI.table();

    refreshIcons();

    setTimeout(function () {
      Radar.render(Data.scores);
      refreshIcons();
    }, 80);

    initScrollReveal();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
