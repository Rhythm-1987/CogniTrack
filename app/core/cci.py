"""
Cognitive Cognitive Index (CCI) — computed on read, never persisted.
See research/CCI.md for the full architecture writeup, citations, and why
each design choice was made (esp. why there's no persisted `cci` column —
the original one was dropped as dead code, see research/Database_Audit.md).

Layers: raw (already in AssessmentResult.raw_data / session check-in
columns) -> normalized (0-100, direction-corrected, range-clamped) ->
domain score -> confidence -> overall profile.

Every plausible-range bound below is engineering judgment for clamping,
NOT a paper-sourced statistic. Every confidence deduction is explicitly
an engineering judgment, not a literature effect size — none of the 7
source papers quantify how much stress/sleep/caffeine/mood/family history
moves any of these 5 specific tasks. Per the CCI brief, none of these
factors are ever allowed to change a domain SCORE — only confidence.
"""

import math

MODULE_KEYS = ('memory', 'attention', 'executive', 'processing', 'spatial')


def _num(value):
    """Guards every raw_data extraction below against a malformed/adversarial
    payload — raw_data is client-supplied JSON validated only as "is a dict"
    by assessment_service.save_result, so a bad client could put a string,
    None, bool, or a NaN/Infinity float (Python's json module accepts those
    non-standard literals) under a key this module expects to do arithmetic
    on. Returns None (the existing "no data" value every normalizer already
    handles) instead of letting a TypeError/ValueError reach the dashboard
    request and 500 it."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _normalize(value, worst, best):
    """0-100, direction-aware: pass worst > best for a lower-is-better metric."""
    if value is None:
        return None
    span = best - worst
    if span == 0:
        return None
    pct = (value - worst) / span
    return round(_clamp(pct, 0, 1) * 100, 1)


def _domain_score(parts):
    """Equal-weight average of whichever normalized parts are present —
    the neutral default, not a literature-derived weighting (see CCI.md
    Layer 3: no sourced paper ranks these metrics against each other)."""
    values = [v for v in parts if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


# ---- Layer 2: per-domain normalization ----
# Reads the exact raw_data keys each game already writes via CT.writeSession()
# (see the game .js files) — nothing here requires new data collection.

def _memory_normalized(module):
    raw = (module or {}).get('rawData') or {}
    hit, fp, total = _num(raw.get('hitCount')), _num(raw.get('falsePositiveCount')), _num(raw.get('totalTargets'))
    nps = None
    if hit is not None and fp is not None and total:
        # NPS = hits - false positives (Farrahi et al. 2023's recognition
        # index). Floored at 0 (at/below chance nets no credit).
        nps = _normalize(hit - fp, worst=0, best=total)

    span = _num((raw.get('interference') or {}).get('longestCorrectLength'))
    # Corsi span (Kessels et al. 2000) — ROUND_LENGTHS tops out at 5 (memory.js).
    corsi_span = _normalize(span, worst=0, best=5) if span is not None else None

    return {'nps': nps, 'corsiSpan': corsi_span}


def _attention_normalized(module):
    raw = (module or {}).get('rawData') or {}
    mean_rt = _num(raw.get('meanRT'))
    # Plausible simple-RT range for this task: 150ms (near the fastest
    # genuine human RT) to 600ms (slow but attentive).
    reaction_speed = _normalize(mean_rt, worst=600, best=150) if mean_rt is not None else None
    return {'reactionSpeed': reaction_speed}


def _executive_normalized(module):
    raw = (module or {}).get('rawData') or {}
    effect = _num(raw.get('interferenceEffect'))
    # Smaller Stroop interference effect = better cognitive control
    # (MacLeod 1991). Plausible range for manual-response Stroop: 0ms to 600ms.
    interference_control = _normalize(effect, worst=600, best=0) if effect is not None else None
    return {'interferenceControl': interference_control}


def _processing_normalized(module):
    raw = (module or {}).get('rawData') or {}
    efficiency = _num(raw.get('efficiency'))  # correct per 100s, already computed in processing.js
    # Plausible range for the 20-question symbol-match test: ~15 (slow) to ~55 (fast+accurate).
    processing_efficiency = _normalize(efficiency, worst=15, best=55) if efficiency is not None else None
    return {'processingEfficiency': processing_efficiency}


def _visuospatial_normalized(module):
    module = module or {}
    accuracy = _num(module.get('accuracy'))
    avg_time = _num(module.get('avgTime'))
    acc_part = _normalize(accuracy, worst=0, best=100) if accuracy is not None else None
    # Plausible avg RT range for a 4-choice mental-rotation trial: 1500ms to 6000ms.
    rt_part = _normalize(avg_time, worst=6000, best=1500) if avg_time is not None else None
    # Accuracy+RT composite (same "efficiency" logic as Processing) rather
    # than the paradigm's true headline metric (RT-vs-angle rotation rate,
    # Shepard & Metzler 1971) — a 3-band/~3-trials-per-band linear fit is
    # too statistically fragile to ship as v1. See Visuospatial.md.
    composite = _domain_score([acc_part, rt_part])
    return {'rotationComposite': composite}


_NORMALIZERS = {
    'memory': _memory_normalized,
    'attention': _attention_normalized,
    'executive': _executive_normalized,
    'processing': _processing_normalized,
    'spatial': _visuospatial_normalized,
}


# ---- Layer 4: confidence (never touches a score) ----

_SESSION_DEDUCTIONS = (
    ('stress_level', {'high': 15, 'moderate': 5}, 'stress level'),
    ('sleep_quality', {'poor': 15, 'average': 5}, 'sleep quality'),
    ('caffeine_today', {'three-plus': 5}, 'high caffeine intake'),
    ('distractions', {'significant': 15, 'some': 5}, 'distractions during the session'),
    ('current_mood', {'stressed': 10, 'tired': 10}, 'reported mood'),
    # Sprint 10.5: family_history moved from a 3-value severity enum
    # ('none'/'some'/'significant') to specific conditions — deduction
    # magnitudes are carried over in spirit (a named condition ~= old
    # 'significant', 'unsure' ~= old 'some'), still engineering judgment,
    # not a literature-sourced effect size.
    ('family_history', {'alzheimers': 5, 'dementia': 5, 'mci': 3, 'other': 2, 'unsure': 1}, 'reported family history'),
)

_CONFIDENCE_FLOOR = 30  # never claim zero/near-zero confidence outright


def _session_confidence(session):
    score = 100
    notes = []

    for field, table, label in _SESSION_DEDUCTIONS:
        value = getattr(session, field, None)
        if value and value in table:
            score -= table[value]
            notes.append(label)

    # Sprint 10.5: medication moved from free text (any non-empty string
    # was truthy here) to an enum — 'no' is a non-empty string too, so this
    # must check the actual value, not just truthiness (fixes a bug where
    # answering "No" would have incorrectly deducted confidence).
    if getattr(session, 'medication', None) == 'yes':
        score -= 5
        notes.append('medication reported')

        effect = getattr(session, 'medication_cognitive_effect', None)
        if effect == 'yes':
            score -= 5
            notes.append('medication reported as affecting attention or mood')
        elif effect == 'unsure':
            score -= 2
            notes.append('uncertain whether medication affects cognition')

    metadata = getattr(session, 'session_metadata', None) or {}
    if metadata.get('completion_mode') == 'self_healed':
        score -= 10
        notes.append("session didn't close cleanly")
    if (metadata.get('attempt_number') or 1) > 1:
        score -= 5
        notes.append('repeat attempt — practice effects possible (MacLeod 1991)')

    return max(score, _CONFIDENCE_FLOOR), notes


def _domain_confidence(domain, base_score, base_notes, module):
    score = base_score
    notes = list(base_notes)
    if domain == 'attention':
        # Deary-Liewald 2011 validated 20 scored trials; this task uses 5.
        score -= 10
        notes.append('only 5 trials collected (validated protocols use 20)')

        false_starts = _num(((module or {}).get('rawData') or {}).get('falseStarts'))
        if false_starts and false_starts > 0:
            # Behavioral (not self-reported) signal of rushed/anticipatory
            # responding — engineering judgment, no sourced paper validates
            # false-start counts as a confidence covariate for this task.
            # See research/CCI_Evidence_Map.md.
            score -= 5
            notes.append('anticipatory responses recorded before the stimulus appeared')

    return max(score, _CONFIDENCE_FLOOR), notes


def _confidence_label(score):
    if score is None:
        return None
    if score >= 85:
        return 'High'
    if score >= 60:
        return 'Moderate'
    return 'Low'


def compute_cci(session, modules):
    """session: AssessmentSession/GuestAssessmentSession row (for check-in
    fields + session_metadata — both models share these attribute names,
    see models/assessment.py vs models/guest.py). modules: the dict
    _shape_dashboard_payload already builds, keyed by domain, each holding
    score/accuracy/avgTime/rawData. Returns None if there's nothing to
    score yet."""
    if not modules:
        return None

    normalized = {domain: fn(modules.get(domain)) for domain, fn in _NORMALIZERS.items()}
    domain_scores = {domain: _domain_score(metrics.values()) for domain, metrics in normalized.items()}

    base_conf_score, base_notes = _session_confidence(session)

    domains_out = {}
    conf_scores = []
    for domain in MODULE_KEYS:
        if domain_scores[domain] is None:
            # No score to be confident about — a domain that never produced
            # a usable metric (missing/invalid raw_data, or a session marked
            # completed without every module's result present) must not
            # show a confidence badge next to a blank score. See
            # CCI_Metric_Audit.md Phase 4 edge cases.
            domains_out[domain] = {
                'score': None, 'confidence': None, 'confidenceLabel': None,
                'confidenceNotes': [], 'metrics': normalized[domain],
            }
            continue

        conf_score, notes = _domain_confidence(domain, base_conf_score, base_notes, modules.get(domain))
        conf_scores.append(conf_score)
        domains_out[domain] = {
            'score': domain_scores[domain],
            'confidence': conf_score,
            'confidenceLabel': _confidence_label(conf_score),
            'confidenceNotes': notes,
            'metrics': normalized[domain],
        }

    overall_score = _domain_score(domain_scores.values())
    overall_confidence = round(sum(conf_scores) / len(conf_scores), 1) if conf_scores else None

    return {
        'overall': {
            'score': overall_score,
            'confidence': overall_confidence,
            'confidenceLabel': _confidence_label(overall_confidence),
        },
        'domains': domains_out,
    }


def _demo():
    """Smallest runnable check for this module's non-trivial branches — run
    with `python -m app.core.cci` (project venv activated) or directly as
    `python app/core/cci.py`. Uses a plain namespace instead
    of a real AssessmentSession/GuestAssessmentSession row: compute_cci only
    ever reads its inputs via getattr()/dict access (duck typing), which is
    also what lets guest_assessment_service reuse this unmodified against
    GuestAssessmentSession — this self-check exercises that same contract
    without needing a Flask app or a database."""
    from types import SimpleNamespace

    def session(**overrides):
        base = dict(
            stress_level=None, sleep_quality=None, caffeine_today=None,
            distractions=None, current_mood=None, family_history=None,
            medication=None, medication_cognitive_effect=None, session_metadata={},
        )
        base.update(overrides)
        return SimpleNamespace(**base)

    full_modules = {
        'memory': {'rawData': {'hitCount': 10, 'falsePositiveCount': 1, 'totalTargets': 11,
                                'interference': {'longestCorrectLength': 4}}},
        'attention': {'rawData': {'meanRT': 320, 'falseStarts': 0}},
        'executive': {'rawData': {'interferenceEffect': 150}},
        'processing': {'rawData': {'efficiency': 35}},
        'spatial': {'accuracy': 80, 'avgTime': 3000},
    }

    # No data at all -> None, not a crash.
    assert compute_cci(session(), None) is None
    assert compute_cci(session(), {}) is None

    # Fully populated session -> every domain scored, overall in range.
    result = compute_cci(session(), full_modules)
    assert result['overall']['score'] is not None
    assert 0 <= result['overall']['score'] <= 100
    for domain in MODULE_KEYS:
        d = result['domains'][domain]
        assert d['score'] is not None and 0 <= d['score'] <= 100
        assert d['confidenceLabel'] in ('High', 'Moderate', 'Low')

    # A domain missing entirely (partial/incomplete session) -> that domain's
    # score AND confidence are both None, never a confidence badge on a
    # blank score. Other domains are unaffected.
    partial = dict(full_modules)
    del partial['spatial']
    result = compute_cci(session(), partial)
    assert result['domains']['spatial']['score'] is None
    assert result['domains']['spatial']['confidenceLabel'] is None
    assert result['domains']['memory']['score'] is not None

    # Malformed raw_data (adversarial/corrupted client payload) -> degrades
    # to a missing metric, never a TypeError/crash reaching the dashboard.
    garbage_modules = dict(full_modules)
    garbage_modules['memory'] = {'rawData': {'hitCount': 'ten', 'falsePositiveCount': None,
                                              'totalTargets': float('nan'),
                                              'interference': {'longestCorrectLength': float('inf')}}}
    result = compute_cci(session(), garbage_modules)
    assert result['domains']['memory']['score'] is None  # no usable metric survived
    assert result['domains']['attention']['score'] is not None  # unaffected domains still score

    # Confidence never touches score: two sessions differing only in
    # stress/false-starts must produce identical domain scores.
    calm = compute_cci(session(), full_modules)
    stressed_modules = dict(full_modules)
    stressed_modules['attention'] = {'rawData': {'meanRT': 320, 'falseStarts': 3}}
    stressed = compute_cci(session(stress_level='high'), stressed_modules)
    assert calm['domains']['attention']['score'] == stressed['domains']['attention']['score']
    assert stressed['domains']['attention']['confidence'] < calm['domains']['attention']['confidence']
    assert stressed['overall']['score'] == calm['overall']['score']

    # Confidence floor is never breached even under maximal deductions.
    worst = compute_cci(
        session(stress_level='high', sleep_quality='poor', caffeine_today='three-plus',
                distractions='significant', current_mood='stressed', family_history='alzheimers',
                medication='yes', medication_cognitive_effect='yes',
                session_metadata={'completion_mode': 'self_healed', 'attempt_number': 3}),
        stressed_modules,
    )
    assert worst['domains']['attention']['confidence'] >= _CONFIDENCE_FLOOR

    print('cci.py self-check: all assertions passed')


if __name__ == '__main__':
    _demo()
