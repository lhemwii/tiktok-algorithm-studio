import './style.css';

// --- DOM ---
const canvas = document.getElementById('studio-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const recBtn = document.getElementById('recBtn');
const recStatus = document.getElementById('rec-status');
const navList = document.getElementById('nav-list');
const themeToggle = document.getElementById('themeToggle');
const metaBox = document.getElementById('tiktok-meta');
const metaDesc = document.getElementById('meta-desc');
const metaTags = document.getElementById('meta-tags');

// --- CANVAS METRICS (9:16 TikTok native) ---
const WIDTH = 1080;
const HEIGHT = 1920;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// --- STATE ---
let audioCtx = null;
let masterGain = null;
let recorderDest = null;
let silenceNode = null; // keeps audio track alive during recording
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let startTime = 0;

let arr = [];
let numBars = 15;
let isAnimating = false;
let currentAlgoId = 'anxiety';
let activeRunId = 0;
let activeLine = null;

// Territory War state
let twGrid = null;
let twRegions = null;
let twRunning = false;
let twScores = null;
let twWinner = null;
let twStep = 0;

const sleep = ms => new Promise(res => setTimeout(res, ms));

const Theme = {
  bg: '#0F172A',
  primaryText: '#F8FAFC',
  secondaryText: '#94A3B8',
  barDefault: '#334155',
  barActive: '#EF4444',
  barValid: '#10B981',
  codeBg: '#1E293B',
  codeBorder: '#334155',
  codeHighlight: 'rgba(239, 68, 68, 0.2)',
  codeText: '#FFFFFF',
  codeTextMuted: '#94A3B8',
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- AUDIO ENGINE ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playNote(val, type = 'sine', duration = 0.1, vol = 0.1) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const baseFreq = 220;
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24, 26, 28, 29];
    const noteIndex = Math.min(val, scale.length) - 1;
    osc.frequency.value = baseFreq * Math.pow(2, scale[noteIndex > 0 ? noteIndex : 0] / 12);
    osc.type = type;
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* silent */ }
}

function playNoise(duration = 0.5, vol = 0.2) {
  if (!audioCtx) return;
  try {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    noise.connect(filter).connect(gainNode);
    gainNode.connect(masterGain);
    noise.start();
  } catch (e) { /* silent */ }
}

function playConquer(regionIdx) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.frequency.value = 150 + regionIdx * 40;
    osc.type = 'square';
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) { /* silent */ }
}

// --- RECORDING ENGINE ---
recBtn.addEventListener('click', () => {
  if (!isRecording) startRecording();
  else stopRecording();
});

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function startRecording() {
  initAudio();

  // Reset simulation state
  const algo = ALGORITHMS[currentAlgoId];
  if (algo.type === 'sort') generateArray();
  else if (algo.type === 'simulation' && algo.init) algo.init();

  // Creer le recorderDest AU MEME MOMENT que le captureStream
  recorderDest = audioCtx.createMediaStreamDestination();
  masterGain.connect(recorderDest);

  // Silence continu inaudible pour garder la piste audio vivante
  // Sans ca, Chrome coupe la piste audio apres quelques secondes de silence
  silenceNode = audioCtx.createOscillator();
  const silenceGain = audioCtx.createGain();
  silenceGain.gain.value = 0.0001; // -80dB, inaudible
  silenceNode.connect(silenceGain);
  silenceGain.connect(masterGain);
  silenceNode.start();

  const videoStream = canvas.captureStream(30);
  const combined = new MediaStream([...videoStream.getTracks(), ...recorderDest.stream.getTracks()]);

  // Forcer H.264 + AAC (compatible TikTok). Opus n'est pas supporte par TikTok.
  const mp4Aac = 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"';
  const mp4Plain = 'video/mp4';
  const mimeType = MediaRecorder.isTypeSupported(mp4Aac) ? mp4Aac
    : MediaRecorder.isTypeSupported(mp4Plain) ? mp4Plain
    : 'video/webm;codecs=vp9';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 128_000 });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };

  isRecording = true;
  startTime = Date.now();

  recBtn.textContent = 'Recording...';
  recBtn.classList.add('recording');
  recBtn.disabled = true;
  recStatus.classList.remove('hidden');
  startBtn.disabled = true;

  // Demarrer le recorder ET l'algo au meme instant — pas de sleep entre les deux
  mediaRecorder.start();
  activeRunId++;
  await algo.run(activeRunId);

  await sleep(1000);
  stopRecording();
}

async function stopRecording() {
  if (!mediaRecorder || !isRecording) return;
  isRecording = false;

  recBtn.textContent = 'Encoding...';
  recBtn.classList.remove('recording');
  recStatus.classList.add('hidden');

  await new Promise(resolve => {
    mediaRecorder.addEventListener('stop', resolve, { once: true });
    setTimeout(resolve, 3000);
    mediaRecorder.stop();
  });

  if (recordedChunks.length > 0) {
    const isMP4 = mediaRecorder.mimeType.includes('mp4');
    const ext = isMP4 ? 'mp4' : 'webm';
    const type = isMP4 ? 'video/mp4' : 'video/webm';
    downloadBlob(new Blob(recordedChunks, { type }), `tiktok_${currentAlgoId}_viral.${ext}`);
  }

  mediaRecorder = null;

  // Arreter le silence et deconnecter le recorderDest
  if (silenceNode) {
    try { silenceNode.stop(); } catch {}
    silenceNode = null;
  }
  if (recorderDest) {
    try { masterGain.disconnect(recorderDest); } catch {}
    recorderDest = null;
  }

  recBtn.textContent = '\u23FA REC';
  recBtn.disabled = false;
  startBtn.disabled = false;
}

// --- DATA ---
function generateArray(count = numBars) {
  arr = [];
  const values = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  values.forEach(val => {
    arr.push({ value: val, state: 'default', eliminated: false, visible: true, yOffset: 0 });
  });
}

function highlightLine(lineNum) { activeLine = lineNum; }

