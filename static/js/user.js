/* ============================================================
   CogniTrack — User Information Form
   user.js   Sprint 3.5
   Client-side validation + sessionStorage handoff
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var form = document.querySelector('.onboarding-form');
  if (!form) return;

  /* Guard against infinite loops — form.submit() should not
     re-fire the submit event per spec, but we protect anyway. */
  var isSubmitting = false;

  form.addEventListener('submit', function (e) {
    if (isSubmitting) return;
    e.preventDefault();

    clearErrors();

    var nameEl  = document.getElementById('full-name');
    var ageEl   = document.getElementById('age');
    var genderEl= document.getElementById('gender');
    var eduEl   = document.getElementById('education');
    var sleepEl = document.getElementById('sleep-quality');
    var handEl  = document.getElementById('dominant-hand'); /* optional */

    var valid = true;

    /* ── Name: required, ≥ 2 chars ────────────────────────── */
    var nameVal = nameEl ? nameEl.value.trim() : '';
    if (!nameVal || nameVal.length < 2) {
      markInvalid(nameEl, 'Please enter your full name.');
      valid = false;
    }

    /* ── Age: required, realistic integer ──────────────────── */
    var ageVal = ageEl ? parseInt(ageEl.value, 10) : NaN;
    if (!ageEl || !ageEl.value.trim() || isNaN(ageVal) || ageVal < 1 || ageVal > 120) {
      markInvalid(ageEl, 'Please enter a valid age (1 – 120).');
      valid = false;
    }

    /* ── Gender: must select ────────────────────────────────── */
    if (genderEl && !genderEl.value) {
      markInvalid(genderEl, 'Please select your gender.');
      valid = false;
    }

    /* ── Education: must select ─────────────────────────────── */
    if (eduEl && !eduEl.value) {
      markInvalid(eduEl, 'Please select your education level.');
      valid = false;
    }

    /* ── Sleep Quality: must select ─────────────────────────── */
    if (sleepEl && !sleepEl.value) {
      markInvalid(sleepEl, 'Please select your sleep quality.');
      valid = false;
    }

    /* ── Dominant Hand: optional — no validation needed ─────── */

    if (!valid) {
      /* Scroll first error into view */
      var firstError = form.querySelector('.user-field-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    /* ── Save demographics to sessionStorage ─────────────────── */
    var userData = {
      name:         nameVal,
      age:          ageVal,
      gender:       genderEl  ? genderEl.value  : '',
      education:    eduEl     ? eduEl.value      : '',
      sleepQuality: sleepEl   ? sleepEl.value    : '',
      dominantHand: handEl    ? handEl.value     : ''
    };

    try {
      sessionStorage.setItem('cognitrack_user', JSON.stringify(userData));
    } catch (e) { /* private browsing / storage full — proceed anyway */ }

    /* ── Submit natively (GET → /assessment with all form values) */
    isSubmitting = true;
    form.submit();
  });

  /* ── Clear all previous error states ───────────────────── */
  function clearErrors() {
    form.querySelectorAll('.user-field-error').forEach(function (el) {
      el.remove();
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
    });
  }

  /* ── Mark a single field invalid ───────────────────────── */
  function markInvalid(el, msg) {
    if (!el) return;
    el.classList.add('input--error'); /* works for both .input and .select */
    el.setAttribute('aria-invalid', 'true');

    var err = document.createElement('p');
    err.className   = 'form-error user-field-error';
    err.setAttribute('role', 'alert');
    err.textContent = msg;

    /* Insert immediately after the field element */
    el.parentNode.insertBefore(err, el.nextSibling);
  }

  /* ── Clear error on field interaction ──────────────────── */
  ['full-name', 'age', 'gender', 'education', 'sleep-quality'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  function () { clearFieldError(this); });
    el.addEventListener('change', function () { clearFieldError(this); });
  });

  function clearFieldError(el) {
    el.classList.remove('input--error');
    el.removeAttribute('aria-invalid');
    var next = el.nextSibling;
    if (next && next.classList && next.classList.contains('user-field-error')) {
      next.remove();
    }
  }

});
