/* Unified site nav — mobile hamburger toggle. Minimal, dependency-free. */
(function () {
  'use strict';

  function initNav(nav) {
    var burger = nav.querySelector('.site-nav-burger');
    var panel = nav.querySelector('.site-nav-links');
    if (!burger || !panel) return;

    var lastFocus = null;

    function isOpen() {
      return panel.classList.contains('open');
    }

    function openMenu() {
      lastFocus = document.activeElement;
      panel.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('site-nav-open');
      var firstLink = panel.querySelector('a, button');
      if (firstLink) firstLink.focus();
    }

    function closeMenu(restoreFocus) {
      panel.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('site-nav-open');
      if (restoreFocus && lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    burger.addEventListener('click', function () {
      if (isOpen()) closeMenu(false);
      else openMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closeMenu(true);
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu(false);
    });

    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      if (nav.contains(e.target)) return;
      closeMenu(false);
    });

    var mq = window.matchMedia('(min-width: 761px)');
    function handleViewportChange(e) {
      if (e.matches && isOpen()) closeMenu(false);
    }
    if (mq.addEventListener) mq.addEventListener('change', handleViewportChange);
    else if (mq.addListener) mq.addListener(handleViewportChange);
  }

  var navs = document.querySelectorAll('.site-nav');
  for (var i = 0; i < navs.length; i++) initNav(navs[i]);
})();