// --- TERRITORY WAR: REGIONS DATA ---
const REGIONS_FR = [
  { name: 'Ile-de-France',          abbr: 'IDF', color: '#E63946', cx: 540, cy: 420 },
  { name: 'Hauts-de-France',        abbr: 'HDF', color: '#F4A261', cx: 520, cy: 250 },
  { name: 'Grand Est',              abbr: 'GES', color: '#E9C46A', cx: 720, cy: 370 },
  { name: 'Normandie',              abbr: 'NOR', color: '#2A9D8F', cx: 340, cy: 330 },
  { name: 'Bretagne',               abbr: 'BRE', color: '#264653', cx: 190, cy: 420 },
  { name: 'Pays de la Loire',       abbr: 'PDL', color: '#A8DADC', cx: 280, cy: 530 },
  { name: 'Centre-Val de Loire',    abbr: 'CVL', color: '#457B9D', cx: 440, cy: 540 },
  { name: 'Bourgogne-Fr.-Comte',    abbr: 'BFC', color: '#F77F00', cx: 660, cy: 530 },
  { name: 'Nouvelle-Aquitaine',     abbr: 'NAQ', color: '#D62828', cx: 350, cy: 720 },
  { name: 'Auvergne-Rhone-Alpes',   abbr: 'ARA', color: '#6A0572', cx: 630, cy: 700 },
  { name: 'Occitanie',              abbr: 'OCC', color: '#1B998B', cx: 430, cy: 870 },
  { name: 'Provence-Alpes-C.A.',    abbr: 'PAC', color: '#FF6B6B', cx: 700, cy: 850 },
  { name: 'Corse',                  abbr: 'COR', color: '#4ECDC4', cx: 810, cy: 920 },
];

const TW_COLS = 120;
const TW_ROWS = 140;

function twInit() {
  twGrid = new Int8Array(TW_COLS * TW_ROWS).fill(-1);
  twScores = new Array(REGIONS_FR.length).fill(0);
  twWinner = null;
  twStep = 0;
  twRunning = true;

  // Seed each region at its capital position
  REGIONS_FR.forEach((r, i) => {
    // Map canvas coords (100-880 x, 200-1000 y area) to grid coords
    const gx = Math.floor(((r.cx - 100) / 780) * TW_COLS);
    const gy = Math.floor(((r.cy - 200) / 800) * TW_ROWS);
    const clampX = Math.max(0, Math.min(TW_COLS - 1, gx));
    const clampY = Math.max(0, Math.min(TW_ROWS - 1, gy));
    twGrid[clampY * TW_COLS + clampX] = i;
    twScores[i] = 1;
  });
}

function twStepOnce() {
  // Expand: each cell tries to claim empty neighbors
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const frontier = [];

  for (let y = 0; y < TW_ROWS; y++) {
    for (let x = 0; x < TW_COLS; x++) {
      const owner = twGrid[y * TW_COLS + x];
      if (owner < 0) continue;
      for (const [ddx, ddy] of dirs) {
        const nx = x + ddx, ny = y + ddy;
        if (nx < 0 || nx >= TW_COLS || ny < 0 || ny >= TW_ROWS) continue;
        const ni = ny * TW_COLS + nx;
        if (twGrid[ni] < 0) {
          frontier.push({ x: nx, y: ny, owner });
        }
      }
    }
  }

  // Shuffle frontier for fairness
  for (let i = frontier.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frontier[i], frontier[j]] = [frontier[j], frontier[i]];
  }

  let claimed = 0;
  for (const f of frontier) {
    const ni = f.y * TW_COLS + f.x;
    if (twGrid[ni] < 0) {
      twGrid[ni] = f.owner;
      twScores[f.owner]++;
      claimed++;
    }
  }

  // Border battles: adjacent cells of different owners fight
  for (let y = 0; y < TW_ROWS; y++) {
    for (let x = 0; x < TW_COLS; x++) {
      const owner = twGrid[y * TW_COLS + x];
      if (owner < 0) continue;
      if (Math.random() > 0.02) continue; // 2% chance of battle per cell per step
      const [ddx, ddy] = dirs[Math.floor(Math.random() * 4)];
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= TW_COLS || ny < 0 || ny >= TW_ROWS) continue;
      const ni = ny * TW_COLS + nx;
      const other = twGrid[ni];
      if (other >= 0 && other !== owner) {
        // Attacker wins
        twGrid[ni] = owner;
        twScores[owner]++;
        twScores[other]--;
      }
    }
  }

  twStep++;
  return claimed > 0 || twStep < 600;
}

// --- RENDER ENGINE (60fps Canvas Loop) ---
function drawLoop() {
  const isDark = document.body.classList.contains('dark-mode');

  Theme.bg = isDark ? '#0F172A' : '#EAE3D9';
  Theme.primaryText = isDark ? '#F8FAFC' : '#1C1C1E';
  Theme.secondaryText = isDark ? '#94A3B8' : '#4A4A4A';
  Theme.barDefault = isDark ? '#334155' : '#FFFFFF';
  Theme.barActive = isDark ? '#EF4444' : '#D97F6B';
  Theme.barValid = isDark ? '#10B981' : '#67A47A';
  Theme.codeBg = isDark ? '#1E293B' : '#FFFFFF';
  Theme.codeBorder = isDark ? '#334155' : '#DDDDDD';
  Theme.codeText = isDark ? '#FFFFFF' : '#1C1C1E';
  Theme.codeTextMuted = isDark ? '#94A3B8' : '#8E908C';
  Theme.codeHighlight = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(217, 127, 107, 0.2)';

  ctx.fillStyle = Theme.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const algo = ALGORITHMS[currentAlgoId];
  if (!algo) return requestAnimationFrame(drawLoop);

  if (algo.type === 'simulation' && algo.draw) {
    algo.draw(ctx);
  } else {
    drawSortView(algo);
  }

  if (isRecording) {
    recStatus.innerText = `\u25CF REC ${formatTime(Date.now() - startTime)}`;
  }

  requestAnimationFrame(drawLoop);
}

