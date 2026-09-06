/**
 * lab.data.mjs — the source of truth for the public "Lab" wall (lab.html).
 *
 * HONESTY CONTRACT (this is a public page making claims about real businesses):
 *  - `tier` is the true current state, never aspirational. live | beta | prototype | client
 *  - `metric` only appears where it is public + defensible. No invented numbers.
 *  - `link` only when the thing is genuinely public. Omit for internal/NDA work.
 *  - Client work is anonymized — never name a client or expose confidential detail.
 * Jason edits this file to add/adjust builds; `npm run build:lab` regenerates the page.
 */

export const LAB_TIERS = {
  live:      { label: 'Live',       color: '#10b981', note: 'Shipped and running in production.' },
  beta:      { label: 'In build',   color: '#22d3ee', note: 'Real, working, still hardening toward GA.' },
  prototype: { label: 'Prototype',  color: '#a78bfa', note: 'Designed and specced; selectively built.' },
  client:    { label: 'Client build', color: '#F59E0B', note: 'Delivered for a client — shown anonymized.' },
};

export const TIER_ORDER = ['live', 'beta', 'prototype', 'client'];

// Every entry below is grounded in something real. Where a number appears it is
// one Jason can stand behind in a sales conversation.
export const BUILDS = [
  {
    name: 'Nexural Federation',
    tier: 'live',
    category: 'Platform · Fintech media',
    blurb: 'A transparent trading-media platform: real-time market data, a signal engine, a research desk, and a public track record — the "printing press with the lights on".',
    stack: ['Next.js', 'Supabase', 'DuckDB', 'Market-data APIs'],
    link: 'https://nexural.io',
    metric: '39-repo single-operator system',
  },
  {
    name: 'Sage Ideas Academy',
    tier: 'live',
    category: 'EdTech · Markets & AI',
    blurb: 'A markets and AI-engineering academy: structured courses with in-browser code labs, mastery quizzes, certificates, and a retrieval-grounded AI tutor.',
    stack: ['Next.js', 'Supabase', 'Pyodide', 'RAG'],
    link: 'https://sageideas.dev/academy',
    metric: '26 courses · 347 lessons',
  },
  {
    name: 'This site',
    tier: 'live',
    category: 'Meta · Proof of process',
    blurb: 'The agency site you are on right now runs its own QA: a proposal→deposit→client-portal money path, an operator CRM, and a CI proof gate (unit + a11y + Lighthouse) on every change.',
    stack: ['Vercel functions', 'Supabase', 'Stripe', 'Playwright CI'],
    link: 'index.html',
    metric: 'Self-tested, CI-gated',
  },
  {
    name: 'reel-forge',
    tier: 'live',
    category: 'Media automation',
    blurb: 'A programmatic short-form video pipeline — script to rendered vertical video — for a $0-marginal-cost content channel plus a paid generative lane.',
    stack: ['Remotion', 'Node', 'ElevenLabs', 'Generative video'],
    metric: 'Episode pipeline in production',
  },
  {
    name: 'SageQuant',
    tier: 'live',
    category: 'Quant research infra',
    blurb: 'Quantitative research infrastructure over a market-data lake: rule-based setup detection, meta-labeling, and combinatorial purged cross-validation before anything is trusted.',
    stack: ['Python', 'DuckDB', 'NinjaTrader', 'CPCV / DSR'],
    metric: 'Backtest → validation harness',
  },
  {
    name: 'Voza',
    tier: 'beta',
    category: 'Mobile · Consumer',
    blurb: 'A cross-platform mobile app built to production discipline — every route hardened against missing params — with a four-tier verification harness gating each build.',
    stack: ['Expo', 'React Native', 'Supabase'],
    metric: '256 screens · sim-certified',
  },
  {
    name: 'GIGGL',
    tier: 'beta',
    category: 'Mobile · AI social',
    blurb: 'An AI-driven social app with a custom quality engine on the backend, shipping to iOS through an automated EAS / TestFlight pipeline.',
    stack: ['Expo', 'Node API', 'EAS / TestFlight'],
    metric: 'iOS E2E on TestFlight',
  },
  {
    name: 'Hard Things Daily',
    tier: 'beta',
    category: 'Consumer · Habit',
    blurb: 'A daily-discipline app with a shared web + mobile core; the web app has completed its backend cutover behind a fixture-mode toggle.',
    stack: ['Next.js', 'Supabase', 'Expo'],
    metric: 'Web backend live',
  },
  {
    name: 'AI Front Desk (client)',
    tier: 'client',
    category: 'Client · Local services',
    blurb: 'An AI receptionist and operations app for a home-services business: voice intake, photo-based estimates, and a lead-to-job pipeline. Delivered under NDA — shown anonymized.',
    stack: ['Next.js', 'Supabase', 'Voice + vision AI'],
  },
  {
    name: 'Creator commerce site (client)',
    tier: 'client',
    category: 'Client · Creator brand',
    blurb: 'A dark, high-motion commerce and content site for a creator brand — editorial art direction with a production-grade component system. Shown anonymized.',
    stack: ['Next.js', 'Motion', 'Commerce'],
  },
  {
    name: 'Knox',
    tier: 'prototype',
    category: 'Prototype · AI product',
    blurb: 'An AI car-diagnostic concept: photo and symptom input into a guided triage flow. Full product blueprint and mobile hero flow designed; build is selective.',
    stack: ['Mobile', 'LLM', 'Supabase'],
  },
  {
    name: 'Undeny',
    tier: 'prototype',
    category: 'Prototype · AI product',
    blurb: 'An AI assistant that helps people appeal insurance denials — turning a denial letter into a structured, evidence-backed appeal. Specced and documented; gated on domain validation.',
    stack: ['LLM', 'Document AI'],
  },
];
