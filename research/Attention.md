# Attention (Simple Reaction Time) — Research Notes

Papers: Deary, Liewald & Nissan 2011 (Deary-Liewald RT task) [IMG, partial]; Sandry & Ricker 2022 (DDM motor-speed) [TEXT] as loose/methodological support. See References.md.

## Current CogniTrack implementation (attention.js, game_version 1.0)
5 trials, click/spacebar when circle turns green; delay window scales 4000–5000ms (round 1) down to 2000–3000ms (round 5). Tracks `reactionTimes[]`, `falseStarts`. Computes mean, median, stdDev — median/stdDev already computed but not used in scoring. Score formula: `90 + (250 − avgRT) × 0.1`, clamped [0,100] — **this formula is not derived from either paper; it's an arbitrary product decision.** Flag for Phase 6/7.

## Deary-Liewald (2011) — direct-match paper
- Validated a free computer-based Simple RT (SRT) and 4-choice RT (CRT) task in **150 participants aged 18–80**, each doing **8 practice + 20 scored trials**, inter-stimulus interval randomized 1–3s (CogniTrack: no fixed practice block, 5 scored trials, fixed 2–5s countdown that shrinks per round — not the same design).
- Reliability: SRT mean correlated **r=.68** with an independent "numbers box" RT device (p<.01); CRT mean correlated **r=.76** with the same device (p<.01).
- Validity: CRT mean correlated **r=−.49** with matrix reasoning and **r=−.49** with digit-symbol coding (both intelligence/processing-speed measures) — faster RT associated with higher scores on both.
- Age effect: CRT slows with age, **r=.54**. This is a substantial, well-established effect — any RT-based score MUST be age-normalized or it will systematically penalize older users for a normal, expected pattern, not a cognitive deficit.
- **Only 20 test trials were used for SRT in the validated protocol vs. CogniTrack's 5** — CogniTrack's per-user reliability is unestablished and likely lower than Deary-Liewald's validated version simply from trial-count alone (more trials → more stable mean, lower measurement noise). This is the single most defensible "add more trials" recommendation in the whole research set, but conflicts with the 2-day/UX-brevity constraint — flag as a real trade-off, not free to fix.

## Sandry & Ricker (2022) — loose/methodological support only
- Confirms raw RT is a **confound of cognitive speed (drift rate) and motor speed (non-decision time)** — a low/high score on a simple-RT task cannot be cleanly attributed to "attention" or "processing speed" alone; it may reflect finger/device latency, motor execution speed, or encoding time just as much as cognitive speed.
- Convergent validity between their DDM-derived "cognitive speed" and standard processing-speed tests (SDMT) was explicitly **weak** (r²≈0.08) — a caution against over-claiming that any single RT metric "is" processing speed.
- This paper used a **choice** RT with comparison stimuli (letter/symbol matching under varying set size), not simple RT — it does not directly validate CogniTrack's simple-RT attention task. Cite it only as background/caution, not as primary validation. (The Validation Summary sheet independently reached the same "loose match" conclusion.)
- Practical recommendation actually stated in the paper: use **within-subject manipulation and set-size/difficulty variation** to separate cognitive from motor components, and prefer trimming outlier RTs (paper excluded <0.2s or >3SD from a participant's own mean) over using raw means unfiltered. CogniTrack currently does no outlier trimming on `reactionTimes` before computing mean/median — cheap, literature-backed addition with zero gameplay change.

## Bottom line for CogniTrack
- Simple RT is a legitimate, literature-precedented measure of attention/alertness, but it is confounded with motor/device speed — treat "Attention" score as *reaction speed*, not pure attention, in any CCI documentation.
- Age-normalize RT-based scores (r=.54 age-RT correlation is too large to ignore).
- Already-computed `medianRT`/`rtStdDev` should feed the CCI (RT variability — intra-individual coefficient of variation — is itself a recognized marker of lapses in sustained attention in the broader literature, though neither sourced paper here specifically validates that; flag as a reasonable inference, not a cited finding).
- Cheap, backed-by-Sandry&Ricker addition: trim RTs <200ms (physiologically-implausible "anticipation" clicks, distinct from the false-start clicks-before-green already tracked) before computing summary stats. No gameplay change, pure post-processing.
- The current `90 + (250-avgRT)*0.1` score formula has no scientific grounding — replace its role in the CCI with a normalized/age-banded transform (see CCI.md), even if the on-screen "Score" tile keeps a simple display formula for UX.
