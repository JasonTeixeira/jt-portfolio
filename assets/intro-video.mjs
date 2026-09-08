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
  if (cue) { if (caption.textContent !== cue.text) caption.textContent = cue.text; caption.classList.add('show'); }
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
  requestAnimationFrame(tick);
}

function play() {
  if (playing) return;
  if (!useAudio && vclock >= TOTAL) vclock = 0; // replay from end
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
  if (useAudio) audio.pause();
}
function toggle() { playing ? pause() : play(); }
function replay() { if (useAudio) { audio.currentTime = 0; } else { vclock = 0; } render(0); play(); }

// wiring
$('vposter').addEventListener('click', play);
playBtn.addEventListener('click', toggle);
$('vreplay').addEventListener('click', replay);
$('vprogress').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const t = p * duration();
  if (useAudio) audio.currentTime = t; else vclock = t;
  render(t);
});
$('vclose').addEventListener('click', () => {
  pause();
  try { window.parent.postMessage({ type: 'sage-intro-close' }, '*'); } catch { /* ignore */ }
  if (window.top === window.self) { if (history.length > 1) history.back(); else location.href = 'index.html'; }
});
if (useAudio) {
  muteBtn.hidden = false;
  muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? '🔇' : '🔊'; });
  audio.addEventListener('ended', pause);
  audio.addEventListener('timeupdate', () => { if (playing) render(now()); });
}

render(0);
