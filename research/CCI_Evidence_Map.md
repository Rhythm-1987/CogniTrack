# CCI Evidence Map (Sprint 9 · Phase 1)

Classifies every metric currently reachable from `app/core/cci.py` — score
inputs, normalization bounds, and confidence factors — by evidence strength.
Nothing here is a new claim: every citation is already sourced in
References.md / Memory.md / Attention.md / Executive.md / Processing.md /
Visuospatial.md / Demographics.md from the 7 papers in `Papers/papers/`.
This doc's only job is to grade what's already been said, in one place, so a
reviewer doesn't have to cross-reference six files to answer "how solid is
this number."

**Legend**
- **Strong** — the paradigm and the specific metric are both directly
  validated by a [TEXT]- or [IMG]-sourced paper, and CogniTrack's
  implementation is a faithful (if scaled-down) adaptation.
- **Moderate** — the metric or paradigm has real paper support, but either
  the specific formula is CogniTrack's own composite, the source is a
  partial/[IMG] extraction, or the adaptation departs meaningfully from the
  validated protocol (fewer trials, fewer words, etc.).
- **Weak** — face-valid and directionally reasonable, but no sourced paper
  quantifies it for any of these 5 tasks. Used only where the CCI brief
  restricts it to confidence, never score.
- **Experimental / Engineering judgment** — has no literature claim at all
  and was never presented as one (e.g., clamp bounds, equal-weighting).
  Listed here for completeness, not because it pretends to be science.

## Domain score inputs

| Metric | Domain | Evidence | Why |
|---|---|---|---|
| Corsi span (`longestCorrectLength`) | Memory | **Strong** | Kessels et al. 2000 — direct paradigm precedent; CogniTrack's 3×3 grid is a faithful (if regularized-layout) digital adaptation of the standardized task. |
| Net recognition, NPS (`hitCount − falsePositiveCount`) | Memory | **Moderate** | Farrahi et al. 2023 validates NPS as RAVLT's own recognition index, but CogniTrack's 11-word single-trial list is a substantial simplification of the 15-word, multi-trial RAVLT protocol — the *index* is validated, the *test* it's computed from is adapted. |
| Interference effect (`incongruentMeanRT − congruentMeanRT`) | Executive | **Strong** | MacLeod 1991 — this is the literal Stroop effect. Manual-response variant is itself literature-precedented (Redding & Gerjets, as reviewed by MacLeod), just smaller in magnitude than the classic oral/card figures. |
| Mean RT (`meanRT`) | Attention | **Moderate** | Deary-Liewald 2011 validates simple RT as an attention/alertness measure, but at 20 scored trials vs. CogniTrack's 5, and Sandry & Ricker 2022 shows RT is a motor-speed/cognitive-speed confound, not a pure attention signal. |
| Efficiency (`correct per 100s`) | Processing | **Moderate** | Sandry & Ricker 2022's central critique (accuracy-alone and RT-alone both discard information) directly motivates blending speed+accuracy — but "correct per 100s" is CogniTrack's own composite, not a formula either source paper states. |
| Accuracy + RT composite (`rotationComposite`) | Visuospatial | **Weak-Moderate** | Shepard & Metzler 1971 strongly validates the *paradigm* and identifies RT-by-angle slope as the headline signal — but CogniTrack scores an accuracy+overall-RT blend instead of the angle-slope, an explicit v1 simplification (3 angle bands × ~3 trials each was judged too statistically fragile to ship — see Implementation_Checklist.md Medium priority). |

## Normalization bounds (clamp ranges in `_normalize` calls)

**Experimental / Engineering judgment**, uniformly. Every `worst`/`best` pair
in `cci.py` (RT 150–600ms, interference 0–600ms, efficiency 15–55, rotation
RT 1500–6000ms, Corsi span 0–5) is a plausible-range clip chosen to stop one
outlier trial from blowing up a domain score — explicitly documented in the
module docstring as "NOT a paper-sourced statistic." None of the 7 papers
hand CogniTrack a population mean/SD table it could norm against instead
(RAVLT's own normative tables were extraction-corrupted; Stroop/Deary-Liewald
give correlations, not distributions). This is a correct, disclosed
limitation, not a gap to silently fix.

**Equal-weighting** (within a domain, and across domains for the overall
score) is the same category — the neutral default because no sourced paper
ranks these metrics against each other, not a scientifically optimal weight.

## Confidence factors (never touch a score)

