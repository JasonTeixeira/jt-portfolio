#!/usr/bin/env node
/*
 * Build the i18n translation manifest.
 *
 * Scans the top level of es/ and pt/ for *.html files and writes
 * assets/i18n-pages.json as { "es": [...basenames], "pt": [...basenames] }.
 *
 * The runtime language switcher (assets/nav.js) fetches this file so it can
 * hide the ES / PT link on pages that have no translation in that locale,
 * instead of linking to a 404. Re-run this whenever es/ or pt/ pages change.
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function listHtml(dir) {
  let entries;
  try {
    entries = readdirSync(join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name)
    .sort();
}

const manifest = { es: listHtml('es'), pt: listHtml('pt') };

const outDir = join(root, 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'i18n-pages.json');
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`i18n manifest: es=${manifest.es.length} pt=${manifest.pt.length} -> ${outPath}`);
