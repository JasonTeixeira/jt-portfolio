// Controller for the code-native "Welcome to Sage Ideas" intro.
// Drives scene activation + captions off a master clock. The clock is the <audio>
// element's currentTime when a voiceover is present, otherwise a virtual rAF clock so
// the piece plays as a captioned motion sequence today. To add narration: record the
// ~150s VO, save it as assets/intro-vo.mp3, and set VO_SRC below — everything else
// (scene timings, captions, controls, progress) already syncs to it.
const VO_SRC = 'assets/intro-vo.mp3'; // real Jason ElevenLabs narration; '' falls back to the captioned silent cut

// Scene time ranges (seconds) — synced to assets/intro-vo.mp3 (generated line-by-line; see
// scripts/gen-intro-vo.mjs + assets/intro-timings.json). Each scene starts exactly when its line does.
const SCENES = [
  { id: 'hook', t0: 0, t1: 3.126 },
  { id: 'problem', t0: 3.126, t1: 11.706 },
  { id: 'do', t0: 11.706, t1: 21.494 },
  { id: 'who', t0: 21.494, t1: 30.213 },
  { id: 'work', t0: 30.213, t1: 41.766 },
  { id: 'cta', t0: 41.766, t1: 49.804 },
];
const TOTAL = 49.804;

// Caption cues — each t0 is the exact moment the voice begins that line; t1 = next line's start.
const CUES = [
  { t0: 0, t1: 3.126, text: 'Hi — I’m Jason. Welcome to Sage Ideas.' },
  { t0: 3.126, t1: 5.422, text: 'AI is showing up in everything right now.' },
  { t0: 5.422, t1: 11.706, text: 'The trouble is, a lot of it ships on a demo and a prayer — and a customer finds the one thing it gets wrong.' },
  { t0: 11.706, t1: 15.303, text: 'So we build both halves: the AI feature you actually want…' },
  { t0: 15.303, t1: 21.494, text: '…and the proof it works — evals, tests, and gates that turn “trust me” into a number you can see.' },
  { t0: 21.494, t1: 26.252, text: 'I’ve spent thirteen years in software quality, at The Home Depot and in fintech.' },
  { t0: 26.252, t1: 30.213, text: 'Today I build and run two live products entirely on my own.' },
  { t0: 30.213, t1: 37.619, text: 'Teams bring me three kinds of work: LLM & RAG evaluation, test automation & CI, and workflow automation.' },
  { t0: 37.619, t1: 41.766, text: 'We start with a one-week audit — you leave with a plan either way.' },
  { t0: 41.766, t1: 45.085, text: 'If there’s an AI feature you’re not sure about, let’s talk.' },
  { t0: 45.085, t1: 49.804, text: 'Book a free call. I’m Jason — thanks for watching, and welcome to Sage Ideas.' },
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
// Synced to assets/intro-vo.mp3 (49.8s). Whoosh on each scene transition, a crack when the
// feature-card shakes under "demo and a prayer", a snap when the gate flips green, pops as the
// work cards fan in, a chord on the CTA. Kept low so the narration sits on top.
const SOUND_CUES = [
  { t: 0.3, fn: rise },
  { t: 3.126, fn: () => whoosh() },
  { t: 5.0, fn: crack },                                   // feature-card cracks under the "prayer"
  { t: 11.706, fn: () => whoosh() },
  { t: 13.6, fn: snap },                                   // gate flips → ✓ 37/37
  { t: 21.494, fn: () => whoosh() },
  { t: 30.213, fn: () => whoosh() },
  { t: 30.9, fn: () => pop(587) }, { t: 31.1, fn: () => pop(740) }, // work cards fan in
  { t: 41.766, fn: () => whoosh({ dur: 0.7 }) },
  { t: 42.6, fn: () => chord([523.25, 659.25, 783.99, 1046.5], 0.16) }, // CTA
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
// Sound toggle (controls the synthesized sound design + narration)
const SPK_BASE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">';
const SPK_ON = SPK_BASE + '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
const SPK_OFF = SPK_BASE + '<path d="M4 9v6h4l5 4V5L8 9H4z"/><line x1="16" y1="9.5" x2="21" y2="14.5"/><line x1="21" y1="9.5" x2="16" y2="14.5"/></svg>';
muteBtn.hidden = false;
muteBtn.innerHTML = SPK_ON;
muteBtn.setAttribute('aria-label', 'Mute sound');
muteBtn.addEventListener('click', () => {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.85;
  muteBtn.innerHTML = muted ? SPK_OFF : SPK_ON;
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  if (muted) stopSpeech(); else lastSpoken = '';
});
if (useAudio) {
  audio.addEventListener('ended', pause);
  audio.addEventListener('timeupdate', () => { if (playing) render(now()); });
}

render(0);
