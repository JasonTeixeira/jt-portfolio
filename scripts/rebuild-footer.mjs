#!/usr/bin/env node
/**
 * rebuild-footer.mjs — replace the old single-line footer on the marketing pages with a
 * proper multi-column footer (brand block + link columns + legal bar). Idempotent: it only
 * rewrites the legacy footer (matched by its signature) and skips pages already rebuilt or
 * that use a different footer (the generated Learn/docs pages have their own).
 *
 * Run: node scripts/rebuild-footer.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SVGS = {
  github: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.3 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.05.78 2.12v3.15c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>',
  linkedin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z"/></svg>',
  youtube: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>',
  mail: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 6l9 6 9-6"/></svg>',
};

const COLS = [
  { h: 'Explore', links: [['Approach', 'approach.html'], ['Services', 'services.html'], ['Automations', '/automations/'], ['Scope a project', 'build.html']] },
  { h: 'Work', links: [['Case studies', 'case-studies.html'], ['Founding rate', 'founding-clients.html'], ['Proof', 'proof.html'], ['Lab', 'lab.html']] },
  { h: 'Learn', links: [['Learn library', 'learn.html'], ['Docs', 'docs.html'], ['Glossary', 'glossary.html'], ['Tool comparisons', 'compare.html'], ['Embed a diagram', 'embeds.html']] },
  { h: 'More', links: [['What I build', 'what-i-build.html'], ['ROI calculator', 'roi.html'], ['Hiring?', 'hire-ai-qa-engineer.html'], ['Academy ↗', 'https://sageideas.dev/academy']] },
];

function socialLink(href, label, svg, ext) {
  const attrs = ext ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${href}"${attrs} aria-label="${label}">${svg}</a>`;
}

const NEW_FOOTER = `<footer class="site-footer">
    <div class="foot-top">
      <div class="foot-brand">
        <a href="index.html" class="foot-logo" aria-label="Jason Teixeira — home"><span class="fl-mk"><span style="color:#22d3ee">J</span><span style="color:#a78bfa">T</span></span><span class="fl-nm">jason.teixeira<span style="color:#10b981">()</span></span></a>
        <p class="foot-tag">I ship AI features, then I prove they work. Evaluation, QA, and automation for teams shipping LLM products.</p>
        <div class="foot-social" aria-label="Social links">
          ${socialLink('https://github.com/JasonTeixeira', 'GitHub', SVGS.github, true)}
          ${socialLink('https://www.linkedin.com/in/jason-teixeira', 'LinkedIn', SVGS.linkedin, true)}
          ${socialLink('https://www.youtube.com/@SageideasAI', 'YouTube', SVGS.youtube, true)}
          ${socialLink('mailto:hello@sageideas.dev', 'Email', SVGS.mail, false)}
        </div>
      </div>
      <nav class="foot-cols" aria-label="Footer">
        ${COLS.map((c) => `<div class="foot-col"><h4>${c.h}</h4>${c.links.map(([t, h]) => {
    const ext = /^https?:/.test(h);
    return `<a href="${h}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  }).join('')}</div>`).join('\n        ')}
      </nav>
    </div>
    <div class="foot-bottom">
      <span class="foot-meta">© <span data-year>2026</span> Jason Teixeira · Sage Ideas LLC <span class="foot-dot">·</span> <a href="privacy.html">Privacy</a> <span class="foot-dot">·</span> <a href="terms.html">Terms</a></span>
      <span class="foot-ethos">Every number labeled verified or estimated. No fake green.</span>
    </div>
  </footer>`;

// Match the legacy single-line footer OR an already-rebuilt one (so this is re-runnable).
const LEGACY = /<footer style="border-top:1px solid #2A2826;padding:22px[\s\S]*?no fake green[\s\S]*?<\/footer>/;
const REBUILT = /<footer class="site-footer">[\s\S]*?<\/footer>/;

const files = readdirSync('.').filter((f) => f.endsWith('.html'));
let changed = 0; const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  var re = LEGACY.test(src) ? LEGACY : (REBUILT.test(src) ? REBUILT : null);
  if (!re) continue;
  const out = src.replace(re, NEW_FOOTER);
  if (out !== src) { writeFileSync(f, out); changed++; touched.push(f); }
}
console.log(`rebuild-footer: rewrote footer on ${changed} page(s)${touched.length ? ' — ' + touched.slice(0, 8).join(', ') + (touched.length > 8 ? ' …' : '') : ''}`);