function drawSortView(algo) {
  const SAFE_TOP = 200;
  const SAFE_X = 100;
  const contentWidth = WIDTH - SAFE_X * 2;

  ctx.fillStyle = Theme.primaryText;
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText(algo.title, WIDTH / 2, SAFE_TOP);

  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillStyle = Theme.barActive;
  ctx.fillText(`Badges: ${algo.badge}`, WIDTH / 2, SAFE_TOP + 80);

  ctx.font = '32px Inter, sans-serif';
  ctx.fillStyle = Theme.secondaryText;
  const words = algo.desc.split(' ');
  let line = '';
  let yText = SAFE_TOP + 160;
  for (let i = 0; i < words.length; i++) {
    if (ctx.measureText(line + words[i]).width > contentWidth - 40) {
      ctx.fillText(line, WIDTH / 2, yText);
      line = words[i] + ' ';
      yText += 42;
    } else line += words[i] + ' ';
  }
  ctx.fillText(line, WIDTH / 2, yText);

  const codeBoxHeight = algo.codeLines.length * 45 + 50;
  const panelY = HEIGHT - 350 - codeBoxHeight;

  ctx.save();
  const barBaseline = panelY - 50;
  ctx.translate(WIDTH / 2, barBaseline);

  const barWidth = contentWidth / Math.max(20, arr.length) - 5;
  const gap = 5;
  const validBars = arr.filter(i => !i.eliminated);
  const totalW = validBars.length * (barWidth + gap);
  let dx = -totalW / 2;
  const maxSafeHeight = (barBaseline - yText) - 50;

  arr.forEach(item => {
    if (!item.visible) return;
    if (item.eliminated) {
      item.yOffset += 15;
      if (item.yOffset > 2000) item.visible = false;
    }
    const h = (item.value / arr.length) * maxSafeHeight + 20;
    if (item.state === 'active') ctx.fillStyle = Theme.barActive;
    else if (item.state === 'valid') ctx.fillStyle = Theme.barValid;
    else if (item.state === 'gray') ctx.fillStyle = '#777777';
    else ctx.fillStyle = Theme.barDefault;

    if (item.eliminated) {
      ctx.globalAlpha = 0.3;
    } else {
      ctx.globalAlpha = 1;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = item.state === 'default' ? 0 : 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(dx, -h, barWidth, h, [12, 12, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(dx, -h, barWidth, h);
      }
      ctx.shadowBlur = 0;
      dx += barWidth + gap;
    }
  });
  ctx.restore();

  const panelX = SAFE_X;
  const panelWidth = contentWidth;

  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = Theme.codeBg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(panelX, panelY, panelWidth, codeBoxHeight, 20);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = Theme.codeBorder;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, codeBoxHeight, 20);
    ctx.stroke();
  }

  ctx.font = 'bold 28px Fira Code, monospace';
  algo.codeLines.forEach((codeLine, ix) => {
    const isAct = ix + 1 === activeLine;
    if (isAct) {
      ctx.fillStyle = Theme.codeHighlight;
      ctx.fillRect(panelX, panelY + 30 + ix * 45 - 35, panelWidth, 45);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = Theme.codeTextMuted;
    ctx.fillText(`${ix + 1}`, panelX + 50, panelY + 30 + ix * 45);
    ctx.textAlign = 'left';
    ctx.fillStyle = isAct ? Theme.barActive : Theme.codeText;
    ctx.fillText(codeLine, panelX + 80, panelY + 30 + ix * 45);
  });
}

requestAnimationFrame(drawLoop);

