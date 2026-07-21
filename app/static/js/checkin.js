/* ============================================================
   CogniTrack — Today's Assessment Check-In
   checkin.js   Sprint 7.4.5 / Sprint 8 (guest profile fields)

   Collects only temporary, per-session state (sleep, stress, caffeine,
   mood, etc.) — permanent profile fields (name, age, gender, education,
   dominant hand, native language) are collected once at Registration or
   via Edit Profile for signed-in users, and are never asked here for
   them. Guests have no registration step, so this page is also where
   THEY optionally give the same demographic fields — all optional (see
   the guest-only block in user.html) — persisted to a GuestProfile row
   keyed by an anonymous, temporary session id (core/guest.py), never a
   permanent account.

   Writes to sessionStorage under 'cognitrack_checkin' (and, for guests,
   'cognitrack_guest_profile') — read by cognitrack-core.js's
   startSessionTask() and sent as the `checkin`/`profile` objects to
   POST /api/assessment/start or /api/guest/assessment/start.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var form = document.querySelector('.onboarding-form');
  if (!form) return;

  var isSubmitting = false;

  /* Medication follow-up ("does it affect attention/alertness/mood/
     thinking?") only makes sense once Medication = Yes — shown/hidden
     with the native `hidden` attribute, no animation needed. Runs once
     at load too, since a resumed check-in or browser back/forward cache
     can restore Medication's value without firing `change`. */
  var medicationSelectEl = document.getElementById('medication');
  var medicationEffectGroupEl = document.getElementById('medication-effect-group');
  function syncMedicationEffectVisibility() {
    if (!medicationSelectEl || !medicationEffectGroupEl) return;
    medicationEffectGroupEl.hidden = medicationSelectEl.value !== 'yes';
  }
  if (medicationSelectEl) {
    medicationSelectEl.addEventListener('change', syncMedicationEffectVisibility);
    syncMedicationEffectVisibility();
  }

  var REQUIRED_IDS = [
    'sleep-quality', 'stress-level', 'hours-slept',
    'caffeine-today', 'current-mood', 'distractions'
  ];

  form.addEventListener('submit', function (e) {
    if (isSubmitting) return;
    e.preventDefault();

    clearErrors();

    var sleepEl      = document.getElementById('sleep-quality');
    var stressEl     = document.getElementById('stress-level');
    var hoursEl      = document.getElementById('hours-slept');
    var caffeineEl   = document.getElementById('caffeine-today');
    var medicationEl       = document.getElementById('medication');
    var medicationEffectEl = document.getElementById('medication-effect');
    var moodEl       = document.getElementById('current-mood');
    var glassesEl    = document.getElementById('wearing-glasses');
    var distractEl   = document.getElementById('distractions');
    var familyHistEl = document.getElementById('family-history');
    var nameEl       = document.getElementById('guest-name'); /* guests only */

    var valid = true;

    if (sleepEl && !sleepEl.value) {
      markInvalid(sleepEl, 'Please select your sleep quality.');
      valid = false;
    }
    if (stressEl && !stressEl.value) {
      markInvalid(stressEl, 'Please select your stress level.');
      valid = false;
    }

    var hoursVal = hoursEl ? parseFloat(hoursEl.value) : NaN;
    if (!hoursEl || !hoursEl.value.trim() || isNaN(hoursVal) || hoursVal < 0 || hoursVal > 24) {
      markInvalid(hoursEl, 'Please enter a realistic number of hours (0 – 24).');
      valid = false;
    }
    if (caffeineEl && !caffeineEl.value) {
      markInvalid(caffeineEl, 'Please select your caffeine intake today.');
      valid = false;
    }
    if (moodEl && !moodEl.value) {
      markInvalid(moodEl, 'Please select your current mood.');
      valid = false;
    }
    if (distractEl && !distractEl.value) {
      markInvalid(distractEl, 'Please select your current distraction level.');
      valid = false;
    }

    /* Medication and Wearing Glasses are optional — no validation. */

    if (!valid) {
      var firstError = form.querySelector('.user-field-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    var checkinData = {
      sleepQuality:   sleepEl    ? sleepEl.value    : '',
      stressLevel:    stressEl   ? stressEl.value   : '',
      hoursSlept:     hoursVal,
      caffeineToday:  caffeineEl ? caffeineEl.value : '',
      medication:     medicationEl ? medicationEl.value : '',
      medicationCognitiveEffect: (medicationEl && medicationEl.value === 'yes' && medicationEffectEl)
        ? medicationEffectEl.value : '',
      currentMood:    moodEl     ? moodEl.value     : '',
      wearingGlasses: glassesEl && glassesEl.value ? glassesEl.value === 'yes' : null,
      distractions:   distractEl ? distractEl.value : '',
      familyHistory:  familyHistEl ? familyHistEl.value : ''
    };

    try {
      sessionStorage.setItem('cognitrack_checkin', JSON.stringify(checkinData));
    } catch (e) { /* private browsing / storage full — proceed anyway */ }

    /* Guests only: optional name (also mirrored for dashboard-greeting
       personalisation, same as before) plus optional age/gender/
       education/dominant hand/native language — all sent as a separate
       `profile` object, since these are GuestProfile fields, not
       check-in state. */
    if (nameEl) {
      var nameVal = nameEl.value.trim();
      if (nameVal) {
        try { sessionStorage.setItem('cognitrack_user', JSON.stringify({ name: nameVal })); } catch (e) {}
      }

      var ageEl        = document.getElementById('guest-age');
      var genderEl     = document.getElementById('guest-gender');
      var educationEl  = document.getElementById('guest-education');
      var handEl       = document.getElementById('guest-hand');
      var languageEl   = document.getElementById('guest-native-language');

      var guestProfile = {
        name:            nameVal || null,
        age:             ageEl && ageEl.value ? parseInt(ageEl.value, 10) : null,
        gender:          genderEl && genderEl.value ? genderEl.value : null,
        education:       educationEl && educationEl.value ? educationEl.value : null,
        dominant_hand:   handEl && handEl.value ? handEl.value : null,
        native_language: languageEl && languageEl.value.trim() ? languageEl.value.trim() : null
      };

      try { sessionStorage.setItem('cognitrack_guest_profile', JSON.stringify(guestProfile)); } catch (e) {}
    }

    /* Clear any prior real assessment run — Check-In precedes a fresh
       attempt, so stale progress from an earlier run shouldn't linger.
       But warn first if that would discard a run the user hasn't
       finished yet (e.g. navigating back to Check-In mid-assessment). */
    if (typeof CT !== 'undefined' && CT.clearAssessmentData) {
      var priorProgress    = CT.loadProgress ? CT.loadProgress() : null;
      var hasUnfinishedRun = !!(priorProgress && priorProgress.assessmentStarted && !priorProgress.assessmentCompleted);

      if (hasUnfinishedRun && !window.confirm(
        'You have an assessment in progress. Starting a new check-in will discard that progress. Continue?'
      )) {
        return;
      }

      CT.clearAssessmentData();
    }

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn && typeof CT !== 'undefined' && CT.lockButton) {
      CT.lockButton(submitBtn);
    }

    isSubmitting = true;
    form.submit();
  });

  function clearErrors() {
    form.querySelectorAll('.user-field-error').forEach(function (el) {
      el.remove();
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
    });
  }

  function markInvalid(el, msg) {
    if (!el) return;
    el.classList.add('input--error');
    el.setAttribute('aria-invalid', 'true');

    var err = document.createElement('p');
    err.className   = 'form-error user-field-error';
    err.setAttribute('role', 'alert');
    err.textContent = msg;

    el.parentNode.insertBefore(err, el.nextSibling);
  }

  REQUIRED_IDS.forEach(function (id) {
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
