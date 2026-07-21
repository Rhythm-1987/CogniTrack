# Implementation Checklist (Phase 7)

Scoped so High Priority is finishable within the 2-day window. Full justification for every item lives in CCI.md / Database_Audit.md / Master_Metrics.md / the per-domain research files — this is the punch list only.

## High Priority (must ship)
- [ ] Migration: add `family_history` to `assessment_sessions` + `guest_assessment_sessions` (nullable string enum, same pattern as `distractions`).
- [ ] `models/assessment.py`, `models/guest.py`: add the column.
- [ ] `services/assessment_service.py`, `services/guest_assessment_service.py`: add `_FAMILY_HISTORY_VALUES`, wire into `_checkin_fields`.
- [ ] `templates/pages/user.html` + `static/js/checkin.js` (if it populates/validates check-in selects): add Family History field, same UI pattern as Distractions.
- [ ] `templates/pages/privacy.html`: one-line addition to the existing check-in field list (already itemizes sleep/stress/caffeine/mood/distractions/medication/glasses — add family history).
- [ ] New `app/core/cci.py` (or `services/cci_service.py`): pure functions implementing CCI.md Layers 2–5 — normalize, domain score, confidence, overall. Input = `raw_data` dict + `Profile` + check-in fields already on the session row. No DB schema change (Database_Audit.md recommendation: compute-on-read, don't repeat the dead `cci`/`risk_level` column mistake).
- [ ] Wire into `assessment_service._shape_dashboard_payload()` and its guest mirror — add CCI output to the existing dashboard payload shape without breaking current keys (`dashboard.js` already reads `score`/`accuracy`/`avgTime`/`rawData` per module — additive only).
- [ ] `dashboard.js`/`dashboard.html`/`_dashboard_body.html`: surface overall CCI + per-domain confidence alongside the existing radar chart. Additive UI, don't touch the existing radar/summary-card rendering paths.
- [ ] Promote the specific already-computed-but-unused fields into the domain-score functions: `interferenceEffect` (Executive), `efficiency` (Processing), `hitCount − falsePositiveCount` + `longestCorrectLength` (Memory), age-adjusted `meanRT` (Attention), accuracy+RT composite (Visuospatial).

## Medium Priority
- [ ] RT outlier trimming (<200ms) in `attention.js`/`processing.js` before computing summary stats — literature-backed (Sandry & Ricker 2022), zero gameplay change, small JS diff.
- [ ] Within-user trend (this session's domain score vs. their own prior-session mean) once `get_history()` shows ≥2 completed sessions — needs no external norms, most defensible number the system can show, but only relevant to repeat users so it's naturally not a Day-1 blocker.
- [ ] Visuospatial rotation-rate slope (Δtime/Δangle across the 3 angle bands) as an alternative/upgrade to the v1 accuracy+RT composite — deferred because 3 bands × ~3 trials each is a statistically fragile linear fit; revisit once trial counts can reasonably increase.

## Future Work (Sprint 9.5 additions, 2026-07-21)
- [ ] Formal self-validation study for CogniTrack's own five games (test-retest
  reliability via ICC, convergent validity against an established gold-standard test
  per domain) — CogniTrack's grounding is currently "in the tradition of" cited
  external paradigms, never validated as an instrument in its own right. NIH
  Toolbox's methodology (Weintraub et al. 2013 — see `Literature_Review_2026-07-21.md`)
  is a usable template. Needs a real participant pool CogniTrack doesn't have today.
- [ ] Investigate whether browser/device type (already collected in
  `session_metadata`) measurably affects score reliability, once enough sessions
  exist to analyze — a digital cognitive test's remote test-retest reliability has
  been shown to vary by phone OS in at least one published study (Porta-Mas et al.
  2025). Not actionable yet; there's no dataset to analyze.

## Optional / Out of scope for this sprint
- Real population-norm percentiles (needs an actual collected dataset, not paper tables — RAVLT's own normative tables were extraction-corrupted and unusable even if we wanted them).
- DDM-style drift-rate decomposition for Processing/Attention — Sandry & Ricker's own paper found weak convergent validity for this approach vs. traditional scores; not worth the complexity.
- Increasing Attention from 5→20 trials to match Deary-Liewald's validated protocol — real reliability improvement, but conflicts with the brief's "stay quick" constraint; a genuine product trade-off, not a quick fix.