// --- ALGORITHMS ---
const ALGORITHMS = {
  // =================== SORTS ===================
  anxiety: {
    type: 'sort',
    title: 'Anxiety Sort',
    badge: 'O(n\u00B2 + check)',
    desc: 'An algorithm that sorts once, then frantically double-checks that everything is perfectly fine.',
    tiktokDesc: 'Sorting is fine, but double-checking it 15 times is better. My code when I deploy to production on Friday night #devlife #coding',
    tiktokTags: '#developer #coding #javascript #programming #computerscience #techhumor #sortalgorithm',
    codeLines: [
      'function anxietySort(arr) {',
      '  arr.sort((a, b) => a - b) // done!',
      '  for (let i = 0; i < arr.length - 1; i++)',
      '    if (arr[i] > arr[i+1]) throw "PANIC!"',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1200);
      if (activeRunId !== runId) return;
      highlightLine(2);
      for (let i = 0; i < arr.length - 1; i++) {
        for (let j = 0; j < arr.length - 1 - i; j++) {
          if (activeRunId !== runId) return;
          arr[j].state = 'active';
          arr[j + 1].state = 'active';
          playNote(arr[j].value, 'sine', 0.1, 0.05);
          await sleep(250);
          if (arr[j].value > arr[j + 1].value) {
            const temp = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = temp;
            playNote(arr[j + 1].value, 'square', 0.1, 0.05);
            await sleep(400);
          } else {
            await sleep(150);
          }
          arr[j].state = 'default';
          arr[j + 1].state = 'default';
        }
      }
      await sleep(1000);
      highlightLine(3); await sleep(600);
      for (let i = 0; i < arr.length; i++) {
        if (activeRunId !== runId) return;
        arr[i].state = 'valid';
        playNote(arr[i].value, 'triangle', 0.15, 0.1);
        if (i < arr.length - 1) highlightLine(4);
        await sleep(250);
        setTimeout(() => { if (arr[i]) arr[i].state = 'default'; }, 300);
      }
      highlightLine(5); await sleep(600);
      if (activeRunId !== runId) return;
      arr.forEach(item => { item.state = 'valid'; });
      playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      await sleep(1000); highlightLine(null);
    },
  },

  stalin: {
    type: 'sort',
    title: 'Stalin Sort',
    badge: 'O(n)',
    desc: 'Iterates through the list. Any element smaller than the previous one is violently eliminated.',
    tiktokDesc: 'The most radical but fastest sorting algorithm in History! Bye bye bugs #tech #coding',
    tiktokTags: '#softwareengineer #codinglife #stalinsort #developer #javascript #algorithm',
    codeLines: [
      'function stalinSort(arr) {',
      '  let max = arr[0];',
      '  return arr.filter(v => {',
      '    if (v >= max) { max = v; return true; }',
      '    return false; // Eliminate!',
      '  });',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1200);
      highlightLine(2);
      let maxItem = arr[0];
      maxItem.state = 'valid';
      playNote(maxItem.value, 'triangle', 0.2, 0.1);
      await sleep(1200);
      for (let i = 1; i < arr.length; i++) {
        if (activeRunId !== runId) return;
        highlightLine(3); await sleep(400);
        arr[i].state = 'active'; await sleep(500);
        if (arr[i].value >= maxItem.value) {
          highlightLine(4);
          maxItem.state = 'default'; maxItem = arr[i]; maxItem.state = 'valid';
          playNote(maxItem.value, 'triangle', 0.15, 0.1); await sleep(600);
        } else {
          highlightLine(5); playNoise(0.2, 0.4);
          arr[i].eliminated = true; await sleep(800);
        }
        if (!arr[i].eliminated) arr[i].state = 'default';
      }
      highlightLine(6); await sleep(600);
      highlightLine(7);
      if (activeRunId !== runId) return;
      arr.forEach(item => { if (!item.eliminated) item.state = 'valid'; });
      playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      await sleep(1000); highlightLine(null);
    },
  },

  thanos: {
    type: 'sort',
    title: 'Thanos Sort',
    badge: 'Perfectly Balanced',
    desc: 'With a snap, 50% of the elements turn to dust. It restores balance to the universe.',
    tiktokDesc: 'As all things should be... When half your database randomly disappears on a Tuesday. #marvel #thanossort',
    tiktokTags: '#webdev #software #thanos #programming #codingcomedy #developer',
    codeLines: [
      'function thanosSort(arr) {',
      '  let toDestroy = Math.floor(arr.length / 2);',
      '  while (toDestroy > 0) {',
      '    let idx = Math.floor(Math.random() * arr.length);',
      '    if (!arr[idx].dust) {',
      '      arr[idx].dust = true;',
      '      toDestroy--;',
      '    }',
      '  }',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1200);
      highlightLine(2); await sleep(1200);
      let toDestroy = Math.floor(arr.length / 2);
      while (toDestroy > 0) {
        if (activeRunId !== runId) return;
        highlightLine(3); await sleep(250);
        highlightLine(4);
        const idx = Math.floor(Math.random() * arr.length);
        highlightLine(5); await sleep(250);
        if (!arr[idx].eliminated) {
          highlightLine(6); playNoise(0.8, 0.5);
          arr[idx].eliminated = true; await sleep(1000);
          highlightLine(7); toDestroy--;
        }
      }
      highlightLine(10);
      if (activeRunId !== runId) return;
      playNote(1, 'sine', 1.0, 0.1); playNote(3, 'sine', 1.0, 0.1); playNote(5, 'sine', 1.0, 0.1);
      await sleep(1500); highlightLine(null);
    },
  },

  bogo: {
    type: 'sort',
    title: 'Bogo Sort',
    badge: 'O((n+1)!)',
    desc: 'Randomly shuffles the array over and over again until magically sorted.',
    tiktokDesc: 'Randomly shuffling the list until it becomes perfectly sorted. Probability: 1 in a Billion. Do you believe in magic? #chaos #bogo',
    tiktokTags: '#softwaredev #coding #bogosort #algorithm #lucky #computerscience',
    codeLines: [
      'function bogoSort(arr) {',
      '  while (!isSorted(arr)) {',
      '    arr.sort(() => Math.random() - 0.5);',
      '  }',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(800);
      let attempts = 0;
      let sorted = false;
      while (!sorted && attempts < 50) {
        if (activeRunId !== runId) return;
        highlightLine(2); await sleep(200);
        let isSorted = true;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i].value > arr[i + 1].value) { isSorted = false; break; }
        }
        if (isSorted) { sorted = true; break; }
        else {
          highlightLine(3); playNoise(0.1, 0.1);
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
          }
          await sleep(200);
        }
        attempts++;
      }
      highlightLine(5);
      if (sorted) {
        arr.forEach(item => { item.state = 'valid'; });
        playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      } else {
        arr.forEach(item => { item.state = 'gray'; });
      }
      await sleep(1000); highlightLine(null);
    },
  },

  sleepsort: {
    type: 'sort',
    title: 'Sleep Sort',
    badge: 'O(Zzz)',
    desc: 'Each element waits its own value in ms before appearing. They sort themselves via time passing!',
    tiktokDesc: 'This algorithm is an absolute genius. It literally uses time to sort your data automatically #sleepsort',
    tiktokTags: '#javascript #webdeveloper #programmingjokes #tech #devlife #coding',
    codeLines: [
      'function sleepSort(arr) {',
      '  arr.forEach(val => {',
      '    setTimeout(() => {',
      '      pushToResult(val);',
      '    }, val * 100);',
      '  });',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(800);
      highlightLine(2); await sleep(400);
      arr.forEach(item => { item.visible = false; });
      highlightLine(3);
      let itemsAdded = 0;
      const promises = arr.map(item => {
        return new Promise(resolve => {
          setTimeout(() => {
            if (activeRunId !== runId) return resolve();
            highlightLine(4);
            item.visible = true; item.state = 'valid';
            playNote(item.value, 'sine', 0.15, 0.1);
            itemsAdded++;
            if (itemsAdded === arr.length) setTimeout(() => resolve(), 500);
            else resolve();
          }, item.value * 200);
        });
      });
      await Promise.all(promises);
      if (activeRunId !== runId) return;
      highlightLine(6); await sleep(500);
      highlightLine(7);
      playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      await sleep(1000); highlightLine(null);
    },
  },

  miracle: {
    type: 'sort',
    title: 'Miracle Sort',
    badge: 'O(???)',
    desc: 'Does absolutely nothing. Hopes that cosmic rays will flip bits in memory and sort the array.',
    tiktokDesc: 'This algorithm literally does NOTHING and waits for a miracle. Still more reliable than my code in production #miraclesort',
    tiktokTags: '#developer #coding #algorithm #miracle #programming #techhumor #faith',
    codeLines: [
      'function miracleSort(arr) {',
      '  while (!isSorted(arr)) {',
      '    // wait for a miracle',
      '  }',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1200);
      // Show "checking" animation several times
      for (let round = 0; round < 8; round++) {
        if (activeRunId !== runId) return;
        highlightLine(2); await sleep(600);

        // Check pass — highlight each bar
        for (let i = 0; i < arr.length; i++) {
          if (activeRunId !== runId) return;
          arr[i].state = 'active';
          playNote(arr[i].value, 'sine', 0.05, 0.03);
          await sleep(100);
          arr[i].state = 'default';
        }

        // Not sorted → wait for miracle
        highlightLine(3); await sleep(800);

        // On last round: "miracle" happens — sort it
        if (round === 7) {
          playNoise(0.3, 0.3);
          await sleep(500);
          arr.sort((a, b) => a.value - b.value);
          arr.forEach(item => { item.state = 'valid'; });
          playNote(1, 'triangle', 0.4, 0.15); playNote(5, 'triangle', 0.4, 0.15); playNote(8, 'triangle', 0.4, 0.15);
        }
      }
      highlightLine(4); await sleep(600);
      highlightLine(5);
      await sleep(1500); highlightLine(null);
    },
  },

  intelligent: {
    type: 'sort',
    title: 'Intelligent Design Sort',
    badge: 'O(1)',
    desc: 'The array is already in the order the universe intended. No sorting needed. It was designed this way.',
    tiktokDesc: 'The array is already perfectly sorted. You just don\'t understand the higher purpose. O(1) complexity. #intelligentdesign',
    tiktokTags: '#coding #algorithm #philosophy #programming #developer #sorted #perfect',
    codeLines: [
      'function intelligentDesignSort(arr) {',
      '  // The array is already sorted.',
      '  // It was designed that way.',
      '  return arr; // Perfect.',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1500);
      if (activeRunId !== runId) return;

      highlightLine(2); await sleep(2000);

      // Dramatic pause — "examine" each element
      for (let i = 0; i < arr.length; i++) {
        if (activeRunId !== runId) return;
        arr[i].state = 'active';
        playNote(arr[i].value, 'sine', 0.2, 0.05);
        await sleep(300);
        arr[i].state = 'valid';
        playNote(arr[i].value, 'triangle', 0.1, 0.08);
        await sleep(200);
      }

      highlightLine(3); await sleep(1500);
      highlightLine(4); await sleep(1000);

      // All "valid" — it was always perfect
      arr.forEach(item => { item.state = 'valid'; });
      playNote(1, 'triangle', 0.6, 0.1); playNote(5, 'triangle', 0.6, 0.1); playNote(8, 'triangle', 0.6, 0.1);
      await sleep(2000);
      highlightLine(5);
      await sleep(1000); highlightLine(null);
    },
  },

  quantum: {
    type: 'sort',
    title: 'Quantum Bogo Sort',
    badge: 'O(n) multiverse',
    desc: 'Destroy all universes where the array is not sorted. You now live in the one where it is.',
    tiktokDesc: 'This algorithm destroys every universe where the array isn\'t sorted. We just happen to be in the right one. #quantumbogo',
    tiktokTags: '#quantum #multiverse #coding #algorithm #physics #programming #developer',
    codeLines: [
      'function quantumBogoSort(arr) {',
      '  if (!isSorted(arr))',
      '    destroyUniverse();',
      '  // If you can read this,',
      '  // the array is sorted.',
      '}',
    ],
    run: async function (runId) {
      highlightLine(1); await sleep(1200);
      if (activeRunId !== runId) return;

      highlightLine(2); await sleep(800);

      // Check — is it sorted?
      let sorted = true;
      for (let i = 0; i < arr.length - 1; i++) {
        if (activeRunId !== runId) return;
        arr[i].state = 'active';
        arr[i + 1].state = 'active';
        playNote(arr[i].value, 'sine', 0.08, 0.05);
        await sleep(200);
        if (arr[i].value > arr[i + 1].value) sorted = false;
        arr[i].state = 'default';
        arr[i + 1].state = 'default';
      }

      if (!sorted) {
        highlightLine(3); await sleep(500);

        // Destroy universe animation — flash + glitch
        for (let flash = 0; flash < 6; flash++) {
          if (activeRunId !== runId) return;
          // Random states
          arr.forEach(item => {
            item.state = Math.random() > 0.5 ? 'active' : 'gray';
          });
          playNoise(0.1, 0.3);
          await sleep(100);
        }

        // Everything eliminated
        arr.forEach(item => { item.eliminated = true; });
        playNoise(0.8, 0.5);
        await sleep(1500);

        // New universe — sorted!
        arr.forEach(item => { item.eliminated = false; item.visible = true; item.yOffset = 0; });
        arr.sort((a, b) => a.value - b.value);
      }

      highlightLine(4); await sleep(800);
      highlightLine(5); await sleep(600);

      // Reveal sorted
      for (let i = 0; i < arr.length; i++) {
        if (activeRunId !== runId) return;
        arr[i].state = 'valid';
        playNote(arr[i].value, 'triangle', 0.15, 0.1);
        await sleep(150);
      }

      highlightLine(6);
      playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      await sleep(2000); highlightLine(null);
    },
  },

  // =================== SIMULATIONS ===================
  territory: {
    type: 'simulation',
    title: 'Territory War',
    badge: '13 Regions',
    desc: 'Les 13 regions de France s\'affrontent. Chacune s\'etend depuis sa capitale. La derniere debout gagne.',
    tiktokDesc: 'Quelle region de France va conquerir toutes les autres ? Commente ta region ! #france #regions #simulation #territorywar',
    tiktokTags: '#france #simulation #viral #regions #guerre #territoire #map #satisfying',
    init: twInit,
    draw: function (c) {
      const SAFE_TOP = 140;
      const SAFE_X = 60;

      // Title
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Territory War : France', WIDTH / 2, SAFE_TOP);

      c.font = 'bold 32px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText('Quelle region va dominer ?', WIDTH / 2, SAFE_TOP + 55);

      if (!twGrid) return;

      // Draw grid
      const gridX = SAFE_X;
      const gridY = SAFE_TOP + 80;
      const gridW = WIDTH - SAFE_X * 2;
      const gridH = 900;
      const cellW = gridW / TW_COLS;
      const cellH = gridH / TW_ROWS;

      for (let y = 0; y < TW_ROWS; y++) {
        for (let x = 0; x < TW_COLS; x++) {
          const owner = twGrid[y * TW_COLS + x];
          if (owner < 0) {
            c.fillStyle = Theme.codeBg;
          } else {
            c.fillStyle = REGIONS_FR[owner].color;
          }
          c.fillRect(gridX + x * cellW, gridY + y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }

      // Grid border
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(gridX, gridY, gridW, gridH, 12);
        c.stroke();
      }

      // Scoreboard
      const scoreY = gridY + gridH + 40;
      const sorted = REGIONS_FR.map((r, i) => ({ ...r, idx: i, score: twScores ? twScores[i] : 0 }))
        .sort((a, b) => b.score - a.score);

      const totalCells = TW_COLS * TW_ROWS;
      const colWidth = (WIDTH - SAFE_X * 2) / 2;

      sorted.forEach((r, rank) => {
        const col = rank < 7 ? 0 : 1;
        const row = rank < 7 ? rank : rank - 7;
        const x = SAFE_X + col * colWidth;
        const y = scoreY + row * 50;
        const pct = totalCells > 0 ? ((r.score / totalCells) * 100).toFixed(1) : '0.0';

        // Color dot
        c.fillStyle = r.color;
        c.beginPath();
        c.arc(x + 15, y + 5, 10, 0, Math.PI * 2);
        c.fill();

        // Rank + name
        c.fillStyle = rank === 0 ? Theme.barActive : Theme.primaryText;
        c.textAlign = 'left';
        c.font = rank === 0 ? 'bold 28px Inter, sans-serif' : '26px Inter, sans-serif';
        c.fillText(`${rank + 1}. ${r.abbr}`, x + 32, y + 12);

        // Percentage
        c.textAlign = 'right';
        c.fillText(`${pct}%`, x + colWidth - 10, y + 12);
      });

      // Step counter
      c.fillStyle = Theme.secondaryText;
      c.textAlign = 'center';
      c.font = '24px Inter, sans-serif';
      c.fillText(`Tour ${twStep}`, WIDTH / 2, HEIGHT - 180);

      // Winner banner
      if (twWinner !== null) {
        const w = REGIONS_FR[twWinner];
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);

        c.fillStyle = w.color;
        c.textAlign = 'center';
        c.font = 'bold 64px Inter, sans-serif';
        c.fillText(`${w.name}`, WIDTH / 2, HEIGHT / 2 - 5);

        c.fillStyle = '#FFD700';
        c.font = 'bold 40px Inter, sans-serif';
        c.fillText('VICTOIRE !', WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      twInit();
      initAudio();

      // Expansion phase
      let expanding = true;
      while (expanding && activeRunId === runId) {
        for (let i = 0; i < 3; i++) {
          expanding = twStepOnce();
          if (!expanding) break;
        }

        // Sound: conquest ticks
        if (twStep % 10 === 0) {
          const leader = twScores.indexOf(Math.max(...twScores));
          playConquer(leader);
        }

        await sleep(30);
      }

      if (activeRunId !== runId) return;

      // Determine winner
      let maxScore = 0;
      let winner = 0;
      twScores.forEach((s, i) => {
        if (s > maxScore) { maxScore = s; winner = i; }
      });
      twWinner = winner;

      // Victory sound
      playNote(8, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(15, 'triangle', 0.8, 0.15);

      await sleep(3000);
    },
  },

  boids: {
    type: 'simulation',
    title: 'Murmuration',
    badge: '3 Rules',
    desc: 'Des centaines d\'oiseaux suivent 3 regles simples. La beaute emerge du chaos.',
    tiktokDesc: 'Comment des centaines d\'oiseaux volent ensemble sans chef ? 3 regles simples = magie pure #murmuration #boids #nature',
    tiktokTags: '#simulation #nature #boids #birds #satisfying #science #viral #emergence',
    init: function () {
      this._flock = [];
      for (let i = 0; i < 200; i++) {
        this._flock.push({
          x: Math.random() * WIDTH,
          y: 300 + Math.random() * 1200,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
        });
      }
      this._step = 0;
      this._predator = null;
    },
    draw: function (c) {
      const SAFE_TOP = 140;
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Murmuration', WIDTH / 2, SAFE_TOP);
      c.font = 'bold 32px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText('3 regles. 200 oiseaux. 0 chef.', WIDTH / 2, SAFE_TOP + 55);

      if (!this._flock) return;

      // Draw birds
      this._flock.forEach(b => {
        const angle = Math.atan2(b.vy, b.vx);
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const alpha = Math.min(1, speed / 3);

        c.save();
        c.translate(b.x, b.y);
        c.rotate(angle);
        c.globalAlpha = 0.6 + alpha * 0.4;
        c.fillStyle = Theme.primaryText;
        c.beginPath();
        c.moveTo(8, 0);
        c.lineTo(-5, -4);
        c.lineTo(-3, 0);
        c.lineTo(-5, 4);
        c.closePath();
        c.fill();
        c.restore();
      });
      c.globalAlpha = 1;

      // Draw predator
      if (this._predator) {
        c.fillStyle = Theme.barActive;
        c.beginPath();
        c.arc(this._predator.x, this._predator.y, 12, 0, Math.PI * 2);
        c.fill();
        c.font = '24px Inter, sans-serif';
        c.fillText('PREDATEUR', this._predator.x, this._predator.y - 20);
      }

      // Rules display
      const rulesY = HEIGHT - 350;
      c.fillStyle = Theme.codeBg;
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(60, rulesY, WIDTH - 120, 160, 16);
        c.fill();
      }
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'left';
      c.font = 'bold 28px Fira Code, monospace';
      c.fillText('1. Separation — evite les voisins', 90, rulesY + 40);
      c.fillText('2. Alignement — meme direction', 90, rulesY + 85);
      c.fillText('3. Cohesion   — reste en groupe', 90, rulesY + 130);

      c.fillStyle = Theme.secondaryText;
      c.textAlign = 'center';
      c.font = '24px Inter, sans-serif';
      c.fillText(`Oiseaux: ${this._flock.length}  |  Tour: ${this._step}`, WIDTH / 2, HEIGHT - 170);
    },
    run: async function (runId) {
      this.init();
      initAudio();

      const flock = this._flock;
      const SPEED_LIMIT = 5;
      const VISUAL_RANGE = 80;
      const SEPARATION_DIST = 25;

      for (let step = 0; step < 900; step++) {
        if (activeRunId !== runId) return;
        this._step = step;

        // Introduce predator at step 300
        if (step === 300) {
          this._predator = { x: WIDTH / 2, y: 800 };
          playNoise(0.3, 0.2);
        }
        if (step > 300 && step < 600 && this._predator) {
          this._predator.x = WIDTH / 2 + Math.sin(step * 0.02) * 300;
          this._predator.y = 700 + Math.cos(step * 0.015) * 200;
        }
        if (step === 600) this._predator = null;

        for (const b of flock) {
          let sepX = 0, sepY = 0;
          let alignX = 0, alignY = 0;
          let cohX = 0, cohY = 0;
          let neighbors = 0;

          for (const other of flock) {
            if (other === b) continue;
            const dx = other.x - b.x;
            const dy = other.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > VISUAL_RANGE) continue;

            neighbors++;
            alignX += other.vx;
            alignY += other.vy;
            cohX += other.x;
            cohY += other.y;

            if (dist < SEPARATION_DIST) {
              sepX -= dx / dist;
              sepY -= dy / dist;
            }
          }

          if (neighbors > 0) {
            alignX = (alignX / neighbors - b.vx) * 0.05;
            alignY = (alignY / neighbors - b.vy) * 0.05;
            cohX = ((cohX / neighbors - b.x) * 0.005);
            cohY = ((cohY / neighbors - b.y) * 0.005);
          }

          b.vx += sepX * 0.4 + alignX + cohX;
          b.vy += sepY * 0.4 + alignY + cohY;

          // Flee predator
          if (this._predator) {
            const pdx = b.x - this._predator.x;
            const pdy = b.y - this._predator.y;
            const pd = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pd < 150) {
              b.vx += (pdx / pd) * 2;
              b.vy += (pdy / pd) * 2;
            }
          }

          // Boundaries — soft turn
          if (b.x < 50) b.vx += 0.5;
          if (b.x > WIDTH - 50) b.vx -= 0.5;
          if (b.y < 250) b.vy += 0.5;
          if (b.y > HEIGHT - 400) b.vy -= 0.5;

          // Speed limit
          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (speed > SPEED_LIMIT) {
            b.vx = (b.vx / speed) * SPEED_LIMIT;
            b.vy = (b.vy / speed) * SPEED_LIMIT;
          }

          b.x += b.vx;
          b.y += b.vy;
        }

        // Ambient sound every 60 steps
        if (step % 60 === 0) {
          playNote(Math.floor(Math.random() * 12) + 1, 'sine', 0.3, 0.02);
        }

        await sleep(16);
      }

      // Ending
      playNote(8, 'triangle', 0.8, 0.1);
      await sleep(400);
      playNote(12, 'triangle', 0.8, 0.1);
      await sleep(2000);
    },
  },

  traffic: {
    type: 'simulation',
    title: 'Phantom Traffic Jam',
    badge: 'Onde de choc',
    desc: 'Un seul frein cree un bouchon fantome. Personne n\'a cause l\'accident.',
    tiktokDesc: 'Pourquoi t\'es dans les bouchons alors qu\'il n\'y a AUCUN accident ? Regarde cette simulation. #embouteillage #trafic #simulation',
    tiktokTags: '#traffic #simulation #satisfying #science #voiture #paris #periph #viral',
    init: function () {
      const N = 40;
      this._cars = [];
      for (let i = 0; i < N; i++) {
        this._cars.push({
          pos: i / N,  // 0-1 around the ring
          speed: 0.002,
          color: Theme.barValid,
          braking: false,
        });
      }
      this._step = 0;
      this._brakeTriggered = false;
    },
    draw: function (c) {
      const SAFE_TOP = 140;
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 52px Inter, sans-serif';
      c.fillText('Phantom Traffic Jam', WIDTH / 2, SAFE_TOP);
      c.font = 'bold 32px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText('0 accident. 1 bouchon.', WIDTH / 2, SAFE_TOP + 55);

      if (!this._cars) return;

      // Draw circular road
      const cx = WIDTH / 2;
      const cy = 750;
      const radius = 320;

      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 50;
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.stroke();

      // Inner road line
      c.strokeStyle = Theme.secondaryText;
      c.lineWidth = 2;
      c.setLineDash([15, 15]);
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);

      // Draw cars
      this._cars.forEach(car => {
        const angle = car.pos * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        c.fillStyle = car.braking ? Theme.barActive : car.color;
        c.shadowColor = car.braking ? Theme.barActive : 'transparent';
        c.shadowBlur = car.braking ? 15 : 0;
        c.beginPath();
        c.arc(x, y, 10, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      });

      // Speed chart
      const chartY = cy + radius + 100;
      const chartH = 200;
      const chartW = WIDTH - 120;

      c.fillStyle = Theme.codeBg;
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(60, chartY, chartW, chartH + 60, 16);
        c.fill();
      }

      c.fillStyle = Theme.secondaryText;
      c.font = '24px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText('Vitesse de chaque voiture', WIDTH / 2, chartY + 30);

      const barW = (chartW - 40) / this._cars.length;
      this._cars.forEach((car, i) => {
        const h = (car.speed / 0.004) * (chartH - 40);
        const bx = 80 + i * barW;
        const by = chartY + chartH + 20 - h;
        c.fillStyle = car.braking ? Theme.barActive : Theme.barValid;
        c.fillRect(bx, by, barW - 2, h);
      });

      // Info
      c.fillStyle = Theme.secondaryText;
      c.textAlign = 'center';
      c.font = '24px Inter, sans-serif';
      c.fillText(`Tour: ${this._step}`, WIDTH / 2, HEIGHT - 170);

      if (this._brakeTriggered && this._step > 100) {
        c.fillStyle = Theme.barActive;
        c.font = 'bold 28px Inter, sans-serif';
        c.fillText('Onde de choc !', WIDTH / 2, HEIGHT - 130);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();

      const cars = this._cars;
      const N = cars.length;

      for (let step = 0; step < 1200; step++) {
        if (activeRunId !== runId) return;
        this._step = step;

        // One car brakes at step 100
        if (step === 100) {
          cars[0].speed = 0.0005;
          cars[0].braking = true;
          this._brakeTriggered = true;
          playNoise(0.2, 0.15);
        }

        // Physics: each car adjusts speed based on car in front
        for (let i = 0; i < N; i++) {
          const car = cars[i];
          const ahead = cars[(i + 1) % N];

          let gap = ahead.pos - car.pos;
          if (gap < 0) gap += 1;

          const safeGap = 1 / N * 1.5;

          if (gap < safeGap) {
            // Too close → brake
            car.speed = Math.max(0.0002, car.speed * 0.95);
            car.braking = true;
          } else {
            // Space → accelerate
            car.speed = Math.min(0.003, car.speed + 0.00005);
            car.braking = car.speed < 0.001;
          }

          car.pos = (car.pos + car.speed) % 1;
        }

        // Sound: tick when braking wave passes
        if (step % 30 === 0 && step > 100) {
          const brakingCount = cars.filter(c => c.braking).length;
          if (brakingCount > 5) {
            playNote(3, 'square', 0.05, 0.02);
          }
        }

        await sleep(16);
      }

      playNote(8, 'triangle', 0.5, 0.1);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.1);
      await sleep(2000);
    },
  },
};

