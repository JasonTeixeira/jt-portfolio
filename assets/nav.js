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

  // Inject auth buttons into every nav (Login/Sign up when logged out, Dashboard/Log out
  // when logged in). Reads the same localStorage session key that assets/auth.mjs writes.
  function readSession() {
    try { return JSON.parse(localStorage.getItem('jt_auth') || 'null'); } catch { return null; }
  }
  // Auth-button labels are localized so the ES/PT nav isn't half-English.
  var AUTH_L = {
    en: { dash: 'Dashboard', logout: 'Log out', login: 'Log in', signup: 'Sign up' },
    es: { dash: 'Panel', logout: 'Cerrar sesión', login: 'Iniciar sesión', signup: 'Registrarse' },
    pt: { dash: 'Painel', logout: 'Sair', login: 'Entrar', signup: 'Cadastrar-se' },
  };
  function navLoc() { var p = location.pathname; return /^\/pt(\/|$)/.test(p) ? 'pt' : /^\/es(\/|$)/.test(p) ? 'es' : 'en'; }
  function injectAuth(nav) {
    var panel = nav.querySelector('.site-nav-links');
    if (!panel || panel.getAttribute('data-auth-injected')) return;
    panel.setAttribute('data-auth-injected', '1');
    var session = readSession();
    var L = AUTH_L[navLoc()] || AUTH_L.en;
    function link(label, href, cls) { var a = document.createElement('a'); a.textContent = label; a.href = href; a.className = cls || 'site-nav-link'; return a; }
    if (session && session.email) {
      panel.appendChild(link(L.dash, 'dashboard.html'));
      var out = document.createElement('button');
      out.type = 'button'; out.className = 'site-nav-link';
      out.style.cssText = 'background:none;border:none;cursor:pointer;font:inherit;color:inherit';
      out.textContent = L.logout;
      out.addEventListener('click', function () { try { localStorage.removeItem('jt_auth'); } catch { /* ignore */ } location.href = 'index.html'; });
      panel.appendChild(out);
    } else {
      panel.appendChild(link(L.login, 'login.html'));
      panel.appendChild(link(L.signup, 'signup.html', 'btn-solid green site-nav-cta'));
    }
  }

  var navs = document.querySelectorAll('.site-nav');
  for (var i = 0; i < navs.length; i++) { initNav(navs[i]); injectAuth(navs[i]); }
})();
