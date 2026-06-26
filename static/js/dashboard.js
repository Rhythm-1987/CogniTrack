/* ============================================================
   CogniTrack — Dashboard
   dashboard.js

   Architecture:
     Data   — sessionStorage reads + score computation
     Radar  — custom SVG radar chart with animated polygon draw
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
      label:       'Memory',
      fullLabel:   'Memory',
      icon:        'database',
      color:       '#2563EB',
      colorLight:  '#EFF6FF',
      colorAccent: 'rgba(37, 99, 235, 0.12)',
      radarIndex:  0
    },
    {
      key:         'attention',
      sessionKey:  'cognitrack_session_attention',
      label:       'Attention',
      fullLabel:   'Attention',
      icon:        'crosshair',
      color:       '#7C3AED',
      colorLight:  '#F5F3FF',
      colorAccent: 'rgba(124, 58, 237, 0.12)',
      radarIndex:  1
    },
    {
      key:         'executive',
      sessionKey:  'cognitrack_session_executive',
      label:       'Executive',
      fullLabel:   'Executive Function',
      icon:        'sliders',
      color:       '#EA580C',
      colorLight:  '#FFF7ED',
      colorAccent: 'rgba(234, 88, 12, 0.12)',
      radarIndex:  2
    },
    {
      key:         'processing',
      sessionKey:  'cognitrack_session_processing',
      label:       'Processing',
      fullLabel:   'Processing Speed',
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
      label:       'Spatial',
      fullLabel:   'Spatial Reasoning',
      icon:        'box',
      color:       '#059669',
      colorLight:  '#ECFDF5',
      colorAccent: 'rgba(5, 150, 105, 0.12)',
      radarIndex:  4
    }
  ];


  /* ══════════════════════════════════════════════════════════
     DATA LAYER
  ══════════════════════════════════════════════════════════ */

  var Data = {

    user:         null,
    sessions:     {},   // domain.key → session object | null
    scores:       {},   // domain.key → number | null
    overallScore: 0,

    /* Load and compute everything once */
    load: function () {

      /* User */
      try {
        var raw = sessionStorage.getItem('cognitrack_user');
        this.user = raw ? JSON.parse(raw) : null;
      } catch (e) {
        this.user = null;
      }

      /* Sessions */
      DOMAINS.forEach(function (d) {
        try {
          var raw = sessionStorage.getItem(d.sessionKey);
          /* visual assessment may have been stored under either key */
          if (!raw && d.fallbackKey) {
            raw = sessionStorage.getItem(d.fallbackKey);
          }
          Data.sessions[d.key] = raw ? JSON.parse(raw) : null;
        } catch (e) {
          Data.sessions[d.key] = null;
        }
      });

      /* Scores + overall */
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
      if (score === null || score === undefined) {
        return { label: 'N/A', sub: 'No data available', cls: 'neutral' };
      }
      if (score >= 90) return { label: 'Excellent',    sub: '↑ Above Average',        cls: 'excellent' };
      if (score >= 75) return { label: 'Good',         sub: 'Within Normal Range',    cls: 'good' };
      if (score >= 60) return { label: 'Average',      sub: 'Room for Improvement',   cls: 'average' };
      return               { label: 'Needs Review',  sub: 'Consider Re-assessment', cls: 'needs-review' };
    },

    getGreeting: function () {
      var h = new Date().getHours();
      if (h < 12) return { text: 'Good Morning',   icon: 'sun' };
      if (h < 17) return { text: 'Good Afternoon', icon: 'cloud-sun' };
      return              { text: 'Good Evening',   icon: 'moon' };
    },

    getFirstName: function () {
      if (!this.user) return 'there';
      var name = this.user.name
               || this.user.firstName
               || this.user.full_name
               || this.user.username
               || '';
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
      var raw      = s.rawData || {};
      var avg      = typeof s.avgTime === 'number' ? s.avgTime : null;
      var fastest  = raw.minRT || raw.fastestRT || raw.minTime || raw.bestRT || null;
      var slowest  = raw.maxRT || raw.slowestRT || raw.maxTime || raw.worstRT || null;
      return { avg: avg, fastest: fastest, slowest: slowest };
    },

    getRecommendations: function () {
      var recs = [];
      var scores = this.scores;

      var tips = {
        memory: {
          low:  'Practise spaced repetition and active recall to strengthen memory encoding.',
          mid:  'Try mnemonic devices or mind-mapping to push your memory score further.'
        },
        attention: {
          low:  'Daily mindfulness sessions of 10–15 minutes can meaningfully improve sustained attention.',
          mid:  'Short focused-work sprints (Pomodoro technique) are a proven attention booster.'
        },
        executive: {
          low:  'Strategy games and dual-task exercises help rebuild inhibitory control and flexibility.',
          mid:  'Planning-based puzzles like chess or Sudoku sharpen executive function skills.'
        },
        processing: {
          low:  'Timed decision-making drills and speed-reading exercises can accelerate processing speed.',
          mid:  'Reaction-time apps or rapid-matching tasks will push your processing speed further.'
        },
        visual: {
          low:  '3-D puzzles and mental rotation apps directly target spatial reasoning ability.',
          mid:  'Origami, map reading, or spatial navigation games are effective low-effort boosters.'
        }
      };

      DOMAINS.forEach(function (d) {
        var score = scores[d.key];
        if (score === null) return;
        var t = tips[d.key];
        if (!t) return;
        if (score < 60)   recs.push(t.low);
        else if (score < 75) recs.push(t.mid);
      });

      if (recs.length === 0) {
        recs.push('Outstanding work — maintain your edge with novel learning tasks and adequate sleep (7–9 hrs).');
        recs.push('Challenge your brain further with a new language, instrument, or complex sport skill.');
      }

      return recs.slice(0, 2);
    }
  };


  /* ══════════════════════════════════════════════════════════
     RADAR CHART
     ViewBox 320×300, center (155, 148), radius 90
     5 axes starting at -90° (top), 72° apart
  ══════════════════════════════════════════════════════════ */

  var Radar = {

    cx: 155, cy: 148, R: 90,

    SVG_NS: 'http://www.w3.org/2000/svg',

    /* Angle in radians for axis i (0=top, clockwise) */
    angle: function (i) {
      return ((-90 + i * 72) * Math.PI) / 180;
    },

    /* Cartesian point for axis i at fraction f of R */
    pt: function (i, f) {
      var a = this.angle(i);
      return {
        x: this.cx + f * this.R * Math.cos(a),
        y: this.cy + f * this.R * Math.sin(a)
      };
    },

    ptStr: function (i, f) {
      var p = this.pt(i, f);
      return p.x.toFixed(2) + ',' + p.y.toFixed(2);
    },

    el: function (tag) {
      return document.createElementNS(this.SVG_NS, tag);
    },

    render: function (scores) {
      var self = this;

      var gridEl    = document.getElementById('js-radar-grid');
      var axesEl    = document.getElementById('js-radar-axes');
      var polyEl    = document.getElementById('js-radar-polygon');
      var fillEl    = document.getElementById('js-radar-fill');
      var labelsEl  = document.getElementById('js-radar-labels');
      var dotsEl    = document.getElementById('js-radar-dots');

      if (!gridEl) return;

      /* ── Grid rings at 25 / 50 / 75 / 100% ─────────────── */
      [0.25, 0.5, 0.75, 1.0].forEach(function (f) {
        var pts = DOMAINS.map(function (_, i) { return self.ptStr(i, f); }).join(' ');
        var poly = self.el('polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'radar-grid-ring' + (f === 1 ? ' radar-grid-ring--outer' : ''));
        gridEl.appendChild(poly);

        /* Percentage label on the Memory axis (index 0) */
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

      /* ── Axis spokes ─────────────────────────────────────── */
      DOMAINS.forEach(function (_, i) {
        var outer = self.pt(i, 1);
        var line  = self.el('line');
        line.setAttribute('x1', self.cx);
        line.setAttribute('y1', self.cy);
        line.setAttribute('x2', outer.x.toFixed(2));
        line.setAttribute('y2', outer.y.toFixed(2));
        line.setAttribute('class', 'radar-axis-line');
        axesEl.appendChild(line);
      });

      /* ── Data polygon points ─────────────────────────────── */
      var dataPoints = DOMAINS.map(function (d, i) {
        var score = scores[d.key];
        var f     = (score !== null) ? Math.max(0.04, score / 100) : 0.04;
        return self.ptStr(i, f);
      });

      var finalPtsStr = dataPoints.join(' ');
      var centerPts   = DOMAINS.map(function () {
        return self.cx + ',' + self.cy;
      }).join(' ');

      /* Start from center; animate outward */
      polyEl.setAttribute('points', centerPts);
      fillEl.setAttribute('points', centerPts);

      /* ── Axis labels + score sub-labels ─────────────────── */
      var axisLabels = ['Memory', 'Attention', 'Executive', 'Processing', 'Spatial'];

      /* Per-axis nudges so text clears the outer ring */
      var nudge = [
        { dx: 0,   dy: -16 },  /* top   — Memory */
        { dx: 10,  dy: -8  },  /* upper-right — Attention */
        { dx: 10,  dy: 10  },  /* lower-right — Executive */
        { dx: -10, dy: 10  },  /* lower-left  — Processing */
        { dx: -10, dy: -8  }   /* upper-left  — Spatial */
      ];

      DOMAINS.forEach(function (d, i) {
        var lp = self.pt(i, 1.28);

        /* Text anchor: right side → start, left side → end, top → middle */
        var tx = lp.x + nudge[i].dx;
        var ty = lp.y + nudge[i].dy;
        var anchor = tx > self.cx + 8 ? 'start' : tx < self.cx - 8 ? 'end' : 'middle';

        /* Domain name */
        var nameEl = self.el('text');
        nameEl.setAttribute('x', tx.toFixed(2));
        nameEl.setAttribute('y', ty.toFixed(2));
        nameEl.setAttribute('class', 'radar-axis-label');
        nameEl.setAttribute('text-anchor', anchor);
        nameEl.textContent = axisLabels[i];
        labelsEl.appendChild(nameEl);

        /* Score value */
        var score = scores[d.key];
        if (score !== null) {
          var scoreEl = self.el('text');
          scoreEl.setAttribute('x', tx.toFixed(2));
          scoreEl.setAttribute('y', (ty + 14).toFixed(2));
          scoreEl.setAttribute('class', 'radar-axis-score');
          scoreEl.setAttribute('text-anchor', anchor);
          scoreEl.textContent = score;
          labelsEl.appendChild(scoreEl);
        }
      });

      /* ── Dot at each data point ──────────────────────────── */
      DOMAINS.forEach(function (d, i) {
        var score = scores[d.key];
        var f     = (score !== null) ? Math.max(0.04, score / 100) : 0.04;
        var p     = self.pt(i, f);
        var dot   = self.el('circle');
        dot.setAttribute('cx', p.x.toFixed(2));
        dot.setAttribute('cy', p.y.toFixed(2));
        dot.setAttribute('r',  '5');
        dot.setAttribute('class', 'radar-data-dot');
        dotsEl.appendChild(dot);
      });

      /* ── Animate polygon outward from center ─────────────── */
      self._animatePolygon(polyEl, fillEl, finalPtsStr, centerPts);
    },

    _animatePolygon: function (polyEl, fillEl, finalPtsStr, centerPts) {
      var duration = 900;
      var start    = null;

      var finalCoords = finalPtsStr.split(' ').map(function (pair) {
        var parts = pair.split(',');
        return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
      });
      var cx = this.cx, cy = this.cy;

      function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

      function step(ts) {
        if (!start) start = ts;
        var raw  = Math.min((ts - start) / duration, 1);
        var ease = easeOutCubic(raw);

        var pts = finalCoords.map(function (fc) {
          var x = cx + (fc.x - cx) * ease;
          var y = cy + (fc.y - cy) * ease;
          return x.toFixed(2) + ',' + y.toFixed(2);
        }).join(' ');

        polyEl.setAttribute('points', pts);
        fillEl.setAttribute('points', pts);

        if (raw < 1) requestAnimationFrame(step);
      }

      /* Brief pause so the page paints before animating */
      setTimeout(function () { requestAnimationFrame(step); }, 350);
    }
  };


  /* ══════════════════════════════════════════════════════════
     UI BUILDERS
  ══════════════════════════════════════════════════════════ */

  var UI = {

    /* ── Hero ──────────────────────────────────────────────── */
    hero: function () {
      var greeting  = Data.getGreeting();
      var badgeEl   = document.getElementById('js-time-badge');
      var nameEl    = document.getElementById('js-user-name');
      var metaEl    = document.getElementById('js-hero-meta');

      if (badgeEl) {
        badgeEl.innerHTML = '<i data-lucide="' + greeting.icon + '"></i>' + greeting.text;
      }

      if (nameEl) {
        nameEl.textContent = Data.getFirstName();
      }

      if (metaEl) {
        var now     = new Date();
        var dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        var count = Data.getCompletedCount();
        metaEl.innerHTML =
          '<span class="dash-hero__chip">' +
            '<i data-lucide="calendar"></i>' + dateStr +
          '</span>' +
          '<span class="dash-hero__chip">' +
            '<i data-lucide="check-circle-2"></i>' + count + ' of 5 Assessments Completed' +
          '</span>';
      }
    },

    /* ── Score Ring ────────────────────────────────────────── */
    score: function () {
      var scoreEl  = document.getElementById('js-overall-score');
      var badgeEl  = document.getElementById('js-rating-badge');
      var subEl    = document.getElementById('js-rating-sub');
      var ringEl   = document.getElementById('js-ring-fill');

      var score  = Data.overallScore;
      var rating = Data.getRating(score);

      if (scoreEl) UI._counter(scoreEl, 0, score, 1300);

      if (badgeEl) {
        badgeEl.textContent = rating.label;
        badgeEl.className   = 'dash-rating-badge dash-rating-badge--' + rating.cls;
      }
      if (subEl) subEl.textContent = rating.sub;

      if (ringEl) {
        /* circumference = 2π×80 ≈ 502.65 */
        var C      = 2 * Math.PI * 80;
        var target = C * (1 - score / 100);

        /* Color the gradient stops to match rating */
        var colorMap = {
          excellent:      ['#22C55E', '#4ADE80'],
          good:           ['#2563EB', '#60A5FA'],
          average:        ['#F59E0B', '#FCD34D'],
          'needs-review': ['#EF4444', '#F87171'],
          neutral:        ['#94A3B8', '#CBD5E1']
        };
        var cols = colorMap[rating.cls] || colorMap.good;
        var gradStart = document.getElementById('ring-grad-start');
        var gradEnd   = document.getElementById('ring-grad-end');
        if (gradStart) gradStart.setAttribute('stop-color', cols[0]);
        if (gradEnd)   gradEnd.setAttribute('stop-color',   cols[1]);

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

        var card = document.createElement('div');
        card.className = 'card dash-domain-card scroll-reveal anim-delay-' + delay;
        card.style.setProperty('--domain-color',       d.color);
        card.style.setProperty('--domain-color-light', d.colorLight);
        card.style.setProperty('--domain-color-accent',d.colorAccent);

        var scoreDisplay = score !== null ? score : '—';
        var timeHtml     = session
          ? '<span class="dash-domain-card__time"><i data-lucide="clock"></i>' +
              UI._dur(session.duration) +
            '</span>'
          : '';

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
            timeHtml +
          '</div>';

        grid.appendChild(card);
      });

      /* Animate bars after a brief delay */
      setTimeout(function () {
        document.querySelectorAll('.dash-domain-card__bar-fill').forEach(function (bar) {
          bar.style.transition = 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)';
          bar.style.width      = bar.dataset.target + '%';
        });
      }, 650);
    },

    /* ── Reaction Metrics ──────────────────────────────────── */
    reactionMetrics: function () {
      var el = document.getElementById('js-reaction-metrics');
      if (!el) return;

      var m = Data.getReactionMetrics();
      if (!m) {
        el.innerHTML = '<p class="dash-stat-empty">Attention data unavailable.</p>';
        return;
      }

      function fmtRT(v) {
        return v ? Math.round(v) + ' ms' : 'N/A';
      }

      el.innerHTML =
        UI._statItem(fmtRT(m.avg),     'Average RT',  '') +
        UI._statItem(fmtRT(m.fastest), 'Fastest RT',  'dash-stat-value--success') +
        UI._statItem(fmtRT(m.slowest), 'Slowest RT',  'dash-stat-value--warning');
    },

    /* ── Session Summary ───────────────────────────────────── */
    timeline: function () {
      var el = document.getElementById('js-timeline-stats');
      if (!el) return;

      var count     = Data.getCompletedCount();
      var totalDur  = Data.getTotalDuration();
      var now       = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      el.innerHTML =
        UI._statItem(count + ' / 5',        'Completed',      '') +
        UI._statItem(UI._dur(totalDur),      'Total Duration', '') +
        UI._statItem(now,                    'Finished At',    '');
    },

    /* ── Top Strengths ─────────────────────────────────────── */
    strengths: function () {
      var el = document.getElementById('js-strengths');
      if (!el) return;

      var top = Data.getTopStrengths();
      if (!top.length) {
        el.innerHTML = '<li class="dash-empty">Complete assessments to see your strengths.</li>';
        return;
      }

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

    /* ── Recommendations ───────────────────────────────────── */
    recommendations: function () {
      var el = document.getElementById('js-recommendations');
      if (!el) return;

      var recs = Data.getRecommendations();
      var icons = ['target', 'trending-up'];

      el.innerHTML = recs.map(function (text, i) {
        return (
          '<li class="dash-rec-item">' +
            '<div class="dash-rec-icon"><i data-lucide="' + (icons[i] || 'lightbulb') + '"></i></div>' +
            '<p class="dash-rec-text">' + UI._escape(text) + '</p>' +
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
          return '<tr>' +
            '<td>' + domainCell + '</td>' +
            '<td colspan="4" class="dash-table-empty">Not completed</td>' +
          '</tr>';
        }

        var accuracy = (session.accuracy != null)
          ? session.accuracy + '%'
          : 'N/A';

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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
      /* Fallback: just show everything */
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    els.forEach(function (el) { observer.observe(el); });
  }


  /* ══════════════════════════════════════════════════════════
     LUCIDE ICON REFRESH
  ══════════════════════════════════════════════════════════ */

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }


  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */

  function init() {
    /* 1. Load data from sessionStorage */
    Data.load();

    /* 2. Build all static sections synchronously */
    UI.hero();
    UI.score();
    UI.reactionMetrics();
    UI.timeline();
    UI.strengths();
    UI.recommendations();

    /* 3. Inject dynamic DOM (domain cards, table) */
    UI.domainCards();
    UI.table();

    /* 4. Re-create Lucide icons for injected content */
    refreshIcons();

    /* 5. Radar chart + second icon pass (after lucide has run once) */
    setTimeout(function () {
      Radar.render(Data.scores);
      refreshIcons();
    }, 80);

    /* 6. Scroll reveal observer */
    initScrollReveal();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