| Factor | Evidence | Why |
|---|---|---|
| Attention trial count = 5 vs. 20 | **Moderate** | Deary-Liewald's own validated design used 20; fewer trials → higher measurement noise is a direct design-comparison inference, not a stated reliability coefficient. |
| `attempt_number > 1` (practice effects) | **Weak** | MacLeod 1991 documents practice reducing Stroop interference — but over 8 days of dedicated practice (Experiment 3), not a same-day multi-domain retake. Directionally relevant, not a matched effect size. |
| Stress / sleep / caffeine / distractions / mood / family history (self-report) | **Weak** | Face-valid state confounds; none of the 7 sourced papers quantify an effect size for any of them on any of these 5 tasks. |
| Medication present | **Weak** | Same as above — face-valid, unquantified. |
| `completion_mode == 'self_healed'` | **Experimental / Engineering judgment** | Pure data-quality heuristic (session didn't close cleanly) — not a literature claim at all. |
| Attention false starts present (new, Sprint 9) | **Experimental / Engineering judgment** | Behavioral (not self-reported) signal of rushed/anticipatory responding, distinct from the RT it would discount confidence in. No sourced paper validates false-start counts as a confidence covariate for this task; flagged as a reasonable inference, same disclosure tier as the trial-count/self-heal factors. |

## Explicitly rejected — not a gap, a decision

These were considered during Sprint 8/9 and deliberately excluded. Listed so
a future reviewer doesn't re-propose (and re-reject) the same idea:

- **Demographic score-shifting** (age/education/gender arithmetic applied to
  a domain score). Rejected: the sourced papers give correlation
  coefficients (Farrahi r=−.510 age↔NPS, Deary-Liewald r=.54 age↔CRT), not
  regression equations. Building a numeric offset from a bare r-value would
  itself be inventing the missing slope. Demographics surface as
  interpretive text only (see `research/CCI.md` Layer 2).
- **Linear age correction for Executive.** MacLeod 1991's age/interference
  relationship is U-shaped (low in kids, low ~60, rising after) — a linear
  coefficient would silently mis-correct in the wrong direction for part of
  the age range. Not implemented in any form (not even as narrative text
  today) — flagged as a real gap in Phase 2.
- **RORS** (RAVLT's recall-based recognition-over-recall index). Not
  computable — no delayed free-recall trial exists in the current game
  design and none is being added back.
- **Rotation-rate slope** (Δtime/Δangle across the 3 Visuospatial angle
  bands). Deferred, not rejected — 3 bands × ~3 trials each was judged too
  statistically fragile for a v1 score; revisit once trial counts increase
  (Implementation_Checklist.md, Medium priority).
- **DDM drift-rate decomposition** for Attention/Processing. Sandry &
  Ricker's own paper found weak convergent validity (r²≈0.08) for this
  technique vs. traditional scores — not worth the complexity even though
  it's the paper's own primary method.
- **Population-norm percentiles.** No sourced paper hands CogniTrack a
  usable population mean/SD table. Presenting scores as "Nth percentile"
  would require fabricating a distribution.

## Sprint 9.5 literature consolidation (2026-07-21)

12 new papers were reviewed in full — see `research/Literature_Review_2026-07-21.md`
for the complete per-paper grading. **No score, weight, or normalization bound in
`cci.py` changed as a result.** Summary of what the new literature actually confirmed:

- **Domain taxonomy strengthened.** Weintraub et al. 2013 (NIH Toolbox, general
  population ages 3–85, not a clinical cohort) independently validates Memory,
  Attention, Executive Function, and Processing Speed as standard, recognized
  cognitive domains — external confirmation beyond the original 7-paper library that
  CogniTrack's domain choices aren't an ad hoc invention.
- **Executive's accuracy-ceiling decision reaffirmed, not reversed.** NIH Toolbox's
  own closest analog to CogniTrack's Executive/Attention games (the Flanker
  Inhibitory Control task) blends accuracy with RT in its scoring — general
  confirmation that accuracy+RT blending is a legitimate approach for
  choice/inhibitory tasks (already used for Processing and Visuospatial) — but its
  validation sample spans ages 3–85 including children and impaired elderly, where
  accuracy has real variance CogniTrack's presumed-healthy adult users mostly won't
  show. The original decision (MacLeod 1991 + Executive.md: accuracy ceilings too
  fast on a healthy adult's 4-choice manual Stroop) stands.
- **A real distinction worth stating precisely.** Belleville et al. 2017's
  meta-analysis found verbal memory to be the strongest *longitudinal predictor* of
  future MCI-to-dementia conversion, while executive/visuospatial tests were weaker
  predictors — a different question from Ding et al. 2022's finding that memory and
  executive measures show the largest *cross-sectional* group differences between
  MCI and healthy controls. CogniTrack does neither kind of clinical prediction, but
  the two claims ("detects current difference" vs. "predicts future decline") must
  never be conflated in any future user-facing copy.
- **One new documented limitation (untested):** Porta-Mas et al. 2025 found a
  digital assessment's remote test-retest reliability varied materially by phone
  operating system (Android ICC=0.70 vs. iOS ICC=0.33 in one study). CogniTrack
  already collects browser/device metadata in `session_metadata` but has never
  analyzed it for this purpose — recorded as a documented gap, not fixed, since
  there's no dataset yet to analyze.
- **One new Future Work item:** CogniTrack's own five games have never undergone
  formal self-validation (test-retest reliability, convergent/discriminant validity
  against a gold standard) — NIH Toolbox's methodology (§ above) is the template if
  that's ever undertaken. See `Implementation_Checklist.md`.

## Doc-consistency note (Sprint 9 fix)

`Master_Metrics.md` (row: Attention/Mean RT) and an earlier draft of
`research/CCI.md` Layer 3 both still said "age-adjusted"/"age-normalized"
mean RT. That phrasing predates the "no demographic arithmetic on scores"
decision above and was never implemented in `cci.py` — `_attention_normalized`
has always been a plain RT clamp, no age term. Both docs are corrected in
this sprint to match the shipped (and correct) implementation instead of
silently leaving the contradiction in place. See CCI_Metric_Audit.md for the
full per-metric detail.
