/* ============================================================
   CogniTrack — Assessment Hub
   hub.js

   "Resume Assessment" is always visible, but only enabled when a real
   assessment has actually been started (assessmentStarted is set on
   the "Begin Assessment" click on the Overview page — see
   assessment.js — not on User Information or on merely reaching
   Overview) and not yet completed. When it isn't eligible, the button
   stays in a disabled state with an explanatory hint underneath it
   rather than disappearing, so the Resume feature is always
   discoverable. Reuses CT.loadProgress() and CT.getNextModuleUrl() —
   no duplicated progress logic here.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  if (typeof CT === 'undefined') { return; }

  var btn  = document.getElementById('js-resume-btn');
  var hint = document.getElementById('js-resume-hint');
  if (!btn) { return; }

  var progress  = CT.loadProgress();
  var canResume = !!(progress && progress.assessmentStarted && !progress.assessmentCompleted);

  if (canResume) {
    btn.setAttribute('href', CT.getNextModuleUrl());
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('tabindex');
    if (hint) { hint.hidden = true; }
  }
});
