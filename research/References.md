# References — Source Quality Key

- **[TEXT]** = full text machine-extracted (pdftotext) and read in full.
- **[IMG]** = source is a scanned PDF or screenshot; read via vision, partial/lower-confidence on exact numbers. Cross-checked against `Papers/CogniTrack_Validation_Summary.xlsx` (pre-existing team analysis) where numbers could not be independently confirmed at pixel level.
- DOI is given ONLY where it appears verbatim in the extracted source text. "Not confirmed in source" means: do not cite a DOI for this paper without checking the original.

---

### 1. MacLeod, C. M. (1991)
**Half a century of research on the Stroop effect: An integrative review.** Psychological Bulletin, 109(2), 163–203.
Source: `Papers/papers/Half_a_century_of_research_on_the_Stroop.pdf` [TEXT]
DOI: not confirmed in source (no DOI string present in extracted text — pre-DOI-era journal issue).
Domain: Executive Function (Stroop). **Verdict: YES.**

### 2. Stroop, J. R. (1935)
**Studies of interference in serial verbal reactions.** Journal of Experimental Psychology, 18(6), 643–662.
Source: `Papers/papers/stroop 1933.pdf` (filename says 1933; the paper itself is the 1935 original — the file is a scanned image with NO extractable text layer, and no OCR tool was available in this environment; pdftoppm/tesseract not installed).
**All Stroop-1935 statistics used in this project are cited via MacLeod (1991), which quotes them directly** — never sourced from this file. DOI: not confirmed (file unreadable).
Domain: Executive Function (Stroop). **Verdict: YES (via MacLeod 1991 secondary citation only).**

### 3. Sandry, J., & Ricker, T. J. (2022)
**Motor speed does not impact the drift rate: A computational HDDM approach to differentiate cognitive and motor speed.** Cognitive Research: Principles and Implications, 7, Article 66.
Source: `Papers/papers/Motor_speed_does_not_impact_the_drift_rate_a_compu.pdf` [TEXT]
DOI: **10.1186/s41235-022-00412-7** (confirmed in source text).
Domain: Attention / Processing Speed (methodological/loose support). **Verdict: PARTIAL.**

### 4. Farrahi, H., et al. (2023)
**The Rey Auditory Verbal Learning Test: Age-, Gender- and Education-Related Normative Data for The Iranian Healthy Population.** Frontiers in Biomedical Technologies, 10(3), 308–320.
Source: `Papers/papers/TheReyAuditoryVerbalLearningTestAge-Gender-andEducation-RelatedNormativeDataforTheIranianHealthyPopulation.pdf` [TEXT]
DOI: **10.18502/fbt.v10i3.13162** (confirmed in source text).
Domain: Memory. **Verdict: PARTIAL** (validates recognition-memory scoring logic and demographic covariates; the specific RAVLT List A/B protocol is 15+15 words, larger than CogniTrack's 11-word list, and its interposed "List B" is a competing memory task, not a distraction game — see Memory.md).

### 5. Kessels, R. P. C., van Zandvoort, M. J. E., Postma, A., Kappelle, L. J., & de Haan, E. H. F. (2000)
**The Corsi Block-Tapping Task: Standardization and Normative Data.** Applied Neuropsychology, 7(4), 252–258.
Source: `Papers/papers/Screenshot ... The Corsi Block-Tapping Task ....png` [IMG]
DOI: not confirmed in source (screenshot does not show a DOI string).
Domain: Memory (visuospatial working memory span). **Verdict: YES** — this is the direct scientific basis for CogniTrack's tile-sequence interference stage (see Memory.md).

### 6. Deary, I. J., Liewald, D., & Nissan, J. (2011)
**A free, easy-to-use, computer-based simple and four-choice reaction time programme: The Deary-Liewald reaction time task.** Behavior Research Methods, 43(1), 258–268.
Source: `Papers/papers/Screenshot ... Deary-Liewald Reaction Time Task ....png` [IMG, partial — only page 1 of the scanned article captured]
DOI: not confirmed in source (page 1 does not show it; standard identifier suffix would need original-PDF confirmation).
Domain: Attention / Processing Speed. **Verdict: YES.**

### 7. Shepard, R. N., & Metzler, J. (1971)
**Mental Rotation of Three-Dimensional Objects.** Science, 171(3972), 701–703.
Source: `Papers/papers/Screenshot ... Mental Rotation of 3D Objects Study ....png` [IMG]
DOI: not confirmed in source (JSTOR cover page shows Stable URL `jstor.org/stable/1731976`, not a DOI).
Domain: Visuospatial Ability. **Verdict: YES.**

---

### Internal (non-paper) sources used for cross-checking, NOT cited as independent scientific evidence
- `Papers/infos.xlsx` — "Cognitive Test Validation Evidence" sheet, prior team analysis of papers 1–7 above, plus a "Domain Coverage Summary" sheet. Used to cross-check extraction quality, not as a primary source.
- `Papers/CogniTrack_Validation_Summary.xlsx` — same purpose, overlapping content.

### Excluded
None of the 7 sourced papers were judged irrelevant — all touch at least one of CogniTrack's five domains. No paper was discarded.

### Sprint 9.5 addendum (2026-07-21)
12 more papers were added to `Papers/papers/` after Sprint 9. All 12 were read in full
and graded in `research/Literature_Review_2026-07-21.md` — kept as a separate file
rather than merged into the list above because 10 of the 12 turned out to study
clinical MCI/dementia diagnosis or biomarker validation in older/impaired cohorts, a
different population and purpose than CogniTrack's general-population self-assessment
context, and none changed any conclusion the 7 papers above already established. The
one genuine population match (Weintraub et al. 2013, NIH Toolbox) confirmed
CogniTrack's existing domain taxonomy and scoring philosophy rather than requiring a
change to it. See that file for the full per-paper grading and reasoning.
