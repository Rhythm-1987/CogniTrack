/* ============================================================
   CogniTrack — Assessment Overview
   assessment.js

   This page should only ever be reached by submitting the User
   Information form. If someone lands here directly (bookmark,
   typed URL, browser back after clearing storage) with no user
   data on file, send them to /user first rather than showing a
   "Step 2 of 7" page with nothing behind it.

   Otherwise, reads the user's progress from sessionStorage and
   updates the "Begin Assessment" button href to resume from the
   next incomplete module rather than always starting at /memory.

   Reaching this page does NOT count as starting the assessment —
   that only happens on the "Begin Assessment" click below, which is
   the single place assessmentStarted gets set (via CT.initProgress()).
============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  try {
    if (!sessionStorage.getItem('cognitrack_user')) {
      window.location.replace('/user');
      return;
    }
  } catch (e) { /* storage unavailable — proceed rather than block the page */ }

  if (typeof CT === 'undefined') { return; }

  var btn = document.getElementById('btn-begin-assessment');
  if (!btn) { return; }

  var url = CT.getNextModuleUrl();
  if (url) { btn.href = url; }

  /* The assessment is considered "started" only from this click onward.
     CT.initProgress() is a no-op if progress already exists (e.g. the
     user came back to Overview mid-assessment), so it's always safe to
     call here without disturbing an in-progress run. */
  btn.addEventListener('click', function () {
    if (CT.initProgress) { CT.initProgress(); }
  });
});
