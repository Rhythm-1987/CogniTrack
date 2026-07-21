# Cognitive Cognitive Index (CCI) — Architecture (Phase 6)

Grounded in Memory.md / Attention.md / Executive.md / Processing.md / Visuospatial.md / Demographics.md / Master_Metrics.md. No weight or normalization constant below is "tuned" — every one is either (a) directly the literature's own stated relationship, or (b) explicitly flagged as an engineering default (equal weighting) chosen *because* the source papers give no basis to prefer one metric over another, not because equal weighting is scientifically optimal. Where papers gave no usable statistic, this doc says so instead of inventing one.

## Layer 1 — Raw Metrics
Exactly what's in `AssessmentResult.raw_data` today (see Database_Audit.md: nothing new needs collecting). Never touched directly by the CCI — always read, never mutated.

## Layer 2 — Normalized Metrics
Each SCORE-tagged metric from Master_Metrics.md is transformed to a 0–100 scale, direction-corrected (lower-is-better metrics like RT are inverted) and range-clamped to an engineering-judgment plausible range (documented per metric in `app/core/cci.py` — these bounds are NOT paper-sourced statistics, they're sane min/max clipping so one outlier trial can't blow up a domain score). Formula: `normalized = 100 × clamp((value − worst) / (best − worst), 0, 1)`.

**No demographic arithmetic is applied to the score.** An earlier draft of this doc proposed shifting raw values by age/education before normalizing — that was rejected: the sourced papers give correlation coefficients (e.g. Farrahi's r=−.510 age↔NPS, Deary-Liewald's r=.54 age↔CRT), not regression equations with a slope/intercept. Building a numeric offset out of a bare r-value would mean inventing the missing slope — exactly the "never invent statistics" rule this project runs on. Instead, age/gender/education are surfaced as **interpretive context** next to the score (Layer 4/5 — e.g. "Stroop interference follows a U-shaped age pattern per MacLeod 1991" as a note, not a number that moves the score), which is what the available evidence actually supports.

**Honesty constraint**: no sourced paper hands us a trustworthy population mean/SD table (RAVLT's were extraction-corrupted; Stroop/Deary-Liewald give correlations, not distributions), so this is NOT a norm-referenced percentile system. It's direction-aware, range-clamped 0–100 scaling only. Do not present it to users as "you are in the Nth percentile" — present it as "your score relative to a plausible performance range," and separately show trend-over-time (Layer 5) once a user has repeat sessions, which needs no external norms at all — only the user's own history.

## Layer 3 — Domain Scores
One score per domain, built only from Master_Metrics.md's SCORE-tagged rows (never CONF-tagged ones). Where a domain has ≥2 independent (non-redundant) SCORE metrics, they're **equal-weighted** — explicitly flagged as the neutral default, not a literature-derived weighting, because none of the 7 papers compare the relative importance of e.g. Corsi span vs. recognition NPS within a combined memory score.

- **Memory** = avg(normalized NPS, normalized Corsi span). *Not* recognitionPct + NPS together — both derive from the same hit/false-positive counts, averaging them would double-count the same signal.
- **Executive** = normalized interference effect alone. (Accuracy is CONF-only — see Executive.md, it ceilings too fast on a 4-choice task to carry domain-score information.)
- **Attention** = normalized mean RT alone. (An earlier draft of this line said "age-adjusted" — stale wording left over from before the no-demographic-arithmetic decision two paragraphs up was finalized. `_attention_normalized` in `cci.py` has never applied an age term; corrected here in Sprint 9 to match the shipped implementation. See CCI_Evidence_Map.md.)
- **Processing** = normalized efficiency alone (efficiency already blends speed+accuracy per Sandry & Ricker's own critique of accuracy-only scoring — it is not "ignoring" accuracy).
- **Visuospatial** = normalized composite of accuracy + overall RT (same "efficiency"-style blend as Processing). **Not** the angle-vs-RT rotation-rate slope — that's the paradigm's true headline metric (Shepard & Metzler 1971) but a 3-band, ~3-trials-per-band linear fit is too statistically fragile to ship as a primary score in 2 days. Document it in Implementation_Checklist.md as a Medium-priority upgrade once more trials exist, don't ship a noisy slope as v1.

## Layer 4 — Confidence (never touches the score)
Per the brief: stress, mood, caffeine, distractions, medication, family history must NEVER move a domain score. They only move a parallel **confidence** value (e.g. High/Moderate/Low, or 0–100) shown alongside the score — "Executive: 72 (Moderate confidence — high stress reported today)."

Confidence starts at 100 and takes documented deductions, source-tagged so nothing is asserted as literature fact when it's actually a data-quality judgment:

| Factor | Deduction basis | Source type |
|---|---|---|
| High stress / poor sleep / significant distractions / caffeine="three-plus" | Face-valid state confound | Engineering judgment — no sourced paper quantifies an exact effect size for any of these on any of these 5 tasks |
| Medication="yes" (+ its own follow-up: does it affect attention/alertness/mood/thinking?) | Face-valid state confound, larger deduction when the follow-up is answered "yes" | Engineering judgment |
| Family history of a named memory/cognitive condition (Alzheimer's, dementia, MCI, other) vs. "unsure" | Face-valid confound; a named condition deducts more than "unsure" | Engineering judgment — Sprint 10.5 replaced the original 3-value none/some/significant enum with specific conditions, same never-touches-score guarantee |
| Attention trial count = 5 vs. Deary-Liewald's validated 20 | Fewer trials → noisier mean | Deary-Liewald 2011 (design comparison, not a stated reliability coefficient) |
| `completion_mode == 'self_healed'` | Session didn't get a clean client-confirmed finish — timing data may be less trustworthy | Engineering judgment (existing `session_metadata` field) |
| `attempt_number > 1` | Practice effects are real and documented | MacLeod 1991 (practice reduces Stroop interference over repeated exposure — Experiment 3, though that was 8 days of dedicated practice, not a same-day retake; treat as directionally relevant, not a matched effect size) |

Confidence is computed per-domain (only factors relevant to that domain's own measurement quality apply — e.g., trial-count deduction only touches Attention) and an overall confidence = average of the 5 domain confidences.

## Layer 5 — Overall Cognitive Profile
`Overall CCI = equal-weight average of the 5 domain scores` — again explicitly the neutral default (no paper ranks Memory above Executive above Attention in importance), stated as such in any user-facing methodology text, never presented as "the" scientifically optimal weighting.

Additionally, once `get_history()` shows ≥2 completed sessions for a user, compute a **within-user trend** (this session's domain score vs. their own prior mean) — this needs no external norms, sidesteps the "we don't have real population data" honesty problem entirely, and is arguably the most defensible number the system can show. Recommend surfacing this prominently once available (Implementation_Checklist.md, Medium priority — requires ≥2 sessions to exist, so it's not a Day-1 blocker).

## What this explicitly does NOT do
- No single persisted "CCI" float in the database (see Database_Audit.md — this already failed once, the original `cci`/`risk_level` columns were dropped as dead code). Computed on read from `raw_data` + `Profile` + check-in fields.
- No fabricated percentile norms. No fabricated population SDs. No claim of clinical validity for any of the 5 games — every domain doc says explicitly which parts are "in the tradition of" vs. "a validated replication of" the cited paradigm.
- No temporary/contextual factor ever multiplies, subtracts from, or otherwise touches a domain or overall score. It only annotates confidence.
