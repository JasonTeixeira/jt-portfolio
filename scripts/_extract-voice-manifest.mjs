// _extract-voice-manifest.mjs — pull the EXACT assistant scripts out of agent.js + narrator.js
// so we regenerate audio from the real source strings (no hand-transcription of accented ES/PT).
// Emits scratchpad/voice-manifest.json: [{ out, text }] where out is the mp3 path to (re)write.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const agent = fs.readFileSync(path.join(root, 'assets/agent.js'), 'utf8');
const narr = fs.readFileSync(path.join(root, 'assets/narrator.js'), 'utf8');

// A double-quoted JS string body (no embedded unescaped double quotes in our source).
const S = '"((?:[^"\\\\]|\\\\.)*)"';
const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

const items = [];
const LANGS = ['en', 'es', 'pt'];

// 1) GREET
{
  const m = agent.match(new RegExp('var GREET = L\\(\\{\\s*en:\\s*' + S + ',\\s*es:\\s*' + S + ',\\s*pt:\\s*' + S, 's'));
  if (!m) throw new Error('GREET not found');
  LANGS.forEach((lg, i) => items.push({ key: 'greet', lang: lg, text: unesc(m[i + 1]) }));
}

// 2) GUIDED entries: `<key>: { clip: '<clip>', ... en: "..", es: "..", pt: ".." }`
{
  const guidedStart = agent.indexOf('var GUIDED = {');
  const block = agent.slice(guidedStart, agent.indexOf('\n  };', guidedStart));
  const re = new RegExp("(\\w+):\\s*\\{\\s*clip:\\s*'([\\w]+)'[\\s\\S]*?en:\\s*" + S + ",\\s*es:\\s*" + S + ",\\s*pt:\\s*" + S, 'g');
  let m, n = 0;
  while ((m = re.exec(block))) {
    const clip = m[2];
    LANGS.forEach((lg, i) => items.push({ key: clip, lang: lg, text: unesc(m[i + 3]) }));
    n++;
  }
  if (n < 15) throw new Error('GUIDED parsed only ' + n + ' entries (expected 15)');
}

// 3) mini-eval capture lines → captureIntro (the minieval `intro`) + captureOk (the minieval `ok`)
{
  // captureIntro: first L({...}) after `var intro = kind === 'minieval'`
  const iStart = agent.indexOf("var intro = kind === 'minieval'");
  const iSlice = agent.slice(iStart, iStart + 900);
  const mi = iSlice.match(new RegExp('en:\\s*' + S + ',\\s*es:\\s*' + S + ',\\s*pt:\\s*' + S, 's'));
  if (!mi) throw new Error('captureIntro not found');
  LANGS.forEach((lg, i) => items.push({ key: 'captureIntro', lang: lg, text: unesc(mi[i + 1]) }));

  // captureOk: first L({...}) after `ok.textContent = kind === 'minieval'`
  const oStart = agent.indexOf("ok.textContent = kind === 'minieval'");
  const oSlice = agent.slice(oStart, oStart + 900);
  const mo = oSlice.match(new RegExp('en:\\s*' + S + ',\\s*es:\\s*' + S + ',\\s*pt:\\s*' + S, 's'));
  if (!mo) throw new Error('captureOk not found');
  LANGS.forEach((lg, i) => items.push({ key: 'captureOk', lang: lg, text: unesc(mo[i + 1]) }));
}

// 4) narration CAPTIONS (en only)
{
  const cStart = narr.indexOf('var CAPTIONS = {');
  const block = narr.slice(cStart, narr.indexOf('\n  };', cStart));
  const re = new RegExp("'?([\\w-]+)'?:\\s*" + S, 'g');
  let m, n = 0;
  while ((m = re.exec(block))) { items.push({ key: 'NARR:' + m[1], lang: 'en', text: unesc(m[2]) }); n++; }
  if (n < 6) throw new Error('CAPTIONS parsed only ' + n + ' (expected 6)');
}

// Map to output paths
const out = items.map((it) => {
  if (it.key.startsWith('NARR:')) {
    return { out: `assets/narration/en/${it.key.slice(5)}.mp3`, text: it.text, lang: 'en' };
  }
  return { out: `assets/concierge/${it.lang}/${it.key}.mp3`, text: it.text, lang: it.lang };
});

const dst = path.join(root, 'scratchpad'); fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(path.join(dst, 'voice-manifest.json'), JSON.stringify(out, null, 2));
console.log(`extracted ${out.length} clips (expect 60):`);
const byLang = out.reduce((a, x) => (a[x.out.split('/')[1]] = (a[x.out.split('/')[1]] || 0) + 1, a), {});
console.log(byLang);
// sanity: show a couple
console.log('sample:', out.find((x) => x.out.endsWith('en/greet.mp3'))?.text?.slice(0, 60));
console.log('sample es:', out.find((x) => x.out.endsWith('es/cost.mp3'))?.text?.slice(0, 60));
console.log('sample narr:', out.find((x) => x.out.includes('narration'))?.text?.slice(0, 60));
