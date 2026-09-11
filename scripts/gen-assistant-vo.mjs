// gen-assistant-vo.mjs — regenerate the ASSISTANT voice (concierge + site narration) in a single
// warm ElevenLabs voice (Lauren), same engine as Jason's founder VOs, then loudness-normalize the
// WHOLE voice library (assistant + Jason VOs) to one target so nothing jumps between pages.
//
// Two roles, kept distinct (copy unchanged, third-person assistant):
//   • Jason (MJdPGZVWOz3O2iOT7cx5) — intro-vo + svc-*-vo (already his voice; only re-normalized here)
//   • Assistant (Lauren)          — assets/concierge/{en,es,pt}/* + assets/narration/en/*  (regenerated)
//
// Reversible: originals are committed in git; restore with `git checkout -- assets/...`.
// Usage: node scripts/gen-assistant-vo.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DRY = process.argv.includes('--dry');

const ENV = '/Users/Sage/code/active/sageideas.dev/.env.local';
let KEY = process.env.ELEVENLABS_API_KEY;
try { for (const l of fs.readFileSync(ENV, 'utf8').split('\n')) { const m = l.match(/^ELEVENLABS_API_KEY=(.*)$/); if (m) KEY = m[1].replace(/^["']|["']$/g, ''); } } catch { /* env optional */ }
if (!KEY) { console.error('no ELEVENLABS_API_KEY'); process.exit(1); }

const ASSISTANT_VOICE = 'DODLEQrClDo8wCz460ld'; // Lauren — warm, conversational, american
const MODEL = 'eleven_multilingual_v2';
// One loudness target for the whole library (speech-on-web standard).
const LOUDNORM = 'loudnorm=I=-16:TP=-1.5:LRA=11';

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scratchpad/voice-manifest.json'), 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
const tmp = path.join(root, 'scratchpad/_vo_tmp'); fs.mkdirSync(tmp, { recursive: true });

async function tts(text, outRaw) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ASSISTANT_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12, use_speaker_boost: true } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(outRaw, Buffer.from(await res.arrayBuffer()));
}

// normalize any mp3 in place → mono 44.1k, single-pass loudnorm to the shared target
function normalizeInPlace(absPath) {
  const t = path.join(tmp, 'norm-' + path.basename(absPath));
  execSync(`ffmpeg -y -i ${q(absPath)} -ac 1 -ar 44100 -af "${LOUDNORM}" -c:a libmp3lame -q:a 3 ${q(t)}`, { stdio: 'ignore' });
  fs.copyFileSync(t, absPath); fs.rmSync(t, { force: true });
}

(async () => {
  console.log(`ASSISTANT regen: ${manifest.length} clips → Lauren (${ASSISTANT_VOICE}), ${MODEL}`);
  let done = 0, failed = 0;
  for (const it of manifest) {
    const abs = path.join(root, it.out);
    if (DRY) { console.log(`  [dry] ${it.out}  (${it.text.length} chars)`); done++; continue; }
    try {
      const raw = path.join(tmp, 'raw-' + it.out.replace(/[\/]/g, '_'));
      await tts(it.text, raw);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      execSync(`ffmpeg -y -i ${q(raw)} -ac 1 -ar 44100 -af "${LOUDNORM}" -c:a libmp3lame -q:a 3 ${q(abs)}`, { stdio: 'ignore' });
      fs.rmSync(raw, { force: true });
      done++;
      if (done % 10 === 0) console.log(`  …${done}/${manifest.length}`);
    } catch (e) { failed++; console.error(`  ✗ ${it.out}: ${e.message}`); }
  }
  console.log(`assistant clips: ${done} ok, ${failed} failed`);

  // Re-normalize Jason's existing founder VOs to the SAME target (his voice, unchanged — levels matched).
  if (!DRY) {
    const jason = fs.readdirSync(path.join(root, 'assets')).filter((f) => /-vo\.mp3$/.test(f)).map((f) => 'assets/' + f);
    console.log(`normalizing ${jason.length} Jason founder VOs to the shared target…`);
    let jn = 0;
    for (const rel of jason) { try { normalizeInPlace(path.join(root, rel)); jn++; } catch (e) { console.error(`  ✗ ${rel}: ${e.message}`); } }
    console.log(`Jason VOs normalized: ${jn}/${jason.length}`);
  }
  console.log('DONE');
})();
