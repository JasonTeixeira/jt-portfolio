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
      // Sign up stays a plain link so "Scope a project" is the single primary (green) CTA.
      panel.appendChild(link(L.signup, 'signup.html'));
    }
  }

  // ── Group the flat nav into a few dropdown menus (desktop) / labeled sections (mobile).
  // The static HTML keeps every link (SEO + no-JS fallback); this reorganizes them into
  // three clear groups so the bar reads as a menu, not a wall of 14 equal links.
  var NAV_GROUPS = [
    { key: 'services', label: 'Services', items: [
      ['Approach', 'approach.html'], ['Services', 'services.html'],
      ['Automations', '/automations/'], ['Scope a project', 'build.html'] ] },
    { key: 'work', label: 'Work', items: [
      ['Case studies', 'case-studies.html'], ['Proof', 'proof.html'], ['Lab', 'lab.html'] ] },
    { key: 'learn', label: 'Learn', items: [
      ['Learn library', 'learn.html'], ['Docs', 'docs.html'], ['Glossary', 'glossary.html'],
      ['Tool comparisons', 'compare.html'], ['Field notes', 'field-notes.html'], ['Resources', 'resources.html'] ] },
  ];
  // Localized labels so the ES/PT nav isn't half-English. Keyed by group key and by
  // link basename; anything missing falls back to the English NAV_GROUPS label.
  var NAV_GROUP_L = {
    es: { services: 'Servicios', work: 'Trabajo', learn: 'Aprende' },
    pt: { services: 'Serviços', work: 'Trabalho', learn: 'Aprenda' },
  };
  var NAV_LINK_L = {
    es: {
      'approach.html': 'Enfoque', 'services.html': 'Servicios', 'automations': 'Automatizaciones',
      'build.html': 'Define tu proyecto', 'case-studies.html': 'Casos de estudio', 'proof.html': 'Pruebas',
      'lab.html': 'Lab', 'learn.html': 'Biblioteca', 'docs.html': 'Docs', 'glossary.html': 'Glosario',
      'compare.html': 'Comparativas', 'field-notes.html': 'Notas de campo', 'resources.html': 'Recursos',
    },
    pt: {
      'approach.html': 'Abordagem', 'services.html': 'Serviços', 'automations': 'Automações',
      'build.html': 'Orçar um projeto', 'case-studies.html': 'Estudos de caso', 'proof.html': 'Provas',
      'lab.html': 'Lab', 'learn.html': 'Biblioteca', 'docs.html': 'Docs', 'glossary.html': 'Glossário',
      'compare.html': 'Comparações', 'field-notes.html': 'Notas de campo', 'resources.html': 'Recursos',
    },
  };
  function baseName(href) { return String(href || '').split('#')[0].split('?')[0].replace(/\/$/, '').split('/').pop() || 'index.html'; }
  function closeAllGroups(panel, except) {
    panel.querySelectorAll('.nav-group.open').forEach(function (o) {
      if (o === except) return;
      o.classList.remove('open');
      var b = o.querySelector('.nav-group-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function groupNav(nav) {
    var panel = nav.querySelector('.site-nav-links');
    if (!panel || panel.getAttribute('data-grouped')) return;
    var loc = navLoc();
    var groupL = NAV_GROUP_L[loc] || {};
    var linkL = NAV_LINK_L[loc] || {};
    var existing = {};
    panel.querySelectorAll('a.site-nav-link').forEach(function (a) { existing[baseName(a.getAttribute('href'))] = a; });
    var cta = panel.querySelector('.site-nav-cta');
    var cur = baseName(location.pathname);
    panel.querySelectorAll('a.site-nav-link').forEach(function (a) { if (a !== cta) a.remove(); });

    var frag = document.createDocumentFragment();
    NAV_GROUPS.forEach(function (g) {
      var group = document.createElement('div'); group.className = 'nav-group';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'nav-group-btn';
      btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = (groupL[g.key] || g.label) + '<span class="nav-caret" aria-hidden="true">▾</span>';
      var dd = document.createElement('div'); dd.className = 'nav-dropdown';
      var active = false;
      g.items.forEach(function (it) {
        var bn = baseName(it[1]);
        var a = existing[bn] || document.createElement('a');
        a.textContent = linkL[bn] || it[0]; a.setAttribute('href', it[1]); a.className = 'nav-dd-link';
        if (bn === cur) { a.setAttribute('aria-current', 'page'); active = true; }
        dd.appendChild(a);
      });
      if (active) group.classList.add('nav-group-active');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = group.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        closeAllGroups(panel, group);
      });
      group.appendChild(btn); group.appendChild(dd);
      frag.appendChild(group);
    });
    if (cta) panel.insertBefore(frag, cta); else panel.appendChild(frag);
    panel.setAttribute('data-grouped', '1');

    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAllGroups(panel); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllGroups(panel); });
  }

  var navs = document.querySelectorAll('.site-nav');
  for (var i = 0; i < navs.length; i++) { initNav(navs[i]); groupNav(navs[i]); injectAuth(navs[i]); }
})();
