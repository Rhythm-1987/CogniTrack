/* ============================================================
   CogniTrack — main.js
   Single consolidated JavaScript entry point for the platform.
   Runs after the DOM is parsed; Lucide is guaranteed available
   because DOMContentLoaded fires after all deferred scripts.
   ============================================================
   Table of Contents
   01. Lucide Icons  — initialise all [data-lucide] elements
   02. Navbar        — scroll shadow + mobile drawer
   03. Scroll Reveal — IntersectionObserver for .scroll-reveal elements
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ----------------------------------------------------------
     01. LUCIDE ICONS
  ---------------------------------------------------------- */
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  /* ----------------------------------------------------------
     02. NAVBAR
  ---------------------------------------------------------- */
  initNavbar();

  /* ----------------------------------------------------------
     03. SCROLL REVEAL
  ---------------------------------------------------------- */
  initScrollReveal();

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
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggleIcon.setAttribute('data-lucide', 'menu');
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
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
  window.matchMedia('(min-width: 768px)').addEventListener('change', function (e) {
    if (e.matches) { closeDrawer(); }
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
