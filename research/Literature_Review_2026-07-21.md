# Literature Review — New Papers (Sprint 9.5, 2026-07-21)

Twelve new papers were added to `Papers/papers/` since Sprint 9 (files `p1.pdf`–`p12.pdf`;
`p1 (1).pdf` is a confirmed byte-identical duplicate of `p1.pdf`, not a 13th paper). This
doc catalogs and grades all 12 against CogniTrack's actual use case — a **single-session,
self-administered, general-population wellness assessment**, not a clinical diagnostic
tool — per Phase 1 of the Sprint 9.5 brief.

This file is deliberately kept separate from `References.md` rather than merged into it.
`References.md` and every downstream doc (`CCI.md`, `Master_Metrics.md`, the per-domain
files) are written around "the 7 sourced papers" as a specific, closed set — rewriting
that framing to "19 papers" would require touching every doc that counts on it, for no
scientific benefit, since (as this review concludes) none of the 12 new papers changed
any of the 7's conclusions. This file is the complete, honest record of what was reviewed
and why it didn't change anything; `References.md` gets one pointer line to here.

## Headline finding

**10 of 12 papers study clinical MCI/dementia diagnosis, biomarker validation, or
therapeutic training efficacy — a different population and a different purpose than
CogniTrack.** CogniTrack is explicitly not a diagnostic tool and does not claim clinical
validity (see `CCI.md` "What this explicitly does NOT do"). A paper that validates a
digital test against amyloid-PET positivity in a 70-year-old preclinical-Alzheimer's
cohort, or evaluates whether an app of exercises *improves* dementia patients' cognition
over 12 weeks, answers a different question than "does the interference-effect metric
in a manual-response Stroop task measure something real in a healthy self-assessor."
Only one paper (P9, NIH Toolbox) is a genuine population match, and it **confirms**
CogniTrack's existing domain taxonomy and scoring philosophy rather than requiring any
change to it. Per the Sprint 9.5 brief's explicit instruction not to force papers into
the project: **no CCI formula, weight, or normalization bound changed as a result of
this review.** Where a paper is useful, it's used to strengthen documentation (grading,
caveats, future-work items) — never to add an unearned number to `cci.py`.

---

## P1 — Digital Cognitive Biomarker for MCI and Dementia (Ding, Lee & Chan, 2022)

**Title:** Digital Cognitive Biomarker for Mild Cognitive Impairments and Dementia: A
Systematic Review
**Authors:** Zihan Ding, Tsz-lok Lee, Agnes S. Chan
**Year:** 2022 · **Journal:** Journal of Clinical Medicine, 11(14), 4191
**DOI:** 10.3390/jcm11144191
**Type:** Systematic Review (PRISMA, 78 studies, NOS quality-rated)
**Quality of evidence: High** (rigorous PRISMA methodology; 91% of included studies
independently rated high-quality via Newcastle–Ottawa Scale)

**Does this change CogniTrack? PARTIAL.** Population is clinical (MCI/dementia
case-control studies, mean ages 53–85), not CogniTrack's general self-assessment
context — findings about diagnostic sensitivity/specificity don't transfer. What *does*
transfer as general corroborating context: memory- and executive-function-related
digital biomarkers showed the largest MCI-vs-control effect sizes across the 78 studies
(Hedges' g 0.7–1.6 and up), while visuospatial subtests in test batteries showed only
small effects (g≈0.3) — independent, large-scale confirmation that Memory/Executive are
comparatively strong signal domains and Visuospatial is comparatively weaker, consistent
with CogniTrack's own honest self-grading in `CCI_Evidence_Map.md` (Visuospatial already
flagged Weak-Moderate). Also flags family health history and race/ethnicity as
under-collected demographic covariates worth studying for dementia risk — this is about
population-level dementia *risk prediction* in older cohorts, not about same-day session
confidence for a wellness app; it does not change the case for `family_history` (already
a confidence-only field, unrelated rationale) and does **not** justify adding
race/ethnicity collection to CogniTrack (see Phase 5 below — explicitly rejected).
**No formula change. No data collection change.**

## P2 — Diagnostic Performance of Digital Cognitive Tests (Chan, Yau, Kwok & Tsoi, 2021)

