/* ============================================================
   CogniTrack — Assessment Hub
   hub.js

   Reveals exactly one of three mutually-exclusive states in the hub
   card — none / in_progress / completed — from a single authoritative
   source:

     • Signed-in users: window.CT_ASSESSMENT_STATE, computed server-side
       from the database (routes/assessment.py -> get_user_assessment_state).
       For 'in_progress', window.CT_RESUME carries the real DB session, so
       CT.hydrateResumeProgress() mirrors it into sessionStorage before the
       Resume link's href is derived — making Resume work even in a brand-new
       browser or after sessionStorage was cleared.

     • Guests: also server-authoritative once a guest_id cookie exists
       (routes/assessment.py -> get_guest_assessment_state), same as
       signed-in users. CT_ASSESSMENT_STATE is only null for a guest who
       has never reached Check-In yet — sessionStorage progress is the
       fallback for that one case.

   No progress logic is duplicated here — state resolution reuses
   CT.loadProgress() / CT.getNextModuleUrl().
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  if (typeof CT === 'undefined') { return; }

  var blocks = {
    none:        document.getElementById('hub-state-none'),
    in_progress: document.getElementById('hub-state-progress'),
    completed:   document.getElementById('hub-state-completed')
  };

  /* Resolve the authoritative state. */
  var state;
  if (typeof window.CT_ASSESSMENT_STATE === 'string' && window.CT_ASSESSMENT_STATE) {
    /* Signed-in: server is authoritative. Hydrate the in-progress DB
       session into sessionStorage so the module pages can resume it. */
    state = window.CT_ASSESSMENT_STATE;
    if (state === 'in_progress' && window.CT_RESUME && CT.hydrateResumeProgress) {
      CT.hydrateResumeProgress(window.CT_RESUME);
    }
  } else {
    /* Guest: sessionStorage progress is authoritative. */
    var progress = CT.loadProgress();
    if (progress && progress.assessmentStarted && !progress.assessmentCompleted) {
      state = 'in_progress';
    } else if (progress && progress.assessmentCompleted) {
      state = 'completed';
    } else {
      state = 'none';
    }
  }

  /* Reveal the matching block, hide the others. */
  Object.keys(blocks).forEach(function (key) {
    if (blocks[key]) { blocks[key].hidden = (key !== state); }
  });

  /* Point the Resume link at the next incomplete module. */
  if (state === 'in_progress') {
    var btn = document.getElementById('js-resume-btn');
    if (btn) { btn.setAttribute('href', CT.getNextModuleUrl()); }
  }
});
