# CCI Metric Audit (Sprint 9 · Phase 2)

Per-domain audit of every metric each game currently produces. `Evidence`
column uses the same 4-tier scale as CCI_Evidence_Map.md. `Used for` reflects
the **actual code state after this sprint's changes** (`app/core/cci.py` +
`assessment_service.get_history()`), not the aspirational plan in
Master_Metrics.md — where the two disagree, this doc is authoritative and
Master_Metrics.md has been annotated to point here.

Legend for `Used for`: **Score** = feeds a domain score in `compute_cci`.
**Confidence** = feeds a confidence deduction. **Interpretation** = shown as
context/narrative but never moves a number. **Nothing** = collected/stored,
not read anywhere downstream today.

## Memory (`memory.js`, game_version 2.0)

| Metric | Why it exists | Evidence | Collected | Stored | Used for |
|---|---|---|---|---|---|
| `hitCount`, `falsePositiveCount`, `totalTargets` | Inputs to RAVLT's NPS recognition index | Moderate (Farrahi 2023) | Yes | Yes (`raw_data`) | **Score** (derived NPS, `_memory_normalized`) |
| `interference.longestCorrectLength` (Corsi span) | Standard Corsi output — visuospatial WM span | Strong (Kessels 2000) | Yes | Yes (`raw_data`) | **Score** |
| `interference.correctRounds` (Corsi round accuracy) | Corsi trial-accuracy secondary metric | Strong paradigm, no CogniTrack-specific validation of *this exact* use as a confidence covariate | Yes | Yes (`raw_data`) | **Nothing** — considered for Confidence (Master_Metrics.md flagged it), rejected this sprint: see "Rejected confidence additions" below. |
| `interference.meanTapRT` | Corsi-lineage motor-speed indicator | Strong paradigm / Weak as a standalone confidence signal | Yes | Yes (`raw_data`) | **Nothing** — same rejection as above. |
| Encoding duration (fixed 20s) | Fixed window, not diagnostic | n/a | Yes | Yes (`raw_data`) | **Nothing** (by design — Memory.md flags this as non-diagnostic). |

## Attention (`attention.js`, game_version 1.0)

| Metric | Why it exists | Evidence | Collected | Stored | Used for |
|---|---|---|---|---|---|
| `meanRT` | Core SRT measure | Moderate (Deary-Liewald 2011) | Yes | Yes (`raw_data` + `average_time`) | **Score** |
| `medianRT` | Outlier-robust alternative to mean | Weak (general practice, not paper-specific) | Yes | Yes (`raw_data`) | **Nothing** — redundant with `meanRT` for scoring purposes; using both would double-count the same underlying RT distribution (same rationale CCI.md already applies to Memory's NPS/recognitionPct). |
| `rtStdDev` | RT variability / intra-individual CV | Weak (reasonable inference; neither sourced paper validates it for this task) | Yes | Yes (`raw_data`) | **Nothing** — see rejection rationale below. |
| `falseStarts` | Clicks before stimulus appeared | Weak / Experimental | Yes | Yes (`raw_data`) | **Confidence** (new this sprint — see CCI_Evidence_Map.md) |
| Trial count = 5 (fixed design) | UX trade-off vs. Deary-Liewald's 20 | n/a (design fact) | fixed | n/a | **Confidence** (already implemented — `_domain_confidence`'s -10 deduction) |

## Executive / Stroop (`executive.js`, game_version 1.0)

