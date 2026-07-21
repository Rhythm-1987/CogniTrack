# Master Metrics Table

Legend — **Collected**: does the game currently produce this value in-browser (yes even if unused). **DB**: does it currently reach `raw_data`/a dedicated column. **CCI**: `SCORE` = should feed the domain score directly, `CONF` = should only ever modify confidence/interpretation (never raw score — see CCI.md, matches Phase 6's mandate for temporary/contextual factors), `NO` = not recommended (redundant or unvalidated for this use).

## Memory
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Recognition accuracy (recognitionPct) | Core recognition-memory measure — RAVLT-family (Farrahi 2023) | YES | YES (score) | SCORE |
| Net recognition = hits − falsePositives (NPS-style) | RAVLT's actual recognition index (Farrahi 2023) | derivable, not computed | inputs YES, derived NO | SCORE (add) |
| Corsi span (longestCorrectLength) | Standard Corsi Block-Tapping output (Kessels 2000) | YES | YES (raw_data) | SCORE (add) |
| Corsi round accuracy (correctRounds) | Corsi trial accuracy (Kessels 2000) | YES | YES (raw_data) | CONF (add) |
| Mean interference tap RT | Corsi-lineage secondary/motor-speed indicator | YES | YES (raw_data) | CONF |
| Encoding duration | Fixed 20s window, low variance, not diagnostic | YES | YES (raw_data) | NO |

## Attention
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Mean RT | Core measure (Deary-Liewald 2011) | YES | YES (average_time) | SCORE — plain clamp, not age-normalized. *Sprint 9 correction: CCI.md rejected all score-level demographic arithmetic (correlation coefficients aren't regression equations); "age-normalized" here was stale pre-decision wording. `cci.py` has never age-adjusted this.* |
| Median RT | More outlier-robust than mean (general practice) | YES | YES (raw_data) | CONF |
| RT SD / variability | Not directly validated by either sourced paper — reasonable inference only | YES | YES (raw_data) | CONF |
| False starts | Not validated by either sourced paper as a specific metric (flagged in team validation summary) | YES | YES (raw_data) | CONF |
| Trial count = 5 | Deary-Liewald validated 20 trials; 5 is a UX trade-off, reliability at n=5 is unestablished | fixed design | n/a | n/a — document the caveat |

## Executive (Stroop)
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Interference effect (incongruent RT − congruent RT) | THE Stroop effect itself (MacLeod 1991) | YES (computed) | YES (raw_data) | SCORE (promote — currently unused) |
| Overall accuracy | Secondary — ceilings fast on a 4-choice task | YES | YES (score) | CONF |
| Congruent vs incongruent accuracy split | Facilitation/interference asymmetry (MacLeod finding #5) | YES | YES (raw_data) | CONF |
| Error rate | Redundant with accuracy | YES (derivable) | YES (raw_data) | NO |

## Processing Speed
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Efficiency (correct per 100s) | Speed+accuracy composite, addresses Sandry & Ricker's accuracy-alone critique | YES (computed) | YES (raw_data) | SCORE (promote — currently unused; module is accuracy-only today) |
| Accuracy | Secondary once efficiency is primary | YES | YES (score) | CONF |
| Per-tier RT (2/3/4-option) | Set-size manipulation (Sandry & Ricker's validated technique) | YES | YES (raw_data) | CONF |
| Total time | Redundant with efficiency | YES | YES (raw_data) | NO |

## Visuospatial (Mental Rotation)
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Per-angle-band RT (90°/180°/270°) | Central IV of the paradigm (Shepard & Metzler 1971) | YES | YES (raw_data) | *Superseded — see note below.* |
| Rotation-rate slope (Δtime/Δangle across bands) | Derived version of the paper's headline finding | derivable, not computed | inputs YES, derived NO | *Superseded — see note below.* |
| Accuracy | Secondary — this module's paradigm lineage (Vandenberg-Kuse) scores accuracy, but original chronometric paradigm scored RT | YES | YES (score) | SCORE (half of `rotationComposite`, promoted from CONF) |
| Overall avg RT (`avgTime`) | Speed half of the shipped v1 composite | YES | YES (average_time) | SCORE (half of `rotationComposite`) |

*Note (Sprint 9): the rotation-rate-slope plan above was never implemented.
`CCI.md`'s Phase 6 design instead shipped an accuracy+overall-RT composite
(`rotationComposite` in `cci.py`) as v1, judging a 3-band/~3-trial slope fit
too statistically fragile — see CCI_Evidence_Map.md and
Implementation_Checklist.md (Medium priority, still open). This row is left
in place rather than deleted so the "considered and deferred" history isn't
lost, per this sprint's no-fabrication/no-silent-rewrite rule.*

## Demographics / Context (cross-cutting)
| Metric | Why measured (paper) | Collected | DB | CCI |
|---|---|---|---|---|
| Age | Memory (Farrahi r=−.510), Attention (Deary-Liewald r=.54), Executive (MacLeod, U-shaped) | YES (Profile) | YES | Normalization input (not a raw score) |
| Education | Memory (Farrahi r=+.293) | YES (Profile) | YES | Normalization input, Memory only |
| Gender | Memory only (Farrahi, direction unconfirmed); explicitly NO effect on Executive (MacLeod) | YES (Profile) | YES | Normalization input, Memory only |
| Dominant hand | No sourced paper validates handedness as a scoring covariate (laterality ≠ handedness) | YES (Profile) | YES | NO |
| Native language | Plausible confound for word-based Memory task, not tested by any sourced paper | YES (Profile) | YES | CONF only |
| Sleep/stress/caffeine/mood/glasses/distractions/medication | Face-valid state confounds; not quantified by any of the 7 sourced papers | YES (session check-in) | YES | CONF only (per Phase 6 mandate — never adjusts raw score) |
| Family history | Requested by brief; not quantified by any sourced paper | **NOT collected** | NO | CONF only (add as check-in field) |
