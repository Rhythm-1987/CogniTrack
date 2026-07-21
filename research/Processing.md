# Processing Speed (Symbol Match) — Research Notes

Papers: Sandry & Ricker 2022 (DDM motor-speed) [TEXT] — primary; Deary-Liewald 2011 [IMG, partial] — secondary (digit-symbol coding as a comparison test). See References.md.

## Current CogniTrack implementation (processing.js, game_version 1.0)
Symbol-Match test: memorize a 1–5 → symbol key (2s mandatory countdown), then 20 trials matching a shown number to its symbol; difficulty scales by number of answer options (2 → 3 → 4 across tiers). Score = **accuracy**, not speed. Also computes (but doesn't score with) `totalMs`, per-tier accuracy/RT, and an `efficiency` metric (correct per 100s).

**This is structurally a digit-symbol substitution task** — the same family as the Symbol Digit Modalities Test (SDMT) that both source papers reference as a standard processing-speed measure. Good paradigm choice; scoring is the gap (see below).

## Sandry & Ricker (2022) — primary
- Central finding: reaction time in these tasks reflects **two separable components** — drift rate (true cognitive/info-processing speed) and non-decision time Ter (motor execution + stimulus encoding). Manipulating response force changed Ter but not drift rate; manipulating set size (task difficulty/cognitive load) changed drift rate.
- **Directly explains why "accuracy alone" or "raw RT alone" is an incomplete Processing Speed score**: the paper's own framing (Significance Statement) is that traditional speeded tests conflate "cognitive slowing" with unrelated motor/perceptual slowing, so two people can get the same score for different underlying reasons.
- Convergent validity between their model-derived cognitive-speed estimate and the Symbol Digit Modalities Test was **weak** (r²≈0.08) — caution against treating any single derived speed metric as a gold-standard validated score; DDM decomposition is a research technique, not something CogniTrack should attempt to reimplement in two days.
- Actionable, low-effort recommendations actually stated in the paper: **use set-size/difficulty variation** (CogniTrack already does this via the 2/3/4-option tiers — good alignment) and **trim implausible RTs** (<0.2s, or >3SD from the subject's own mean) before summarizing (CogniTrack does not currently do this).
- The paper explicitly frames raw digit-symbol-style test scores as ambiguous for clinical interpretation (a patient could score low from either genuine cognitive slowing or an unrelated motor issue) — supports combining accuracy AND time into the score rather than accuracy alone, since accuracy-only scoring silently discards the paper's central point (speed carries information accuracy doesn't).

## Deary-Liewald (2011) — secondary
- CRT (choice reaction time) correlated **r=−.49** with digit-symbol coding performance — i.e., digit-symbol/processing-speed tasks and RT tasks tap overlapping but not identical ability; treat Processing (accuracy-based, digit-symbol-style) and Attention (RT-based) as correlated-but-distinct CCI domain inputs, not duplicates.
- Same age-slowing caution as Attention.md applies to any RT component added to Processing's score.

## Bottom line for CogniTrack
- **Gap**: a module literally named "Processing Speed" currently scores 0% on speed and 100% on accuracy. The already-computed `efficiency` (correct per 100s) sits unused in `raw_data`. This is the clearest, lowest-risk scoring fix in the whole audit: fold time into the score (e.g., blend accuracy with the efficiency metric, or use per-tier RT as a normalized-speed component in the CCI) — no gameplay change, no new data collection, just using data already captured.
- Keep the difficulty-tier (2/3/4-option) structure — it's the literature-endorsed set-size manipulation.
- Add RT outlier trimming (<200ms) before computing `avgRt`/`efficiency`, same as Attention — cheap, literature-backed, zero UX change.
- Do not attempt real drift-diffusion modeling in the CCI (out of scope for a 2-day sprint and the paper itself found weak convergent validity for that approach vs. traditional scores anyway) — a simple accuracy+speed composite is the defensible, achievable option.
