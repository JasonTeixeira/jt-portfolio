// gen-intro-vo.mjs — generate the Sage Ideas homepage intro VO in Jason's ElevenLabs voice,
// line-by-line so each caption's exact start time is known, then emit precise SCENES/CUES/SOUND_CUES
// timing arrays for assets/intro-video.mjs. Concatenates to assets/intro-vo.mp3.
// Usage: node scripts/gen-intro-vo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENV = '/Users/Sage/code/active/sageideas.dev/.env.local';
let KEY = process.env.ELEVENLABS_API_KEY;
try { for (const l of fs.readFileSync(ENV, 'utf8').split('\n')) { const m = l.match(/^ELEVENLABS_API_KEY=(.*)$/); if (m) KEY = m[1].replace(/^["']|["']$/g, ''); } } catch {}
if (!KEY) { console.error('no ELEVENLABS_API_KEY'); process.exit(1); }
const VOICE = 'MJdPGZVWOz3O2iOT7cx5'; // Jason clone

// id · scene · pause after (s; short within a scene, longer at a scene boundary) · TTS text · caption text
const LINES = [
  ['01', 'hook',    0.85, "Hi, I'm Jason. Welcome to Sage Ideas.",                                                                              'Hi — I’m Jason. Welcome to Sage Ideas.'],
  ['02', 'problem', 0.30, "AI is showing up in everything right now.",                                                                          'AI is showing up in everything right now.'],
  ['03', 'problem', 0.85, "The trouble is, a lot of it ships on a demo and a prayer, and a customer finds the one thing it gets wrong.",         'The trouble is, a lot of it ships on a demo and a prayer — and a customer finds the one thing it gets wrong.'],
  ['04', 'do',      0.30, "So we build both halves: the AI feature you actually want,",                                                         'So we build both halves: the AI feature you actually want…'],
  ['05', 'do',      0.85, "and the proof it works. Evals, tests, and gates that turn trust me into a number you can see.",                       '…and the proof it works — evals, tests, and gates that turn “trust me” into a number you can see.'],
  ['06', 'who',     0.30, "I've spent thirteen years in software quality, at The Home Depot and in fintech.",                                    'I’ve spent thirteen years in software quality, at The Home Depot and in fintech.'],
  ['07', 'who',     0.85, "Today I build and run two live products entirely on my own.",                                                        'Today I build and run two live products entirely on my own.'],
  ['08', 'work',    0.30, "Teams bring me three kinds of work: LLM and RAG evaluation, test automation and CI, and workflow automation.",        'Teams bring me three kinds of work: LLM & RAG evaluation, test automation & CI, and workflow automation.'],
  ['09', 'work',    0.85, "We start with a one-week audit. You leave with a plan either way.",                                                   'We start with a one-week audit — you leave with a plan either way.'],
  ['10', 'cta',     0.30, "If there's an AI feature you're not sure about, let's talk.",                                                         'If there’s an AI feature you’re not sure about, let’s talk.'],
  ['11', 'cta',     0.40, "Book a free call. I'm Jason. Thanks for watching, and welcome to Sage Ideas.",                                        'Book a free call. I’m Jason — thanks for watching, and welcome to Sage Ideas.'],
];

const outDir = path.join(root, 'renders/_intro-vo'); fs.mkdirSync(outDir, { recursive: true });
const q = s => `'${String(s).replace(/'/g, "'\\''")}'`;
const dur = f => +execSync(`ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 ${q(f)}`).toString().trim();

const parts = [], starts = [], durs = [];
let acc = 0;
for (const [id, scene, hold, tts] of LINES) {
  const raw = path.join(outDir, `${id}.mp3`), held = path.join(outDir, `${id}-held.mp3`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: tts, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true } }),
  });
  if (!res.ok) { console.error(`${id}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`); process.exit(1); }
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  execSync(`ffmpeg -y -i ${q(raw)} -af "apad=pad_dur=${hold}" -c:a libmp3lame -q:a 3 ${q(held)}`, { stdio: 'ignore' });
  const d = dur(held);
  starts.push(+acc.toFixed(3)); durs.push(+d.toFixed(3)); acc += d; parts.push(held);
  console.log(`  ✓ ${id} [${scene}]  start ${starts.at(-1)}s  dur ${d.toFixed(2)}s`);
}
const TOTAL = +acc.toFixed(3);

// concat → assets/intro-vo.mp3
const listF = path.join(outDir, 'list.txt');
fs.writeFileSync(listF, parts.map(p => `file '${p}'`).join('\n'));
const mp3 = path.join(root, 'assets/intro-vo.mp3');
execSync(`ffmpeg -y -f concat -safe 0 -i ${q(listF)} -c:a libmp3lame -q:a 3 ${q(mp3)}`, { stdio: 'ignore' });

// build timing arrays
const cues = LINES.map(([id, scene, , , cap], i) => ({ id, scene, t0: starts[i], t1: +(starts[i] + durs[i]).toFixed(3), text: cap }));
const sceneIds = ['hook', 'problem', 'do', 'who', 'work', 'cta'];
const scenes = sceneIds.map((id, i) => {
  const first = cues.find(c => c.scene === id);
  const nextFirst = cues.find(c => c.scene === sceneIds[i + 1]);
  return { id, t0: first.t0, t1: i === sceneIds.length - 1 ? TOTAL : nextFirst.t0 };
});
// sound cues: a whoosh at each scene boundary (except the very first, which gets the rise),
// the gate snap ~1.2s into the "do" scene, a chord on the CTA scene start.
const soundCues = [{ t: 0.3, fn: 'rise' }];
for (const s of scenes.slice(1)) soundCues.push({ t: +s.t0.toFixed(2), fn: s.id === 'cta' ? 'ctaChord' : 'whoosh' });
const doScene = scenes.find(s => s.id === 'do');
soundCues.push({ t: +(doScene.t0 + 1.2).toFixed(2), fn: 'snap' });
soundCues.sort((a, b) => a.t - b.t);

fs.writeFileSync(path.join(root, 'assets/intro-timings.json'), JSON.stringify({ TOTAL, scenes, cues, soundCues }, null, 2));
console.log(`\nTOTAL ${TOTAL}s  →  assets/intro-vo.mp3  +  assets/intro-timings.json`);
console.log('\nSCENES:'); console.log(scenes.map(s => `  ${s.id.padEnd(8)} ${s.t0} → ${s.t1}`).join('\n'));
console.log('\nCUES:'); console.log(cues.map(c => `  ${c.t0}s  [${c.scene}]  ${c.text.slice(0, 54)}`).join('\n'));
console.log('\nSOUND_CUES:'); console.log(soundCues.map(s => `  ${s.t}s  ${s.fn}`).join('\n'));