// --- NAVIGATION ---
function loadAlgorithm(id) {
  isAnimating = false;
  startBtn.disabled = false;
  activeRunId++;
  activeLine = null;
  twRunning = false;
  twWinner = null;

  const algo = ALGORITHMS[id];
  if (!algo) return;
  currentAlgoId = id;

  if (algo.tiktokDesc) {
    metaBox.style.display = 'block';
    metaDesc.textContent = algo.tiktokDesc;
    metaTags.textContent = algo.tiktokTags;
  } else {
    metaBox.style.display = 'none';
  }

  document.querySelectorAll('#nav-list button, .nav-category button').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-btn-${id}`);
  if (activeBtn) activeBtn.classList.add('active');

  window.location.hash = id;

  if (algo.type === 'sort') {
    numBars = 15;
    generateArray();
  } else if (algo.init) {
    algo.init();
  }
}

function renderNav() {
  navList.innerHTML = '';

  // Group by type
  const sorts = Object.entries(ALGORITHMS).filter(([, a]) => a.type === 'sort');
  const sims = Object.entries(ALGORITHMS).filter(([, a]) => a.type === 'simulation');

  for (const [id, algo] of sorts) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.id = `nav-btn-${id}`;
    btn.textContent = algo.title;
    btn.addEventListener('click', () => { if (!isRecording) loadAlgorithm(id); });
    li.appendChild(btn);
    navList.appendChild(li);
  }

  // Add simulation category
  if (sims.length > 0) {
    const simHeader = document.createElement('h3');
    simHeader.className = 'category-title';
    simHeader.textContent = 'Simulations';
    simHeader.style.marginTop = '1.5rem';
    navList.parentNode.appendChild(simHeader);

    const simList = document.createElement('ul');
    simList.className = 'nav-category';
    for (const [id, algo] of sims) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.id = `nav-btn-${id}`;
      btn.textContent = algo.title;
      btn.addEventListener('click', () => { if (!isRecording) loadAlgorithm(id); });
      li.appendChild(btn);
      simList.appendChild(li);
    }
    navList.parentNode.appendChild(simList);
  }
}

async function startCurrentAlgo() {
  if (isAnimating || isRecording) return;
  isAnimating = true;
  startBtn.disabled = true;

  initAudio();
  activeRunId++;
  const runId = activeRunId;

  const algo = ALGORITHMS[currentAlgoId];
  if (algo.type === 'sort') {
    generateArray();
  } else if (algo.init) {
    algo.init();
  }
  await sleep(400);

  await algo.run(runId);

  if (activeRunId === runId && !isRecording) {
    isAnimating = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Restart Simulation';
  }
}

// --- EVENTS ---
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  themeToggle.textContent = document.body.classList.contains('dark-mode') ? '\u2600\uFE0F' : '\uD83C\uDF19';
});
startBtn.addEventListener('click', startCurrentAlgo);

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !isRecording) {
    e.preventDefault();
    startCurrentAlgo();
  }
  if (e.code === 'KeyR' && !isRecording && !isAnimating) {
    startRecording();
  }
});

window.addEventListener('hashchange', () => {
  const id = window.location.hash.slice(1);
  if (id && ALGORITHMS[id] && id !== currentAlgoId && !isRecording) {
    loadAlgorithm(id);
  }
});

// --- INIT ---
renderNav();
const initialAlgo = window.location.hash.slice(1);
loadAlgorithm(ALGORITHMS[initialAlgo] ? initialAlgo : 'anxiety');