**Title:** Diagnostic performance of digital cognitive tests for the identification of
MCI and dementia: A systematic review
**Authors:** Joyce Y.C. Chan, Sarah T.Y. Yau, Timothy C.Y. Kwok, Kelvin K.F. Tsoi
**Year:** 2021 · **Journal:** Ageing Research Reviews, 72, 101506
**DOI:** 10.1016/j.arr.2021.101506
**Type:** Systematic Review (56 studies, 46 digital cognitive tests)
**Quality of evidence: Moderate** — the PDF extraction available in `Papers/papers/`
is partial/garbled (web-scraped, methods and results sections are truncated); the
paper is itself cited as reference [24] inside P1 above, so its core conclusion
("most digital cognitive tests are diagnostically comparable to paper-and-pencil
tests") is independently corroborated even though this copy can't be read in full.

**Does this change CogniTrack? NO.** Same clinical MCI/dementia diagnostic-accuracy
question as P1, same population mismatch, no new information beyond what P1 already
contributes. Flagged as reviewed and correctly out of scope.

## P3 — Digital Biomarker Technologies for Home-Based Monitoring (Piau, Wild, Mattek & Kaye, 2019)

**Title:** Current State of Digital Biomarker Technologies for Real-Life, Home-Based
Monitoring of Cognitive Function for Mild Cognitive Impairment to Mild Alzheimer
Disease and Implications for Clinical Care: Systematic Review
**Authors:** Antoine Piau, Katherine Wild, Nora Mattek, Jeffrey Kaye
**Year:** 2019 · **Journal:** Journal of Medical Internet Research, 21(8), e12785
**DOI:** 10.2196/12785
**Type:** Systematic Review (PRISMA, 26 studies)
**Quality of evidence: High** (rigorous PRISMA methodology, clear inclusion criteria)

**Does this change CogniTrack? NO — different measurement modality entirely.** This
reviews **passive, longitudinal, ambient-sensor** monitoring (in-home infrared motion
sensors, GPS driving patterns, computer-mouse-movement analysis, smart-home sensor
networks) tracked over months to years to detect gradual functional decline in older
adults living alone. CogniTrack is an **active, discrete, single-session** battery of
five short games. There is no metric, finding, or design consideration here that
applies to CogniTrack's architecture. Reviewed in full for completeness; correctly out
of scope.

## P4 — Neuropsychological Measures Predicting MCI-to-AD Progression (Belleville et al., 2017)

**Title:** Neuropsychological Measures that Predict Progression from Mild Cognitive
Impairment to Alzheimer's Type Dementia in Older Adults: A Systematic Review and
Meta-Analysis
**Authors:** Sylvie Belleville, Céline Fouquet, Carol Hudon, Hervé Tchala Vignon
Zomahoun, Jordie Croteau (Consortium for the Early Identification of Alzheimer's
disease-Quebec)
**Year:** 2017 · **Journal:** Neuropsychology Review, 27, 328–353
**DOI:** 10.1007/s11065-017-9361-5
**Type:** Systematic Review **and** Meta-Analysis (Bayesian bivariate model, 28
studies, 2365 participants, QUADAS risk-of-bias assessment, sensitivity analyses)
**Quality of evidence: High** — the single most methodologically rigorous paper in
this batch (formal Bayesian meta-analysis with credible intervals, risk-of-bias
stratified re-analysis, meta-regression on follow-up length and age).

**Does this change CogniTrack? PARTIAL — an important nuance, not a formula change.**
Population is MCI patients followed 12–60 months to see who converts to Alzheimer's
dementia — a longitudinal clinical-prognosis question CogniTrack doesn't ask. The
nuance worth recording: verbal memory tests were consistently the *best* predictors of
future conversion (sensitivity/specificity both ≥0.7 across nearly every memory test
variant), while executive-function tests (switching, working memory) and
visuo-constructive tests were comparatively *weaker* predictors (sensitivity
0.54–0.68) — **despite** Executive showing large cross-sectional group differences in
P1's data. This is a genuine scientific distinction worth stating explicitly: **a
domain having a large cross-sectional effect size (detecting current impairment,
P1's question) is not the same claim as a domain having strong longitudinal
predictive validity (forecasting future decline, this paper's question).**
CogniTrack does neither — it is a same-day snapshot — but conflating the two claims
in any future user-facing copy would be a real overreach this paper helps guard
against. Also notable: age had no measurable effect on predictive accuracy in the
meta-regression (though the authors caution this is a between-study comparison, not a
within-individual one) — mild, non-decisive supporting context for CogniTrack's
existing "no demographic score correction" stance, not a basis to change it further.
**No formula change.**

## P5 — Comparative Analysis of MMSE, RUDAS, SAGE, ADAS, MoCA (Naole, Parikh, Nayak & Ramu)

**Title:** Evaluating Cognitive Assessment Tools: A Comparative Analysis of MMSE,
RUDAS, SAGE, ADAS, and MoCA for Early Dementia Detection
**Authors:** Saransh Naole, Dhriti Parikh, Sakshi Nayak, Swarna Priya Ramu
**Year:** not stated on the paper · **Venue:** conference-style paper, Vellore
Institute of Technology (undergraduate student authors + one faculty co-author); no
journal name, no independent DOI on the paper itself
**Type:** Narrative comparison / student review paper
**Quality of evidence: Low** — not a systematic review (no PRISMA, no documented
search strategy beyond "PubMed and Google Scholar"), not peer-reviewed at a named
venue, authored by undergraduate students rather than clinical researchers. It
correctly *cites* legitimate underlying sources (a Cochrane review of MMSE, a 2024
MoCA meta-analysis) but should not itself be treated as a primary source for any
CogniTrack claim.

**Does this change CogniTrack? NO.** Reviews five **clinician-administered, multi-domain
diagnostic** screening instruments (MMSE, MoCA, SAGE, ADAS-Cog, RUDAS) — none of which
CogniTrack implements or resembles. The one point worth noting as background
(non-actionable): the paper documents large, well-established education/age effects on
SAGE/MoCA scores (e.g., SAGE mean score ~17.5 at ages 51–59 vs. ~14 at 90+; ~12 for
"below high school" vs. ~18 for "post-graduate"), a striking illustration of exactly
the demographic-bias problem CogniTrack's `CCI.md` already refuses to paper over with
an invented correction. Corroborates an existing decision; changes nothing.

## P6 — Evaluating Cognitive and Neuropsychological Assessments (Li, Lin, Liu & Wei)

**Title:** Evaluating Cognitive and Neuropsychological Assessments - A Comprehensive
Review
**Authors:** Chuang Li, Rubing Lin, Yantong Liu, Yichen Wei
**Year/Journal:** not stated; no journal name or DOI present on the document itself
**Type:** Narrative review
**Quality of evidence: Low** — author affiliations (Biological Sciences, Veterinary
Medicine, Orthopedics, Computer Engineering, Environmental Sciences) have no evident
neuropsychology background; the reference list mixes legitimate cognitive-assessment
citations with apparently unrelated self-citations on Legionella pathogenesis,
pseudorabies virus genetics, and deoxynivalenol toxicology from the same "Li C"
author name — a citation-padding pattern that further undermines confidence in this
as a vetted source.

**Does this change CogniTrack? NO.** Covers MMSE, DSST, MoCA, Trail Making Test — all
clinician-administered dementia-screening instruments for older adults. No new,
independently-verifiable finding beyond what's already sourced from Sandry & Ricker
2022 and Deary-Liewald 2011 in the existing 7-paper library. Not used as a citation
anywhere.

## P7 — Detecting Early-Stage Dementia with Behavioural Models from Sensor Data (Poyiadzi et al., 2020)

**Title:** Detecting Signatures of Early-stage Dementia with Behavioural Models
Derived from Sensor Data
**Authors:** Rafael Poyiadzi, Weisong Yang, Yoav Ben-Shlomo, Ian Craddock, Liz
Coulthard, Raul Santos-Rodriguez, James Selwood, Niall Twomey
**Year:** 2020 · **Venue:** arXiv:2007.03615 [cs.CY] (preprint, not peer-reviewed)
**Type:** Original study (exploratory/preliminary)
**Quality of evidence: Low** — self-described by the authors as "preliminary
findings," N=2 households (one MCI, one dementia, each with one cohabiting control),
no significance testing reported, never published in a peer-reviewed venue.

**Does this change CogniTrack? NO.** Same passive-sensor modality mismatch as P3
(accelerometers, RSSI room-localization, sleep/wandering/shadowing detection), at
even lower evidentiary strength (unpublished, N=2). Reviewed for completeness;
correctly out of scope.

## P8 — Validation Status of Digital Cognitive Assessments by FDA BEST Framework (Porta-Mas et al., 2025)

**Title:** Validation status of cognitive digital assessments by the FDA BEST
framework and context of use in preclinical AD studies: A systematic review
**Authors:** Clàudia Porta-Mas, Oriol Grau-Rivera, Juan Domingo Gispert, Gemma
Salvadó Blasco, Gonzalo Sánchez-Benavides
**Year:** 2025 · **Journal:** Alzheimer's & Dementia, 21, e70753
**DOI:** 10.1002/alz.70753
**Type:** Systematic Review (PRISMA, 27 studies)
**Quality of evidence: High** — recent, published in the flagship journal of the
Alzheimer's Association, rigorous PRISMA methodology with a formal biomarker
classification framework (FDA BEST).

**Does this change CogniTrack? PARTIAL — one transferable caution, no formula
change.** This validates digital cognitive tools **against amyloid-PET/CSF/plasma
tau biomarkers** in cognitively-normal-but-at-risk preclinical-AD cohorts — a
biomarker-validation pathway CogniTrack has no access to and, per its own
"never diagnose" rule, should never claim. One genuinely transferable, actionable
finding: the Altoida tool's remote at-home test-retest reliability was initially
poor (ICC=0.48) but improved substantially when stratified by phone operating system
(Android ICC=0.70 vs. iOS ICC=0.33) — direct evidence that **browser/device
differences can materially affect a self-administered digital cognitive test's
reliability.** CogniTrack already collects browser/device metadata in
`session_metadata` (Sprint 8's research-readiness columns) but has never analyzed it
for this purpose. This is recorded as a **documented limitation** (untested, not
acted upon this sprint — analyzing it would require a dataset CogniTrack doesn't
yet have) rather than a change, per Phase 4's "no change without justification"
instruction — there's nothing to normalize against yet. See Implementation_Checklist.md.

## P9 — Cognition Assessment Using the NIH Toolbox (Weintraub et al., 2013)

**Title:** Cognition assessment using the NIH Toolbox
**Authors:** Sandra Weintraub, Sureyya S. Dikmen, Robert K. Heaton, David S. Tulsky,
Philip D. Zelazo, Patricia J. Bauer, et al. (NIH Toolbox Cognition working group)
**Year:** 2013 · **Journal:** Neurology, 80(Suppl 3), S54–S64
**DOI:** not printed on the extracted text; standard Neurology supplement citation
**Type:** Original validation study (test-retest reliability, convergent/discriminant
validity, NIH-funded)
**Quality of evidence: High** — genuinely strong methodology: N=476 across the full
lifespan (ages 3–85), intraclass-correlation test-retest reliability, convergent
validity against gold-standard tests (WAIS/WISC subtests, CVLT, PPVT), discriminant
validity against unrelated constructs. Critically, **the validation sample is the
general population, not a clinical cohort** — the closest population match to
CogniTrack of any paper in this batch.

**Does this change CogniTrack? PARTIAL — strengthens existing decisions, adds one
documented gap, changes no formula.** Three specific takeaways:

1. **Confirms the domain taxonomy.** NIH Toolbox's own expert-panel-ranked
   subdomains — Executive Function, Episodic Memory, Language, Processing Speed,
   Working Memory, Attention — validate that Memory/Attention/Executive/Processing
   are recognized, distinct, clinically-standard cognitive domains, not an ad hoc
   CogniTrack invention. (Visuospatial isn't one of NIH Toolbox's own six core
   subdomains — noted for completeness; not a problem, since CogniTrack's
   Visuospatial module is independently grounded in its own dedicated paradigm,
   Shepard & Metzler 1971, already documented in `Visuospatial.md`.)
2. **Reaffirms, rather than reverses, the Executive accuracy-ceiling decision.**
   NIH Toolbox's Flanker Inhibitory Control and Attention Test — the closest
   validated analog to CogniTrack's Executive/Attention games — uses a scoring
   algorithm that blends accuracy **and** reaction time (exact formula not
   disclosed in this paper, so it isn't extractable as a usable equation, and
   inventing one would violate the "never fabricate formulas" rule). This
   confirms accuracy+RT blending is a validated *general* approach for
   choice/inhibitory-control tasks — CogniTrack already does this for Processing
   and Visuospatial. It does **not** overturn `CCI.md`'s specific, already-reasoned
   decision to keep Executive's accuracy CONF-only (MacLeod 1991 + Executive.md:
   accuracy ceilings too fast on a healthy adult's 4-choice manual Stroop to carry
   scoring information) — NIH Toolbox's Flanker validation sample spans ages 3–85
   including young children and cognitively impaired elderly, where accuracy has
   real variance CogniTrack's presumed-healthy user base mostly won't show.
3. **Surfaces a genuine, honest gap.** NIH Toolbox went through exactly the kind
   of self-validation (test-retest ICC, convergent/discriminant validity against
   gold standards) that CogniTrack's own five games have never undergone — CogniTrack's
   scientific grounding is "in the tradition of" cited external paradigms (already
   stated explicitly in every domain doc), not a validated instrument in its own
   right. This is not new information, but NIH Toolbox gives a concrete
   methodological template for what that validation would actually require if ever
   undertaken. Recorded as Future Work, not attempted this sprint (would need a
   participant pool CogniTrack doesn't have).

**Added to `References.md`'s "further reading" note as a supporting citation** for
the domain-taxonomy claim in `CCI_Evidence_Map.md` — see that file's Sprint 9.5
section.

## P10 — Domains of Cognition and Their Assessment (Harvey, 2019)

**Title:** Domains of cognition and their assessment
**Authors:** Philip D. Harvey
**Year:** 2019 · **Journal:** Dialogues in Clinical Neuroscience, 21(3), 227–237
**DOI:** 10.31887/DCNS.2019.21.3/pharvey
**Type:** Narrative "state of the art" review (single author, invited)
**Quality of evidence: Moderate** — well-referenced (68 citations), authoritative
single author with an extensive schizophrenia-cognition research record, published in
a respected clinical neuroscience journal — but it's a narrative synthesis reflecting
one expert's organizational framework, not a systematic review with a documented
search methodology or quantitative synthesis.

**Does this change CogniTrack? PARTIAL — general background confirmation only.**
Useful as a broad taxonomy reference (Memory, Attention, Executive Function, and
Processing Speed are all independently confirmed as standard, recognized cognitive
domains in clinical neuropsychology, giving CogniTrack's domain choices external
legitimacy beyond its own 7-paper library) and as an honest caveat: the paper notes
that in large factor-analytic studies, "conventional domains of cognitive
dysfunction are not truly separable" and a single global ability factor often
dominates — consistent with (not contradictory to) `CCI.md`'s own admission that
equal-weighting the 5 domains is a neutral default, not a claim that the domains are
scientifically independent. Also notes Processing Speed tends to be the strongest
single predictor of overall cognitive performance in general neuropsychological
batteries ("loading most highly on single factor solutions") — interesting, but
this is a general-battery finding, not evidence about CogniTrack's specific 5
metrics, and acting on it would mean inventing a weight the source doesn't provide.
**No weighting change.**

## P11 — Mild Cognitive Impairment as a Diagnostic Entity (Petersen, 2004)

**Title:** Mild cognitive impairment as a diagnostic entity
**Authors:** Ronald C. Petersen
**Year:** 2004 · **Journal:** Journal of Internal Medicine, 256, 183–194
**DOI:** (Wiley) 10.1111/j.1365-2796.2004.01388.x
**Type:** Key Symposium / foundational clinical review
**Quality of evidence: High as a foundational clinical-definitional source** — this is
the seminal, extremely widely-cited paper establishing formal MCI diagnostic criteria
(subjective complaint + objective memory impairment + informant corroboration +
preserved function + clinician judgment "not demented").

**Does this change CogniTrack? NO.** This is a clinical diagnostic classification
framework for physicians in memory clinics to formally diagnose MCI subtypes
(amnestic/non-amnestic, single/multiple domain) — a task requiring informant
interviews, clinical judgment, and functional-impairment assessment that a
self-administered browser game neither performs nor should attempt. Zero actionable
content for CogniTrack's scoring or confidence engine. Its real value here is
negative-space confirmation: reading exactly what a real MCI diagnosis requires
(informant corroboration, clinical judgment across 5 weighted criteria, explicit
exclusion of "insufficient severity to constitute dementia") makes it obvious why
CogniTrack is right to never use language implying anything like it.

## P12 — Digital Technology Interventions for Cognitive Function in MCI/Dementia (Park & Ha, 2024)

**Title:** Effect of digital technology interventions for cognitive function
improvement in mild cognitive impairment and dementia: A systematic review and
meta-analysis
**Authors:** Hyojin Park, Juyoung Ha
**Year:** 2024 · **Journal:** Research in Nursing & Health, 47, 409–422
**DOI:** 10.1002/nur.22383
**Type:** Systematic Review **and** Meta-Analysis (PRISMA, RoB 2.0, PROSPERO
registered, 12 RCTs)
**Quality of evidence: High methodology, modest evidence base** — properly registered
and PRISMA-compliant, but only 12 RCTs, mostly small samples (<100), high
heterogeneity (I²=60–89% across outcomes).

**Does this change CogniTrack? NO — wrong construct entirely.** This meta-analyzes
whether repeated *training* interventions (VR/app-based cognitive exercises,
administered 8–48 sessions over 4–20 weeks) **improve** cognition in MCI/dementia
patients — a therapeutic-efficacy question. CogniTrack is a **measurement** tool, not
a training intervention; it makes no claim (and should make no claim) of improving
users' cognition through repeated play. The one tangential point worth noting: this
meta-analysis found training significantly improved memory/attention/visuospatial
but **not** frontal executive function (SMD 0.25, not significant) — this is about
training efficacy, not measurement validity, so it doesn't bear on CogniTrack's
Executive scoring; noted only because it's a second, independent data point (after
MacLeod 1991's ceiling-effect finding) that Executive function is a harder construct
to move/measure than the other domains — mildly reinforcing, not actionable.

---

## Summary table

| # | First author, year | Type | Quality | Population match | Verdict |
|---|---|---|---|---|---|
| P1 | Ding 2022 | Systematic review | High | Clinical (MCI/dementia) | PARTIAL |
| P2 | Chan 2021 | Systematic review | Moderate (partial extraction) | Clinical | NO |
| P3 | Piau 2019 | Systematic review | High | Clinical, wrong modality (passive sensors) | NO |
| P4 | Belleville 2017 | Systematic review + meta-analysis | High | Clinical (longitudinal conversion) | PARTIAL |
| P5 | Naole (student paper) | Narrative comparison | Low | Clinical screening tools | NO |
| P6 | Li (cross-disciplinary) | Narrative review | Low | Clinical screening tools | NO |
| P7 | Poyiadzi 2020 | arXiv preprint, N=2 | Low | Clinical, wrong modality | NO |
| P8 | Porta-Mas 2025 | Systematic review | High | Clinical (biomarker validation) | PARTIAL |
| P9 | Weintraub 2013 | Validation study | High | **General population — closest match** | PARTIAL |
| P10 | Harvey 2019 | Narrative review | Moderate | General clinical neuropsych | PARTIAL |
| P11 | Petersen 2004 | Foundational clinical review | High (as definitional source) | Clinical diagnosis | NO |
| P12 | Park & Ha 2024 | Systematic review + meta-analysis | High | Clinical, wrong construct (training) | NO |

**Net effect on `app/core/cci.py`: none.** Net effect on documentation: strengthened
domain-taxonomy grounding, one new documented limitation (device variability,
untested), one new Future Work item (formal self-validation study), and sharper
language distinguishing "detects current impairment" (cross-sectional effect size)
from "predicts future decline" (longitudinal predictive validity) — CogniTrack does
neither, but the distinction matters if either claim is ever tempting to make in
future user-facing copy.
