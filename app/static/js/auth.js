/* ============================================================
   CogniTrack — auth.js
   Shared client-side behaviour for login.html & register.html:
   validation, password visibility toggle, strength meter,
   submit-lock. Client-side only — routes/auth.py and
   auth_service.py hold the server-side source of truth.
   ============================================================
   Table of Contents
   01. Password Visibility Toggles
   02. Password Strength Meter (register only)
   03. Shared Field-Error Helpers
   04. Login Form
   05. Register Form
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  initPasswordToggles();
  initPasswordStrength();
  initLoginForm();
  initRegisterForm();

  /* ----------------------------------------------------------
     01. PASSWORD VISIBILITY TOGGLES
     Reads/writes: [data-password-toggle] buttons
  ---------------------------------------------------------- */
  function initPasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
      var targetId = btn.getAttribute('data-password-toggle');
      var input = document.getElementById(targetId);
      if (!input) return;

      btn.addEventListener('click', function () {
        var isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!isVisible));
        btn.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');

        var icon = btn.querySelector('[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', isVisible ? 'eye' : 'eye-off');
          if (typeof CT !== 'undefined' && CT.renderIcons) { CT.renderIcons(); }
        }
      });
    });
  }

  /* ----------------------------------------------------------
     02. PASSWORD STRENGTH METER
     Reads: #register-password  Writes: [data-strength-bar/label]
  ---------------------------------------------------------- */
  function initPasswordStrength() {
    var input = document.getElementById('register-password');
    var bar   = document.querySelector('[data-strength-bar]');
    var label = document.querySelector('[data-strength-label]');
    if (!input || !bar || !label) return;

    input.addEventListener('input', function () {
      var value = input.value;
      var score = scorePassword(value);
      var level = !value ? '' : score >= 4 ? 'strong' : score >= 2 ? 'fair' : 'weak';

      if (level) {
        bar.setAttribute('data-level', level);
      } else {
        bar.removeAttribute('data-level');
      }

      label.textContent =
        level === 'strong' ? 'Strong password' :
        level === 'fair'   ? 'Fair — add more variety' :
        level === 'weak'   ? 'Weak — try a longer password' :
        'Password strength';
    });
  }

  function scorePassword(value) {
    var score = 0;
    if (value.length >= 8)  score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return score;
  }

  /* ----------------------------------------------------------
     03. SHARED FIELD-ERROR HELPERS
  ---------------------------------------------------------- */
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function clearErrors(form) {
    form.querySelectorAll('.auth-field-error').forEach(function (el) { el.remove(); });
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
    err.className = 'form-error auth-field-error';
    err.setAttribute('role', 'alert');
    err.textContent = msg;

    /* Password inputs are wrapped in .auth-password-field — anchor
       the message after the wrapper, not the bare input. */
    var anchor = el.closest('.auth-password-field') || el;
    anchor.parentNode.insertBefore(err, anchor.nextSibling);
  }

  function wireClearOnInput(ids) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        el.classList.remove('input--error');
        el.removeAttribute('aria-invalid');
        var anchor = el.closest('.auth-password-field') || el;
        var next = anchor.nextSibling;
        if (next && next.classList && next.classList.contains('auth-field-error')) {
          next.remove();
        }
      });
    });
  }

  function lockSubmit(form) {
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn && typeof CT !== 'undefined' && CT.lockButton) {
      CT.lockButton(submitBtn);
    }
  }

  function focusFirstError(form) {
    var firstError = form.querySelector('.auth-field-error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ----------------------------------------------------------
     04. LOGIN FORM
  ---------------------------------------------------------- */
  function initLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;

    var isSubmitting = false;
    wireClearOnInput(['login-email', 'login-password']);

    form.addEventListener('submit', function (e) {
      if (isSubmitting) return;
      clearErrors(form);

      var emailEl    = document.getElementById('login-email');
      var passwordEl = document.getElementById('login-password');
      var valid = true;

      if (!emailEl.value.trim() || !isValidEmail(emailEl.value.trim())) {
        markInvalid(emailEl, 'Enter a valid email address.');
        valid = false;
      }
      if (!passwordEl.value) {
        markInvalid(passwordEl, 'Enter your password.');
        valid = false;
      }

      if (!valid) {
        e.preventDefault();
        focusFirstError(form);
        return;
      }

      /* Valid — submit natively to routes/auth.py, just lock the button. */
      isSubmitting = true;
      lockSubmit(form);
    });
  }

  /* ----------------------------------------------------------
     05. REGISTER FORM
  ---------------------------------------------------------- */
  function initRegisterForm() {
    var form = document.getElementById('register-form');
    if (!form) return;

    var isSubmitting = false;
    wireClearOnInput(['register-name', 'register-email', 'register-password', 'register-confirm-password']);

    form.addEventListener('submit', function (e) {
      if (isSubmitting) return;
      clearErrors(form);

      var nameEl     = document.getElementById('register-name');
      var emailEl    = document.getElementById('register-email');
      var passwordEl = document.getElementById('register-password');
      var confirmEl  = document.getElementById('register-confirm-password');
      var termsEl    = document.getElementById('register-terms');
      var valid = true;

      if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
        markInvalid(nameEl, 'Please enter your full name.');
        valid = false;
      }
      if (!emailEl.value.trim() || !isValidEmail(emailEl.value.trim())) {
        markInvalid(emailEl, 'Enter a valid email address.');
        valid = false;
      }
      if (!passwordEl.value || passwordEl.value.length < 8) {
        markInvalid(passwordEl, 'Password must be at least 8 characters.');
        valid = false;
      }
      if (!confirmEl.value || confirmEl.value !== passwordEl.value) {
        markInvalid(confirmEl, 'Passwords do not match.');
        valid = false;
      }
      if (termsEl && !termsEl.checked) {
        valid = false;
      }

      if (!valid) {
        e.preventDefault();
        focusFirstError(form);
        if (termsEl && !termsEl.checked) { termsEl.focus(); }
        return;
      }

      isSubmitting = true;
      lockSubmit(form);
    });
  }

});
