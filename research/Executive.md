# Executive Function (Stroop) — Research Notes

Papers: MacLeod 1991 (integrative review, 400+ studies) [TEXT]; Stroop 1935 original, cited only via MacLeod [IMG unreadable]. See References.md.

## Current CogniTrack implementation (executive.js, game_version 1.0)
15 trials, phase-ordered: 3 congruent → 6 mixed (1 congruent + 6 incongruent, shuffled — actually 7 slots) → 5 incongruent. Button-click (manual) response, 4 colors. Already computes `congruentMeanRT`, `incongruentMeanRT`, `interferenceEffect = incongruent − congruent`, plus phase-accuracy (`congruentAccuracy`, `incongruentAccuracy`). Score = overall accuracy.

**This is the best-covered domain in the whole project.** The interference-effect metric CogniTrack already computes is *exactly* the Stroop effect as MacLeod defines it (color-naming time difference, incongruent vs. congruent/control) — no redesign needed.

## Key findings from MacLeod (1991)

**Interference magnitude (original Stroop 1935b data, as quoted by MacLeod, p.164–165):** color-naming of incongruent words took 110.3s vs. 63.3s for control (N=100) — subjects averaged **47s longer, a 74% increase**; 99% of subjects were slower on the interference card. MacLeod's own 1986 replication (N=40): 102.27s vs. 59.76s, F(1,39)=363.65, p<.001. This is one of the most robust effects in cognitive psychology — good grounds for using Stroop interference as a stable executive-function signal.

**Manual vs. vocal response — directly relevant, since CogniTrack is button-click:**
- MacLeod's own conclusion (p.183, Reliable Finding #13 of 18): "interference (but perhaps not facilitation) is reduced when response modality is switched from oral to manual... However, neither response mode alone... can account for the Stroop effect." Interference is smaller with manual response but does NOT disappear.
- Redding & Gerjets: 177ms interference (oral) vs. 98ms (manual); 23ms facilitation (oral) vs. 67ms (manual) — manual responding shows less interference but MORE facilitation.
- Several studies (Roe et al.) found no difference at all between modes.
- **Conclusion: CogniTrack's button-click Stroop is a legitimate, literature-precedented paradigm — cite it as "manual-response Stroop interference," not vanilla Stroop, and don't expect interference magnitudes to match the classic 47s/74% oral figures.**

**Reliability:** No numeric test-retest coefficient is given anywhere in MacLeod's review — only qualitative claims (Jensen 1965: "probably more reliable than any other psychometric test," with multiple administrations). **Do not cite a specific reliability r-value for Stroop; none is verifiable from this source.**

**Trial count:** No stated minimum for reliable individual measurement. Classic card format = 100 items; a 50-item card was also used; group versions used 150 stimuli. The now-dominant single-trial (vs. list) procedure is a different paradigm from the classic timed card and "introduces list-structure effects" not present in single-item designs (p.166) — i.e., list-total-time and single-trial-RT are not strictly interchangeable measures. CogniTrack's 15 discrete trials is a single-trial-style design (matches the modern dominant paradigm), just short. Whether 15 trials is "enough" for individual-level reliability is not addressed in this source — treat as an open question, not a validated design choice.

**Individual differences relevant to a cognitive index:**
- No sex differences in interference at any age (Finding #15) — safe to NOT gender-normalize the interference-effect metric itself (unlike Memory, see Demographics.md).
- Age: interference is low in early childhood, **peaks at Grades 2–3** (reading-skill acquisition), declines through adulthood to a low around age 60, then **rises again in older age** (multiple studies, twin studies confirm a genetic component). This is a nonlinear (U-shaped) age relationship — a simple linear age correction would be wrong for Stroop, unlike most other domains.
- Clinical populations (reading disability, ADHD/hyperactivity, autism, aphasia) show larger/atypical interference — supports Stroop interference as a genuine marker of executive control, not just processing speed.
- Left hemisphere shows more interference than right in most (non-logographic-script) populations.

**18 reliable empirical findings (Appendix B)** — full list captured in Master_Metrics.md source notes; most relevant beyond the above: interference requires only mild semantic/orthographic relation to increase (word doesn't need to literally be a color name); facilitation from congruence is real but consistently smaller than interference from incongruence (asymmetric, matches CogniTrack's phase design putting more weight on incongruent trials); sequential trial-order effects exist (a congruent trial following an incongruent one behaves differently) — CogniTrack's shuffled-within-phase design already avoids a fixed predictable order, which the literature would recommend.

## Bottom line for CogniTrack
- Keep the game as-is — it's the strongest-validated module.
- Promote `interferenceEffect` (already computed, sitting unused in `raw_data`) into the CCI's actual executive-function signal instead of raw accuracy alone — accuracy on a 4-choice task ceilings out fast (most healthy adults will score 90%+), while the RT-based interference effect has real dynamic range and is the metric the entire 90-year literature actually validates.
- Do not apply a linear age correction to the interference metric — the true relationship is U-shaped (high in kids, low ~60, rising after). If age-normalizing at all, use age-band lookup, not a linear formula.
