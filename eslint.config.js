// Minimal ESLint flat config. Goal: a working lint gate (0 errors), not a
// refactor — warnings are fine, existing behavior is not to be touched here.
import js from '@eslint/js';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  matchMedia: 'readonly',
  requestIdleCallback: 'readonly',
  cancelIdleCallback: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  Image: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  AbortController: 'readonly',
  structuredClone: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  getComputedStyle: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly',
  AbortController: 'readonly',
};

const baseRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': 'warn',
  'no-undef': 'error',
  'no-empty': 'warn',
  'no-constant-condition': ['warn', { checkLoops: false }],
  // Flags some legitimate patterns (assign-then-use-in-later-branch); not a
  // correctness gate worth blocking the build over.
  'no-useless-assignment': 'warn',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'proof-artifacts/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'out/**',
      'captures/**',
      'proof/**',
      'notes/**',
      'outreach/**',
      // generated at build time — huge single-line data payload
      'assets/docs-search.js',
    ],
  },
  // Node ESM: serverless functions, lib, eval scripts
  {
    files: ['api/**/*.js', 'api/**/*.mjs', 'lib/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      ...baseRules,
      'no-console': 'off',
    },
  },
  // Node ESM build/render scripts + Playwright tests/config — these
  // frequently embed browser-context callbacks (e.g. page.evaluate(() =>
  // document...)) inline, so both global sets apply.
  {
    files: [
      'scripts/**/*.mjs',
      'tests/**/*.js',
      'tests/**/*.mjs',
      'playwright.config.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals },
    },
    rules: {
      ...baseRules,
      'no-console': 'off',
    },
  },
  // Browser ESM modules (loaded via <script type="module">)
  {
    files: ['assets/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: baseRules,
  },
  // Browser classic scripts (IIFEs loaded via plain <script>)
  {
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: baseRules,
  },
];
