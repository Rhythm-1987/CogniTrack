/* ============================================================
   CogniTrack — main.js
   Single consolidated JavaScript entry point for the platform.
   Runs after the DOM is parsed; Lucide is guaranteed available
   because DOMContentLoaded fires after all deferred scripts.
   ============================================================
   Table of Contents
   01. Lucide Icons  — initialise all [data-lucide] elements
   02. Navbar        — scroll shadow + mobile drawer
   03. Dropdown Menus — authenticated avatar dropdown + guest Account menu
   04. Scroll Reveal — IntersectionObserver for .scroll-reveal elements
   05. Flash Messages
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ----------------------------------------------------------
     01. LUCIDE ICONS
  ---------------------------------------------------------- */
  CT.renderIcons();

  /* ----------------------------------------------------------
     02. NAVBAR
  ---------------------------------------------------------- */
  initNavbar();

  /* ----------------------------------------------------------
     03. DROPDOWN MENUS
  ---------------------------------------------------------- */
  initDropdownMenu('nav-profile', 'nav-profile-trigger', 'nav-profile-menu');
  initDropdownMenu('nav-account', 'nav-account-trigger', 'nav-account-menu');

  /* ----------------------------------------------------------
     04. SCROLL REVEAL
  ---------------------------------------------------------- */
  initScrollReveal();

  /* ----------------------------------------------------------
     05. FLASH MESSAGES
  ---------------------------------------------------------- */
  initFlashMessages();

});


/* ============================================================
   initNavbar()
   Scroll shadow on .navbar and mobile drawer toggle.
   Reads/writes: #navbar, #nav-toggle, #mobile-menu,
                 #hamburger-icon
============================================================ */
function initNavbar() {
  var navbar     = document.getElementById('navbar');
  var toggle     = document.getElementById('nav-toggle');
  var drawer     = document.getElementById('mobile-menu');
  var toggleIcon = document.getElementById('hamburger-icon');

  /* Guard — navbar may not exist on every page */
  if (!navbar || !toggle || !drawer || !toggleIcon) { return; }

  /* ---- Scroll shadow ---- */
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('is-scrolled', window.scrollY > 8);
  }, { passive: true });

  /* ---- Drawer helpers ---- */
  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation menu');
    toggleIcon.setAttribute('data-lucide', 'x');
    CT.renderIcons();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggleIcon.setAttribute('data-lucide', 'menu');
    CT.renderIcons();
  }

  /* ---- Toggle on button click ---- */
  toggle.addEventListener('click', function () {
    drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
  });

  /* ---- Close when a drawer link is followed ---- */
  drawer.querySelectorAll('.mobile-nav__link').forEach(function (link) {
    link.addEventListener('click', closeDrawer);
  });

  /* ---- Close on Escape key; return focus to toggle ---- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
      toggle.focus();
    }
  });

  /* ---- Close when viewport expands past the mobile breakpoint ---- */
  var mq = window.matchMedia('(min-width: 768px)');
  var onBreakpointChange = function (e) { if (e.matches) { closeDrawer(); } };
  if (mq.addEventListener) {
    mq.addEventListener('change', onBreakpointChange);
  } else if (mq.addListener) {
    /* Safari < 14 has no addEventListener on MediaQueryList */
    mq.addListener(onBreakpointChange);
  }
}


/* ============================================================
   initDropdownMenu(rootId, triggerId, menuId)
   Generic trigger -> popover-menu toggle, shared by the
   authenticated Profile menu (avatar -> View Profile / Dashboard /
   Logout) and the guest Account menu (Account -> Create Account /
   Sign In). Closes on outside click, Escape, or focus leaving the
   menu. No-op when the elements aren't present on the current page
   (only one of the two ever renders, depending on auth state), so
   it is safe to call for both unconditionally on every page.
============================================================ */
function initDropdownMenu(rootId, triggerId, menuId) {
  var root    = document.getElementById(rootId);
  var trigger = document.getElementById(triggerId);
  var menu    = document.getElementById(menuId);

  if (!root || !trigger || !menu) { return; }

  function open() {
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.addEventListener('click', onOutsideClick, true);
  }

  function close() {
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.removeEventListener('click', onOutsideClick, true);
  }

  function onOutsideClick(e) {
    if (!root.contains(e.target)) { close(); }
  }

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    root.classList.contains('is-open') ? close() : open();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-open')) {
      close();
      trigger.focus();
    }
  });
}


/* ============================================================
   initScrollReveal()
   Observes every .scroll-reveal element and adds .visible when
   it enters the viewport, triggering the CSS transition.
   Reads/writes: .scroll-reveal → .visible
   Falls back to immediate reveal if IntersectionObserver is
   unavailable (old browsers, pre-render environments).
============================================================ */
function initScrollReveal() {
  var items = document.querySelectorAll('.scroll-reveal');
  if (!items.length) { return; }

  /* Graceful degradation */
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); /* fire once, then stop watching */
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px' /* trigger slightly before the element reaches the fold */
  });

  items.forEach(function (el) { observer.observe(el); });
}


/* ============================================================
   initFlashMessages()
   Wires the dismiss button on each server-rendered .flash and
   auto-dismisses after 6s (paused on hover/focus so a message
   isn't lost mid-read).
   Reads/writes: .flash, .flash__close  → .flash--closing
============================================================ */
function initFlashMessages() {
  document.querySelectorAll('.flash').forEach(function (el) {
    var timer = window.setTimeout(function () { dismiss(el); }, 6000);

    el.addEventListener('mouseenter', function () { window.clearTimeout(timer); });
    el.addEventListener('focusin', function () { window.clearTimeout(timer); });

    var closeBtn = el.querySelector('[data-flash-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        window.clearTimeout(timer);
        dismiss(el);
      });
    }
  });

  function dismiss(el) {
    el.classList.add('flash--closing');
    el.addEventListener('transitionend', function () { el.remove(); }, { once: true });
  }
}