| Metric | Why it exists | Evidence | Collected | Stored | Used for |
|---|---|---|---|---|---|
| `interferenceEffect` | The Stroop effect itself | Strong (MacLeod 1991) | Yes | Yes (`raw_data`) | **Score** |
| Overall accuracy (`result.score`) | Secondary — ceilings fast on 4-choice task | Weak alone (MacLeod notes accuracy is a poor discriminator here) | Yes | Yes (`score` column) | **Interpretation** (still the on-screen module "Score" tile and feeds the legacy `AssessmentSession.overall_score`; not part of the CCI). |
| `congruentAccuracy`, `incongruentAccuracy` | Facilitation/interference asymmetry | Moderate (MacLeod Finding #5) | Yes | Yes (`raw_data`) | **Nothing** — see rejection rationale. |
| `errorRate` | Redundant with accuracy | n/a | Yes (derivable) | Yes (`raw_data`) | **Nothing** (by design — redundant). |

## Processing Speed (`processing.js`, game_version 1.0)

| Metric | Why it exists | Evidence | Collected | Stored | Used for |
|---|---|---|---|---|---|
| `efficiency` (correct/100s) | Speed+accuracy composite | Moderate (Sandry & Ricker 2022 motivation) | Yes | Yes (`raw_data`) | **Score** |
| Accuracy (`result.score`) | Secondary once efficiency is primary | Weak alone | Yes | Yes (`score` column) | **Interpretation** (on-screen tile + legacy `overall_score`; not part of the CCI). |
| `tier2`/`tier3`/`tier4` (per-option-count accuracy/RT) | Set-size manipulation (validated technique) | Moderate | Yes | Yes (`raw_data`) | **Nothing** — see rejection rationale. |
| `totalMs`/`totalSecs` | Redundant with efficiency | n/a | Yes | Yes (`raw_data`) | **Nothing** (by design). |

## Visuospatial / Mental Rotation (`visual.js`, game_version 1.0)

| Metric | Why it exists | Evidence | Collected | Stored | Used for |
|---|---|---|---|---|---|
| `accuracy` | Secondary in the original chronometric paradigm, primary in the Vandenberg-Kuse lineage CogniTrack actually follows | Moderate | Yes | Yes (`score`/`accuracy` columns) | **Score** (half of `rotationComposite`) |
| `avgTime` (overall RT) | Speed component | Moderate | Yes | Yes (`average_time`) | **Score** (half of `rotationComposite`) |
| `q1_3AvgRT`, `q4_7AvgRT`, `q8_10AvgRT` (per-angle-band RT) | Central IV of Shepard & Metzler's paradigm | Strong for the *paradigm*; the derived rotation-rate slope itself is unimplemented | Yes | Yes (`raw_data`) | **Nothing** — deferred (rotation-rate slope), not rejected. See CCI_Evidence_Map.md. |

## Rejected confidence additions (Sprint 9 decision)

Master_Metrics.md originally flagged `correctRounds`/`meanTapRT` (Memory),
`congruentAccuracy`/`incongruentAccuracy` split (Executive), and per-tier
RT (Processing) as "CONF (add)" candidates. This sprint reviewed each
against the Phase 6 brief ("determine whether every factor should influence
confidence based on literature") and did **not** wire them in, for a
consistent reason: they are not independent data-quality signals — they are
components of, or directly redundant with, the metric already feeding that
domain's score.

- `congruentAccuracy`/`incongruentAccuracy` are the two halves that
  `interferenceEffect` is already computed from. Deducting confidence based
  on a low incongruent-accuracy trial would be re-penalizing the same
  underlying performance the score already reflects, not flagging that the
  *session* was lower-quality — the two are conceptually different jobs the
  brief keeps separate.
- Per-tier RT (Processing) is a decomposition of `efficiency`, not an
  external signal of session quality.
- `correctRounds`/`meanTapRT` (Memory) are Corsi secondary outputs
  correlated with the span score itself, not evidence the *test-taking
  session* (as opposed to the person's memory) was compromised.

This mirrors the same principle CCI.md already applies to score
normalization (equal-weighting only independent, non-redundant metrics) —
applied here to confidence instead. The one addition made this sprint
(Attention `falseStarts`) passed this test because a false start is
behavioral evidence about *how the session was conducted* (rushed,
anticipatory clicking), not a restatement of the RT the score is built from.
All four rejected metrics remain stored and available in `raw_data` — this
is a scoring decision, not a data-collection gap, and can be revisited if a
future source paper validates one of them as an independent reliability
covariate.
