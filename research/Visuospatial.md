# Visuospatial Ability (Mental Rotation) — Research Notes

Paper: Shepard & Metzler 1971 (Mental Rotation of Three-Dimensional Objects, Science) [IMG]. See References.md.

## Current CogniTrack implementation (visual.js, game_version 1.0)
10 trials: a reference 2D tile-matrix shape (4×4 binary grid) shown at 0°; pick which of 4 candidates is the same shape rotated (not mirrored). Rotation angle scales by phase: Q1–3 = 90°, Q4–7 = 180°, Q8–10 = 270°. Distractors are rotations of the mirror image (guarantees no ambiguous "looks similar" trap). Score = accuracy. **Already computes per-angle-band accuracy AND avg RT** (`q1_3AvgRT`, `q4_7AvgRT`, `q8_10AvgRT`) — this is the raw material for the classic finding below, just bucketed into 3 bands instead of continuous degrees, and not currently used in scoring.

## Shepard & Metzler (1971) — the founding paper of this paradigm
- Classic chronometric mental-rotation task: pairs of 3D wireframe block-cluster figures shown at varying angular disparity (0°–180°); subjects judged same-object-rotated vs. mirror-image, with RT as the primary dependent variable.
- **Central, famous finding**: RT increases approximately **linearly with angular disparity between the two figures** — subjects appear to mentally "rotate" one figure to compare it to the other at a roughly constant rate. (The commonly cited rate figure, ~60°/second, appears in the pre-existing team validation summary; treat it as reported-not-independently-reverified from the scanned source at full numeric confidence, but the *linear RT-vs-angle relationship itself* is unambiguous in the paper and one of the most replicated findings in cognitive psychology.)
- Original design differences from CogniTrack: **3D wireframe objects** (not flat 2D tile shapes), **reaction time as the primary/only dependent measure** (not accuracy), and a same/mirror judgment (not 4-alternative forced choice). CogniTrack's design is structurally closer to the later Vandenberg & Kuse (1978) paper-and-pencil adaptation (2D shapes, multiple-choice, accuracy-scored) than to the original chronometric Shepard-Metzler paradigm — say "in the tradition of mental rotation research," not "replicates Shepard & Metzler."
- **Directly actionable for CogniTrack**: the paradigm's core scientific signal is the **RT-by-angle slope**, not raw accuracy. CogniTrack already collects exactly the inputs needed (`q1_3AvgRT` @90°, `q4_7AvgRT` @180°, `q8_10AvgRT` @270°) to compute an approximate per-user rotation rate (Δtime / Δangle across the three bands) — this would be a genuine, literature-grounded derived metric, achievable with zero gameplay change.

## Construct note (do not conflate with Memory's Corsi task)
Mental rotation (spatial visualization — manipulating an object's orientation) and Corsi span (visuospatial short-term memory — retaining a sequence) are recognized as **distinct cognitive constructs** in the taxonomy both source papers implicitly operate under. The Corsi paper (see Memory.md) validates CogniTrack's Memory-module interference stage, not this Visuospatial module — keep these separate in the CCI and in any user-facing text.

## Bottom line for CogniTrack
- Keep the game as-is — angle-tiered structure already matches the paradigm's key manipulation.
- Add to CCI inputs (no gameplay change): an approximate rotation-rate slope from the three already-computed angle-band RTs, alongside accuracy. Pure accuracy at only 10 trials will ceiling/floor easily; the RT-by-angle relationship is the more literature-grounded signal.
- Do not claim "Shepard-Metzler mental rotation test" verbatim in user-facing copy — it's a 2D/accuracy-scored descendant of that paradigm (Vandenberg-Kuse lineage), not the original.
