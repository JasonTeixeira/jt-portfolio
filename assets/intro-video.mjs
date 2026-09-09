// Controller for the code-native "Welcome to Sage Ideas" intro.
// Drives scene activation + captions off a master clock. The clock is the <audio>
// element's currentTime when a voiceover is present, otherwise a virtual rAF clock so
// the piece plays as a captioned motion sequence today. To add narration: record the
// ~150s VO, save it as assets/intro-vo.mp3, and set VO_SRC below — everything else
// (scene timings, captions, controls, progress) already syncs to it.
const VO_SRC = ''; // e.g. 'assets/intro-vo.mp3' — leave '' for the captioned silent cut

// Scene time ranges (seconds). Keep in sync with the recorded VO if one is added.
const SCENES = [
  { id: 'hook', t0: 0, t1: 8 },
  { id: 'problem', t0: 8, t1: 30 },
  { id: 'do', t0: 30, t1: 62 },
  { id: 'who', t0: 62, t1: 92 },
  { id: 'work', t0: 92, t1: 120 },
  { id: 'cta', t0: 120, t1: 150 },
];
const TOTAL = 150;

// Caption cues — the narration, chunked for readability.
const CUES = [
  { t0: 0, t1: 8, text: 'Hi — I’m Jason. Welcome to Sage Ideas.' },
  { t0: 8, t1: 18, text: 'AI is showing up in everything right now.' },
  { t0: 18, t1: 30, text: 'The trouble is, a lot of it ships on a demo and a prayer — and a customer finds the one thing it gets wrong.' },
  { t0: 30, t1: 44, text: 'So we build both halves: the AI feature you actually want…' },
  { t0: 44, t1: 62, text: '…and the proof it works — evals, tests, and gates that turn “trust me” into a number you can see.' },
  { t0: 62, t1: 78, text: 'I’ve spent thirteen years in software quality, at The Home Depot and in fintech.' },
  { t0: 78, t1: 92, text: 'Today I build and run two live products entirely on my own.' },
  { t0: 92, t1: 106, text: 'Teams bring me three kinds of work: LLM & RAG evaluation, test automation & CI, and workflow automation.' },
  { t0: 106, t1: 120, text: 'We start with a one-week audit — you leave with a plan either way.' },
  { t0: 120, t1: 134, text: 'If there’s an AI feature you’re not sure about, let’s talk.' },
  { t0: 134, t1: 150, text: 'Book a free call. I’m Jason — thanks for watching, and welcome to Sage Ideas.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sound design — subtle synthesized accents (Web Audio, no files) that fire on the
// timeline synced to the visual beats: whooshes on transitions, a snap on the gate,
// pops as things enter, a chord on the CTA. Kept low so the narration sits on top.
// The AudioContext is created on the play click (a user gesture), so autoplay policy
// is satisfied. Everything is guarded — if audio fails, the video plays silently.
// ─────────────────────────────────────────────────────────────────────────────
let actx = null, master = null, noiseBuf = null, muted = false;
function ensureAudio() {
  if (actx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(actx.destination);
    const len = Math.floor(actx.sampleRate);
    noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch { actx = null; }
}
function tone(freq, { type = 'sine', gain = 0.2, a = 0.005, hold = 0.05, r = 0.15, detune = 0 } = {}) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  o.connect(g); g.connect(master);
  const t = actx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + a);
  g.gain.setValueAtTime(gain, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  o.start(t); o.stop(t + a + hold + r + 0.05);
}
function pop(freq = 660) { tone(freq, { type: 'sine', gain: 0.1, a: 0.003, hold: 0.02, r: 0.12 }); }
function chord(freqs, gain = 0.12) { freqs.forEach((f, i) => tone(f, { type: 'sine', gain: gain / freqs.length + 0.03, a: 0.01, hold: 0.28, r: 0.6, detune: i * 3 })); }
function rise() { [392, 523.25, 659.25].forEach((f, i) => setTimeout(() => pop(f), i * 95)); }
function whoosh({ gain = 0.09, dur = 0.5, from = 320, to = 2600 } = {}) {
  if (!actx || !noiseBuf) return;
  const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
  const g = actx.createGain();
  src.connect(bp); bp.connect(g); g.connect(master);
  const t = actx.currentTime;
  bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.start(t); src.stop(t + dur + 0.05);
}
function crack() {
  if (!actx || !noiseBuf) return;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
  const g = actx.createGain();
  src.connect(hp); hp.connect(g); g.connect(master);
  const t = actx.currentTime;
  g.gain.setValueAtTime(0.13, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.start(t); src.stop(t + 0.16);
}
function snap() { crack(); tone(440, { type: 'triangle', gain: 0.2, a: 0.004, hold: 0.02, r: 0.18 }); setTimeout(() => chord([523.25, 659.25, 783.99], 0.15), 55); }
// ── voice narration (browser Speech Synthesis — free, no files) ──
// Reads each caption line as its scene comes up. Robotic vs a real recording, but it's
// an actual voice now. To swap for a premium voice, drop assets/intro-vo.mp3 + set VO_SRC.
let ttsVoice = null, lastSpoken = '';
const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
function pickVoice() {
  if (!hasTTS) return;
  try {
    const vs = window.speechSynthesis.getVoices();
    const pref = ['Google US English', 'Samantha', 'Google UK English Male', 'Daniel', 'Alex', 'Microsoft Aria', 'Microsoft Guy'];
    ttsVoice = vs.find((v) => /^en/i.test(v.lang) && pref.some((p) => v.name.includes(p)))
      || vs.find((v) => /en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  } catch { /* ignore */ }
}
if (hasTTS) { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!hasTTS || muted || useAudio || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text.replace(/[—…]/g, ' '));
    if (!ttsVoice) pickVoice();
    if (ttsVoice) u.voice = ttsVoice;
    u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
function stopSpeech() { if (hasTTS) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } } }
function maybeSpeak(text) { if (playing && !muted && text && text !== lastSpoken) { lastSpoken = text; speak(text); } }
const SOUND_CUES = [
  { t: 0.3, fn: rise },
  { t: 8, fn: () => whoosh() },
  { t: 9.1, fn: () => pop(880) },
  { t: 9.9, fn: crack },
  { t: 30, fn: () => whoosh() },
  { t: 30.2, fn: () => pop(523) }, { t: 30.6, fn: () => pop(659) },
  { t: 31.9, fn: snap },
  { t: 62, fn: () => whoosh() },
  { t: 63.7, fn: () => pop(587) }, { t: 63.95, fn: () => pop(740) },
  { t: 92, fn: () => whoosh() },
  { t: 92.2, fn: () => pop(494) }, { t: 92.4, fn: () => pop(587) }, { t: 92.6, fn: () => pop(698) },
  { t: 93.7, fn: () => chord([440, 554, 659], 0.1) },
  { t: 120, fn: () => whoosh({ dur: 0.7 }) },
  { t: 120.9, fn: () => chord([523.25, 659.25, 783.99, 1046.5], 0.16) },
];
let soundPtr = 0;
function fireSound(t) {
  if (!actx || muted) return;
  while (soundPtr < SOUND_CUES.length && SOUND_CUES[soundPtr].t <= t) { try { SOUND_CUES[soundPtr].fn(); } catch { /* ignore */ } soundPtr++; }
}
function seekSound(t) { soundPtr = 0; while (soundPtr < SOUND_CUES.length && SOUND_CUES[soundPtr].t <= t) soundPtr++; }

const $ = (id) => document.getElementById(id);
const stage = $('vstage');
const audio = $('vaudio');
const caption = $('vcaption');
const bar = $('vbar');
const timeEl = $('vtime');
const playBtn = $('vplay');
const muteBtn = $('vmute');
const sceneEls = [...document.querySelectorAll('.scene')];

let playing = false;
let vclock = 0;          // virtual clock (seconds) when no audio
let lastRaf = 0;
const useAudio = !!VO_SRC;
if (useAudio) { audio.src = VO_SRC; }

function now() { return useAudio ? (audio.currentTime || 0) : vclock; }
function duration() { return useAudio && audio.duration ? audio.duration : TOTAL; }

function fmt(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function render(t) {
  const active = SCENES.find((s) => t >= s.t0 && t < s.t1) || SCENES[SCENES.length - 1];
  for (const el of sceneEls) {
    const on = el.dataset.scene === active.id;
    if (on !== el.classList.contains('active')) {
      el.classList.toggle('active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
  }
  const cue = CUES.find((c) => t >= c.t0 && t < c.t1);
  if (cue) { if (caption.textContent !== cue.text) caption.textContent = cue.text; caption.classList.add('show'); maybeSpeak(cue.text); }
  else caption.classList.remove('show');
  const dur = duration();
  bar.style.width = `${Math.min(100, (t / dur) * 100)}%`;
  timeEl.textContent = `${fmt(t)} / ${fmt(dur)}`;
}

function tick(ts) {
  if (!playing) return;
  if (!useAudio) {
    if (lastRaf) vclock += (ts - lastRaf) / 1000;
    lastRaf = ts;
    if (vclock >= TOTAL) { vclock = TOTAL; render(TOTAL); pause(); return; }
  }
  render(now());
  fireSound(now());
  requestAnimationFrame(tick);
}

function play() {
  if (playing) return;
  if (!useAudio && vclock >= TOTAL) { vclock = 0; seekSound(0); } // replay from end
  ensureAudio();
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  lastSpoken = '';
  playing = true;
  stage.classList.add('started');
  playBtn.textContent = '❚❚';
  lastRaf = 0;
  if (useAudio) { audio.play().catch(() => {}); }
  requestAnimationFrame(tick);
}
function pause() {
  playing = false;
  playBtn.textContent = '▶';
  stopSpeech();
  if (useAudio) audio.pause();
}
function toggle() { playing ? pause() : play(); }
function replay() { stopSpeech(); lastSpoken = ''; if (useAudio) { audio.currentTime = 0; } else { vclock = 0; } seekSound(0); render(0); play(); }

// wiring
$('vposter').addEventListener('click', play);
playBtn.addEventListener('click', toggle);
$('vreplay').addEventListener('click', replay);
$('vprogress').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const t = p * duration();
  if (useAudio) audio.currentTime = t; else vclock = t;
  seekSound(t); stopSpeech(); lastSpoken = '';
  render(t);
});
$('vclose').addEventListener('click', () => {
  pause();
  try { window.parent.postMessage({ type: 'sage-intro-close' }, '*'); } catch { /* ignore */ }
  if (window.top === window.self) { if (history.length > 1) history.back(); else location.href = 'index.html'; }
});
// Sound toggle (controls the synthesized sound design)
muteBtn.hidden = false;
muteBtn.textContent = '🔊';
muteBtn.setAttribute('aria-label', 'Mute sound');
muteBtn.addEventListener('click', () => {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.85;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (muted) stopSpeech(); else lastSpoken = '';
});
if (useAudio) {
  audio.addEventListener('ended', pause);
  audio.addEventListener('timeupdate', () => { if (playing) render(now()); });
}

render(0);
