# Demographics & Covariates — Research Notes

Cross-cutting notes on which demographic factors the source papers show actually matter, mapped against what CogniTrack's `Profile`/`GuestProfile` models already collect (`age`, `gender`, `education`, `dominant_hand`, `native_language` — see Database.md).

## What the papers actually found

| Factor | Domain | Finding | Source |
|---|---|---|---|
| Age | Memory (RAVLT recognition) | r=−.510 with NPS (p<.01); 61-70y group significantly worse than all younger groups (Tukey p<.001) | Farrahi et al. 2023 |
| Education | Memory (RAVLT recognition) | r=+.293 with NPS (p<.05, Spearman) | Farrahi et al. 2023 |
| Gender | Memory (RAVLT recognition) | Significant group differences on NPS and RORS (p<.05, both ANOVA and t-test) — direction not confidently extractable from corrupted table data, don't state a direction without checking the original PDF | Farrahi et al. 2023 |
| Age | Attention/Processing (choice RT) | r=.54 with CRT — RT reliably slows with age | Deary, Liewald & Nissan 2011 |
| Age | Executive (Stroop interference) | **Nonlinear/U-shaped**: high in early childhood, peaks Grades 2–3, declines through adulthood to a low ~age 60, rises again after 60 | MacLeod 1991 |
| Gender | Executive (Stroop interference) | **No sex differences at any age** (one of the review's 18 reliable findings) | MacLeod 1991 |
| Hemisphere/laterality | Executive (Stroop) | Left hemisphere shows more interference than right (non-logographic script populations) — CogniTrack has no laterality task; `dominant_hand` is a weak, unvalidated proxy at best. Do not use handedness as a laterality stand-in. | MacLeod 1991 |

No demographic breakdown was reported in the Shepard & Metzler (1971) or Kessels et al. (2000) source material available here — do not invent age/gender norms for Visuospatial or the Corsi-derived Memory interference stage.

## What CogniTrack already collects vs. needs
- **Age**: collected (`Profile.age`, 1–120 range constrained). Sufficient for RAVLT-style and RT-style age corrections. Executive/Stroop needs age-BAND correction (U-shaped), not a linear one — a linear age coefficient applied uniformly across domains would silently mis-correct Executive scores.
- **Gender**: collected (fixed enum: male/female/non-binary/prefer-not-to-say). Sufficient for what the literature actually supports using it for (Memory only — Stroop explicitly shows no gender effect, so gender should NOT be used to adjust Executive/Attention/Processing/Visuospatial scores).
- **Education**: collected (5-tier ordinal enum). Sufficient for RAVLT-style correction on Memory.
- **Dominant hand, native language**: collected but **no source paper here validates using either as a scoring covariate**. Native language could matter for a word-based task (Memory) as a face-valid confound (non-native speakers may recognize/recall English words less reliably) but this is not something any of the 7 sourced papers tested — flag as a plausible-but-unvalidated confound, worth capturing in confidence/interpretation text, never in score adjustment.
- **NOT collected: Family history.** The task brief lists "Family History" among temporary/contextual factors that should modulate confidence, not cognition. No current field exists anywhere in `Profile`, `GuestProfile`, or the check-in fields on `AssessmentSession`. This is a genuine gap — see Database_Audit.md / CCI.md for the recommendation (a simple checkin-style flag, same pattern as existing check-in fields, never used to alter a raw score).
- **Already collected, correctly scoped as SESSION-level not PROFILE-level**: sleep_quality, stress_level, hours_slept, caffeine_today, medication, current_mood, wearing_glasses, distractions — all live on `AssessmentSession`/`GuestAssessmentSession` (the "Today's Assessment Check-In"), correctly separated from the permanent `Profile`. This is exactly the right home for CCI's "temporary factors" (see CCI.md) — no schema change needed, just make the CCI's confidence layer actually read them (currently collected and stored, never used downstream).

## Bottom line for CogniTrack
- Apply age/education correction to Memory scoring; age correction (band-based, not linear) to Executive; age correction (linear is fine per Deary-Liewald) to Attention/Processing.
- Do not apply gender correction anywhere except optionally Memory, and even there the paper's own table data on direction is unrecoverable from this extraction — treat as "gender is a documented covariate to control for," not "gender should shift scores in a known direction."
- Add one Family History field (session-level check-in, boolean or none/some/significant enum matching the existing `distractions` pattern) — cheap schema addition, directly requested by the brief, currently missing.

**Superseded by CCI.md (Sprint 8 Phase 6, reaffirmed Sprint 9):** the first
bullet's numeric age/education score corrections were proposed here but
rejected at design time — this doc's own correlation coefficients (Farrahi
r=−.510, Deary-Liewald r=.54) are not regression equations, and building a
numeric offset from a bare r-value would be inventing the missing slope.
Age/education/gender ship as **interpretive text only**, never a score
adjustment, in `cci.py`. The Executive age-band point is directionally
still correct advice (a linear correction would be wrong there) but no age
correction — banded or linear — is implemented anywhere in the CCI today;
that remains an open gap, not a done item. Left unedited above so the
original research reasoning stays intact; this note is the reconciliation.
