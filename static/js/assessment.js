/* ============================================================
   CogniTrack — Assessment Overview
   assessment.js

   Reads the user's progress from sessionStorage and updates
   the "Begin Assessment" button href to resume from the next
   incomplete module rather than always starting at /memory.
============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  if (typeof CT === 'undefined') { return; }

  var btn = document.getElementById('btn-begin-assessment');
  if (!btn) { return; }

  var url = CT.getNextModuleUrl();
  if (url) { btn.href = url; }
});
