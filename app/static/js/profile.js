/* ============================================================
   CogniTrack — Profile (Edit Profile toggle)
   profile.js   Sprint 7.4.5

   Toggles between the read-only #profile-view and the editable
   #profile-edit form, and validates the edit form client-side
   before a native POST to auth.profile (routes/auth.py). Server-side
   validation (profile_service.apply_profile_fields) remains the
   source of truth — this only improves the immediate feedback loop.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var viewEl   = document.getElementById('profile-view');
  var editEl   = document.getElementById('profile-edit');
  var toggleBtn = document.getElementById('profile-edit-toggle');
  var cancelBtn = document.getElementById('profile-edit-cancel');

  if (!viewEl || !editEl || !toggleBtn) return;

  toggleBtn.addEventListener('click', function () {
    viewEl.hidden = true;
    editEl.hidden = false;
    var firstField = document.getElementById('profile-name');
    if (firstField) firstField.focus();
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      editEl.hidden = true;
      viewEl.hidden = false;
    });
  }

  var isSubmitting = false;

  editEl.addEventListener('submit', function (e) {
    if (isSubmitting) return;
    clearErrors();

    var nameEl = document.getElementById('profile-name');
    var ageEl  = document.getElementById('profile-age');
    var genderEl = document.getElementById('profile-gender');
    var eduEl  = document.getElementById('profile-education');

    var valid = true;

    if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
      markInvalid(nameEl, 'Please enter your full name.');
      valid = false;
    }

    var ageVal = parseInt(ageEl.value, 10);
    if (!ageEl.value.trim() || isNaN(ageVal) || ageVal < 1 || ageVal > 120) {
      markInvalid(ageEl, 'Please enter a valid age (1 – 120).');
      valid = false;
    }

    if (!genderEl.value) {
      markInvalid(genderEl, 'Please select your gender.');
      valid = false;
    }

    if (!eduEl.value) {
      markInvalid(eduEl, 'Please select your education level.');
      valid = false;
    }

    if (!valid) {
      e.preventDefault();
      var firstError = editEl.querySelector('.profile-field-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    isSubmitting = true;
    var submitBtn = editEl.querySelector('[type="submit"]');
    if (submitBtn && typeof CT !== 'undefined' && CT.lockButton) {
      CT.lockButton(submitBtn);
    }
  });

  function clearErrors() {
    editEl.querySelectorAll('.profile-field-error').forEach(function (el) { el.remove(); });
    editEl.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
    });
  }

  function markInvalid(el, msg) {
    if (!el) return;
    el.classList.add('input--error');
    el.setAttribute('aria-invalid', 'true');

    var err = document.createElement('p');
    err.className = 'form-error profile-field-error';
    err.setAttribute('role', 'alert');
    err.textContent = msg;

    el.parentNode.insertBefore(err, el.nextSibling);
  }

});
