import './style.css';

// --- DOM ---
const canvas = document.getElementById('studio-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');
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
let silenceNode = null;
let recVideoTrack = null;
let recAudioDelay = null;
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

  // captureStream(0) = mode manuel : on pousse une frame dans drawLoop
  // exactement au moment du rendu = parfaitement synchro avec le son
  recorderDest = audioCtx.createMediaStreamDestination();
  const videoStream = canvas.captureStream(0);
  recVideoTrack = videoStream.getVideoTracks()[0];
  const combined = new MediaStream([...videoStream.getTracks(), ...recorderDest.stream.getTracks()]);

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

  // Demarrer le recorder
  mediaRecorder.start();

  // Retarder l'audio de ~50ms vers le recorder pour compenser le fait que
  // Web Audio joue instantanement mais la frame video arrive au prochain
  // requestAnimationFrame (~16ms) + encodage (~30ms)
  recAudioDelay = audioCtx.createDelay(0.1);
  recAudioDelay.delayTime.value = 0.05; // 50ms
  masterGain.connect(recAudioDelay);
  recAudioDelay.connect(recorderDest);

  // Silence inaudible pour garder la piste audio vivante
  silenceNode = audioCtx.createOscillator();
  const silenceGain = audioCtx.createGain();
  silenceGain.gain.value = 0.0001;
  silenceNode.connect(silenceGain);
  silenceGain.connect(recAudioDelay);
  silenceNode.start();

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
  if (recAudioDelay) {
    try { masterGain.disconnect(recAudioDelay); } catch {}
    recAudioDelay = null;
  }
  recorderDest = null;
  recVideoTrack = null;

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

// --- TERRITORY WAR: SNAKE-STYLE 4 STRATEGIES ---
const TW_SIZE = 50; // 50x50 grid
const TW_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left

const TW_STRATEGIES = [
  { name: 'Greedy',  desc: 'Nearest empty cell',    color: '#E8985A', eyeColor: '#fff', startCorner: 0 },
  { name: 'Spiral',  desc: 'Clockwise wall-hugger', color: '#3D3D3D', eyeColor: '#fff', startCorner: 1 },
  { name: 'Hunter',  desc: 'Chase nearest enemy',   color: '#5BC5A7', eyeColor: '#fff', startCorner: 2 },
  { name: 'Random',  desc: 'Random walk',           color: '#8B7EC8', eyeColor: '#fff', startCorner: 3 },
];

function twInit() {
  twGrid = new Int8Array(TW_SIZE * TW_SIZE).fill(-1);
  twScores = [0, 0, 0, 0];
  twWinner = null;
  twStep = 0;

  // Corners: TL, TR, BL, BR
  const corners = [[1, 1], [TW_SIZE - 2, 1], [1, TW_SIZE - 2], [TW_SIZE - 2, TW_SIZE - 2]];

  twRunning = true;

  // Snake state for each strategy
  TW_STRATEGIES.forEach((s, i) => {
    const [cx, cy] = corners[i];
    s.headX = cx;
    s.headY = cy;
    s.dir = i; // initial direction varies per corner
    s.alive = true;
    s.trail = [{ x: cx, y: cy }];
    twGrid[cy * TW_SIZE + cx] = i;
    twScores[i] = 1;
  });
}

function twGetCell(x, y) {
  if (x < 0 || x >= TW_SIZE || y < 0 || y >= TW_SIZE) return -2; // wall
  return twGrid[y * TW_SIZE + x];
}

function twMoveGreedy(s) {
  // Find nearest empty cell via BFS, move one step toward it
  const visited = new Set();
  const queue = [{ x: s.headX, y: s.headY, firstDir: -1 }];
  visited.add(s.headY * TW_SIZE + s.headX);

  while (queue.length > 0) {
    const cur = queue.shift();
    for (let d = 0; d < 4; d++) {
      const nx = cur.x + TW_DIRS[d][0];
      const ny = cur.y + TW_DIRS[d][1];
      const key = ny * TW_SIZE + nx;
      if (visited.has(key)) continue;
      visited.add(key);
      const cell = twGetCell(nx, ny);
      if (cell === -2) continue; // wall
      const fd = cur.firstDir === -1 ? d : cur.firstDir;
      if (cell === -1) {
        // Found empty — move in firstDir
        return fd;
      }
      queue.push({ x: nx, y: ny, firstDir: fd });
    }
  }
  return -1; // stuck
}

function twMoveSpiral(s) {
  // Clockwise wall-hugger: try left, then straight, then right, then back
  const leftDir = (s.dir + 3) % 4;
  const rightDir = (s.dir + 1) % 4;
  const backDir = (s.dir + 2) % 4;

  for (const d of [leftDir, s.dir, rightDir, backDir]) {
    const nx = s.headX + TW_DIRS[d][0];
    const ny = s.headY + TW_DIRS[d][1];
    if (twGetCell(nx, ny) === -1) return d;
  }
  return -1;
}

function twMoveHunter(s, idx) {
  // Chase nearest enemy head
  let minDist = Infinity;
  let targetX = s.headX, targetY = s.headY;

  TW_STRATEGIES.forEach((other, i) => {
    if (i === idx || !other.alive) return;
    const dist = Math.abs(other.headX - s.headX) + Math.abs(other.headY - s.headY);
    if (dist < minDist) {
      minDist = dist;
      targetX = other.headX;
      targetY = other.headY;
    }
  });

  // Move toward target, prefer direction that reduces distance most
  let bestDir = -1;
  let bestDist = Infinity;
  for (let d = 0; d < 4; d++) {
    const nx = s.headX + TW_DIRS[d][0];
    const ny = s.headY + TW_DIRS[d][1];
    if (twGetCell(nx, ny) !== -1) continue;
    const dist = Math.abs(targetX - nx) + Math.abs(targetY - ny);
    if (dist < bestDist) { bestDist = dist; bestDir = d; }
  }
  return bestDir;
}

function twMoveRandom(s) {
  const options = [];
  for (let d = 0; d < 4; d++) {
    const nx = s.headX + TW_DIRS[d][0];
    const ny = s.headY + TW_DIRS[d][1];
    if (twGetCell(nx, ny) === -1) options.push(d);
  }
  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : -1;
}

const TW_AI = [twMoveGreedy, twMoveSpiral, twMoveHunter, twMoveRandom];

function twStepOnce() {
  let anyAlive = false;

  TW_STRATEGIES.forEach((s, i) => {
    if (!s.alive) return;

    const dir = TW_AI[i](s, i);
    if (dir === -1) {
      s.alive = false;
      return;
    }

    s.dir = dir;
    s.headX += TW_DIRS[dir][0];
    s.headY += TW_DIRS[dir][1];
    twGrid[s.headY * TW_SIZE + s.headX] = i;
    s.trail.push({ x: s.headX, y: s.headY });
    twScores[i]++;
    anyAlive = true;
  });

  twStep++;
  return anyAlive;
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
    // Pousser cette frame au recorder au moment exact du rendu
    if (recVideoTrack && recVideoTrack.requestFrame) {
      recVideoTrack.requestFrame();
    }
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
      ctx.shadowBlur = item.state === 'default' ? 0 : 8;
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

  ctx.shadowColor = 'rgba(0,0,0,0.05)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
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
    badge: '4 Strategies',
    desc: '4 strategies fight for space on a grid. Each leaves a permanent trail. Who dominates?',
    tiktokDesc: '4 IA s\'affrontent sur une grille. Greedy, Spiral, Hunter ou Random : qui va dominer ? #territorywar #simulation #strategy',
    tiktokTags: '#simulation #strategy #viral #satisfying #coding #algorithm #ai #territory',
    init: twInit,
    draw: function (c) {
      const SAFE_TOP = 130;
      const SAFE_X = 60;

      // Title
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 64px Inter, sans-serif';
      c.fillText('Territory War', WIDTH / 2, SAFE_TOP);

      c.font = '30px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText('4 strategies fight for space', WIDTH / 2, SAFE_TOP + 45);

      if (!twGrid) return;

      // Draw grid — pixel art style
      const gridX = SAFE_X;
      const gridY = SAFE_TOP + 70;
      const gridW = WIDTH - SAFE_X * 2;
      const gridH = gridW; // square grid
      const cellW = gridW / TW_SIZE;
      const cellH = gridH / TW_SIZE;

      // Grid background
      c.fillStyle = Theme.codeBg;
      c.fillRect(gridX, gridY, gridW, gridH);

      // Subtle grid lines
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 0.3;
      for (let x = 0; x <= TW_SIZE; x++) {
        c.beginPath();
        c.moveTo(gridX + x * cellW, gridY);
        c.lineTo(gridX + x * cellW, gridY + gridH);
        c.stroke();
      }
      for (let y = 0; y <= TW_SIZE; y++) {
        c.beginPath();
        c.moveTo(gridX, gridY + y * cellH);
        c.lineTo(gridX + gridW, gridY + y * cellH);
        c.stroke();
      }

      // Draw territories (filled cells)
      for (let y = 0; y < TW_SIZE; y++) {
        for (let x = 0; x < TW_SIZE; x++) {
          const owner = twGrid[y * TW_SIZE + x];
          if (owner < 0) continue;
          c.fillStyle = TW_STRATEGIES[owner].color;
          c.fillRect(gridX + x * cellW + 0.5, gridY + y * cellH + 0.5, cellW - 0.5, cellH - 0.5);
        }
      }

      // Draw creature heads with eyes
      TW_STRATEGIES.forEach((s, i) => {
        if (!s.alive && !s.trail) return;
        const hx = gridX + s.headX * cellW;
        const hy = gridY + s.headY * cellH;
        const size = cellW;

        // Head square (slightly larger)
        c.fillStyle = s.color;
        c.fillRect(hx - 1, hy - 1, size + 2, size + 2);

        // Eyes
        const eyeSize = Math.max(2, size * 0.25);
        const eyeOffX = size * 0.25;
        const eyeOffY = size * 0.3;
        c.fillStyle = s.eyeColor;
        c.fillRect(hx + eyeOffX, hy + eyeOffY, eyeSize, eyeSize);
        c.fillRect(hx + size - eyeOffX - eyeSize, hy + eyeOffY, eyeSize, eyeSize);

        // Pupils
        c.fillStyle = '#111';
        const pupilSize = Math.max(1, eyeSize * 0.5);
        // Pupils look in movement direction
        const dx = TW_DIRS[s.dir][0] * pupilSize * 0.5;
        const dy = TW_DIRS[s.dir][1] * pupilSize * 0.5;
        c.fillRect(hx + eyeOffX + (eyeSize - pupilSize) / 2 + dx, hy + eyeOffY + (eyeSize - pupilSize) / 2 + dy, pupilSize, pupilSize);
        c.fillRect(hx + size - eyeOffX - eyeSize + (eyeSize - pupilSize) / 2 + dx, hy + eyeOffY + (eyeSize - pupilSize) / 2 + dy, pupilSize, pupilSize);
      });

      // Grid border
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      c.strokeRect(gridX, gridY, gridW, gridH);

      // Dashboard — 4 strategy cards
      const dashY = gridY + gridH + 30;
      const dashX = SAFE_X;
      const dashW = WIDTH - SAFE_X * 2;
      const cardH = 70;
      const totalCells = TW_SIZE * TW_SIZE;

      // Sort by score for ranking
      const ranked = TW_STRATEGIES.map((s, i) => ({ ...s, idx: i, score: twScores[i] }))
        .sort((a, b) => b.score - a.score);

      ranked.forEach((s, rank) => {
        const cy = dashY + rank * (cardH + 8);

        // Card background
        c.fillStyle = Theme.codeBg;
        if (c.roundRect) {
          c.beginPath();
          c.roundRect(dashX, cy, dashW, cardH, 12);
          c.fill();
        } else {
          c.fillRect(dashX, cy, dashW, cardH);
        }

        // Creature icon with eyes
        const iconX = dashX + 20;
        const iconY = cy + 15;
        const iconSize = 40;
        c.fillStyle = s.color;
        if (c.roundRect) {
          c.beginPath();
          c.roundRect(iconX, iconY, iconSize, iconSize, 6);
          c.fill();
        } else {
          c.fillRect(iconX, iconY, iconSize, iconSize);
        }
        // Eyes on icon
        c.fillStyle = '#fff';
        c.fillRect(iconX + 8, iconY + 10, 8, 8);
        c.fillRect(iconX + iconSize - 16, iconY + 10, 8, 8);
        c.fillStyle = '#111';
        c.fillRect(iconX + 10, iconY + 12, 4, 4);
        c.fillRect(iconX + iconSize - 14, iconY + 12, 4, 4);

        // Name
        c.fillStyle = Theme.primaryText;
        c.textAlign = 'left';
        c.font = 'bold 28px Inter, sans-serif';
        c.fillText(s.name, iconX + iconSize + 16, cy + 32);

        // Description
        c.fillStyle = Theme.secondaryText;
        c.font = '20px Inter, sans-serif';
        c.fillText(s.desc, iconX + iconSize + 16, cy + 55);

        // Percentage
        const pct = Math.floor((s.score / totalCells) * 100);
        c.fillStyle = Theme.primaryText;
        c.textAlign = 'right';
        c.font = 'bold 32px Inter, sans-serif';
        c.fillText(`${pct}%`, dashX + dashW - 20, cy + 45);
      });

      // Winner banner
      if (twWinner !== null) {
        const w = TW_STRATEGIES[twWinner];
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);

        c.fillStyle = w.color;
        c.textAlign = 'center';
        c.font = 'bold 64px Inter, sans-serif';
        c.fillText(`${w.name} wins!`, WIDTH / 2, HEIGHT / 2 + 5);

        c.fillStyle = '#FFD700';
        c.font = 'bold 36px Inter, sans-serif';
        c.fillText(`${Math.floor((twScores[twWinner] / totalCells) * 100)}% territory`, WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      twInit();
      initAudio();

      while (twStepOnce() && activeRunId === runId) {
        if (twStep % 5 === 0) {
          const leader = twScores.indexOf(Math.max(...twScores));
          playConquer(leader);
        }
        await sleep(40);
      }

      if (activeRunId !== runId) return;

      // Determine winner
      let maxScore = 0;
      let winner = 0;
      twScores.forEach((s, i) => {
        if (s > maxScore) { maxScore = s; winner = i; }
      });
      twWinner = winner;

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
        c.shadowBlur = car.braking ? 6 : 0;
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

  ballescape: {
    type: 'simulation',
    title: 'Ball Escape',
    badge: '1 Exit',
    desc: 'Two balls bounce inside a circle. One tiny exit. First one out wins.',
    tiktokDesc: 'Rouge vs Bleu. Un seul trou. Qui s\'echappe en premier ? #ballescape #simulation #satisfying #versus',
    tiktokTags: '#ballescape #simulation #satisfying #versus #viral #physics #race',
    init: function () {
      const cx = WIDTH / 2, cy = 680, r = 340;
      this._arena = { cx, cy, r };
      this._holeAngle = -Math.PI / 2; // top
      this._holeSize = 0.15; // radians
      this._balls = [
        { x: cx - 80, y: cy, vx: 4, vy: -3, r: 18, color: '#EF4444', name: 'Rouge', escaped: false },
        { x: cx + 80, y: cy, vx: -3, vy: 4, r: 18, color: '#3B82F6', name: 'Bleu', escaped: false },
      ];
      this._winner = null;
      this._step = 0;
    },
    draw: function (c) {
      const SAFE_TOP = 130;
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 64px Inter, sans-serif';
      c.fillText('Ball Escape', WIDTH / 2, SAFE_TOP);
      c.font = '30px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText('First one out wins!', WIDTH / 2, SAFE_TOP + 45);

      if (!this._arena) return;
      const { cx, cy, r } = this._arena;

      // Arena circle (with gap for hole)
      c.strokeStyle = Theme.primaryText;
      c.lineWidth = 6;
      const ha = this._holeAngle;
      const hs = this._holeSize;
      c.beginPath();
      c.arc(cx, cy, r, ha + hs, ha + Math.PI * 2 - hs);
      c.stroke();

      // Hole indicator
      c.strokeStyle = Theme.barValid;
      c.lineWidth = 4;
      c.setLineDash([8, 8]);
      c.beginPath();
      c.arc(cx, cy, r, ha - hs, ha + hs);
      c.stroke();
      c.setLineDash([]);

      // EXIT label
      const ex = cx + Math.cos(ha) * (r + 30);
      const ey = cy + Math.sin(ha) * (r + 30);
      c.fillStyle = Theme.barValid;
      c.font = 'bold 24px Inter, sans-serif';
      c.fillText('EXIT', ex, ey);

      // Balls
      this._balls.forEach(b => {
        if (b.escaped) return;
        c.fillStyle = b.color;
        c.beginPath();
        c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        c.fill();
        // Highlight
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.beginPath();
        c.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
        c.fill();
      });

      // Score panel
      const panelY = cy + r + 60;
      this._balls.forEach((b, i) => {
        const py = panelY + i * 80;
        c.fillStyle = Theme.codeBg;
        if (c.roundRect) { c.beginPath(); c.roundRect(100, py, WIDTH - 200, 65, 12); c.fill(); }
        c.fillStyle = b.color;
        c.beginPath();
        c.arc(135, py + 32, 20, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = Theme.primaryText;
        c.textAlign = 'left';
        c.font = 'bold 30px Inter, sans-serif';
        c.fillText(b.name, 170, py + 40);
        c.textAlign = 'right';
        c.fillText(b.escaped ? 'ESCAPED!' : 'Trapped', WIDTH - 130, py + 40);
      });

      // Winner
      if (this._winner) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);
        c.fillStyle = this._winner.color;
        c.textAlign = 'center';
        c.font = 'bold 64px Inter, sans-serif';
        c.fillText(`${this._winner.name} escapes!`, WIDTH / 2, HEIGHT / 2 + 10);
        c.fillStyle = '#FFD700';
        c.font = 'bold 36px Inter, sans-serif';
        c.fillText(`Step ${this._step}`, WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const { cx, cy, r } = this._arena;
      const balls = this._balls;

      while (activeRunId === runId && !this._winner) {
        this._step++;
        for (const b of balls) {
          if (b.escaped) continue;
          b.x += b.vx;
          b.y += b.vy;

          // Bounce off arena walls
          const dx = b.x - cx, dy = b.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist + b.r > r) {
            const angle = Math.atan2(dy, dx);
            const ha = this._holeAngle;
            const hs = this._holeSize;
            let diff = angle - ha;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) < hs) {
              // Through the hole!
              b.escaped = true;
              if (!this._winner) this._winner = b;
              playNote(15, 'triangle', 0.5, 0.2);
              continue;
            }
            // Reflect
            const nx = dx / dist, ny = dy / dist;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
            b.x = cx + nx * (r - b.r - 1);
            b.y = cy + ny * (r - b.r - 1);
            // Add slight randomness
            b.vx += (Math.random() - 0.5) * 0.5;
            b.vy += (Math.random() - 0.5) * 0.5;
            playNote(Math.floor(Math.random() * 10) + 1, 'sine', 0.03, 0.03);
          }

          // Ball-ball collision
          const other = balls.find(o => o !== b && !o.escaped);
          if (other) {
            const bx = other.x - b.x, by = other.y - b.y;
            const bd = Math.sqrt(bx * bx + by * by);
            if (bd < b.r + other.r) {
              const bnx = bx / bd, bny = by / bd;
              const relV = (b.vx - other.vx) * bnx + (b.vy - other.vy) * bny;
              b.vx -= relV * bnx;
              b.vy -= relV * bny;
              other.vx += relV * bnx;
              other.vy += relV * bny;
              playNote(5, 'square', 0.03, 0.04);
            }
          }

          // Speed limit
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (spd > 6) { b.vx = (b.vx / spd) * 6; b.vy = (b.vy / spd) * 6; }
          if (spd < 2) { b.vx *= 1.1; b.vy *= 1.1; }
        }

        // Slowly rotate hole for extra chaos
        this._holeAngle += 0.003;

        await sleep(16);
      }

      await sleep(3000);
    },
  },

  battleroyale: {
    type: 'simulation',
    title: 'Battle Royale',
    badge: '100 Dots',
    desc: '100 colored dots. Shrinking circle. Collision = elimination. Last dot standing.',
    tiktokDesc: '100 dots entrent. 1 seul survit. Le cercle retrecit. Qui va gagner ? #battleroyale #simulation #100dots',
    tiktokTags: '#battleroyale #simulation #satisfying #viral #100 #elimination #laststanding',
    init: function () {
      const cx = WIDTH / 2, cy = 650;
      this._arena = { cx, cy, r: 380, maxR: 380 };
      this._dots = [];
      const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 300;
        this._dots.push({
          x: cx + Math.cos(a) * d,
          y: cy + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          r: 8,
          color: colors[i % colors.length],
          alive: true,
          id: i + 1,
        });
      }
      this._alive = 100;
      this._step = 0;
      this._winner = null;
    },
    draw: function (c) {
      const SAFE_TOP = 130;
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Battle Royale', WIDTH / 2, SAFE_TOP);
      c.font = 'bold 32px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText(`${this._alive || 0} alive`, WIDTH / 2, SAFE_TOP + 48);

      if (!this._arena) return;
      const { cx, cy, r } = this._arena;

      // Arena
      c.strokeStyle = Theme.barActive;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();

      // Danger zone fill
      c.fillStyle = 'rgba(239, 68, 68, 0.05)';
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();

      // Dots
      if (this._dots) {
        this._dots.forEach(d => {
          if (!d.alive) return;
          c.fillStyle = d.color;
          c.beginPath();
          c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          c.fill();
        });
      }

      // Kill feed (bottom)
      const feedY = cy + this._arena.maxR + 60;
      c.fillStyle = Theme.codeBg;
      if (c.roundRect) { c.beginPath(); c.roundRect(60, feedY, WIDTH - 120, 200, 16); c.fill(); }

      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 28px Inter, sans-serif';
      c.fillText(`Zone: ${Math.floor(r)}px`, WIDTH / 2, feedY + 40);

      // Progress bar
      const barX = 100, barY = feedY + 60, barW = WIDTH - 200, barH = 20;
      c.fillStyle = Theme.codeBorder;
      c.fillRect(barX, barY, barW, barH);
      c.fillStyle = Theme.barActive;
      c.fillRect(barX, barY, barW * (this._alive / 100), barH);

      c.fillStyle = Theme.secondaryText;
      c.font = '24px Inter, sans-serif';
      c.fillText(`${this._alive}/100 remaining`, WIDTH / 2, feedY + 120);

      // Step
      c.fillText(`Step ${this._step}`, WIDTH / 2, feedY + 160);

      // Winner
      if (this._winner) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);
        c.fillStyle = this._winner.color;
        c.textAlign = 'center';
        c.font = 'bold 60px Inter, sans-serif';
        c.fillText(`Dot #${this._winner.id} wins!`, WIDTH / 2, HEIGHT / 2 + 5);
        c.fillStyle = '#FFD700';
        c.font = 'bold 36px Inter, sans-serif';
        c.fillText('VICTORY ROYALE', WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const dots = this._dots;
      const arena = this._arena;

      while (activeRunId === runId && this._alive > 1) {
        this._step++;

        // Shrink zone
        if (arena.r > 50) arena.r -= 0.15;

        for (const d of dots) {
          if (!d.alive) continue;
          d.x += d.vx;
          d.y += d.vy;
          d.vx += (Math.random() - 0.5) * 0.3;
          d.vy += (Math.random() - 0.5) * 0.3;

          // Speed limit
          const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
          if (spd > 4) { d.vx = (d.vx / spd) * 4; d.vy = (d.vy / spd) * 4; }

          // Arena boundary
          const dx = d.x - arena.cx, dy = d.y - arena.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist + d.r > arena.r) {
            // Push inside or kill if zone is too small
            if (arena.r < 60) {
              d.alive = false;
              this._alive--;
              playNoise(0.05, 0.1);
              continue;
            }
            const nx = dx / dist, ny = dy / dist;
            d.x = arena.cx + nx * (arena.r - d.r - 1);
            d.y = arena.cy + ny * (arena.r - d.r - 1);
            d.vx -= nx * 2;
            d.vy -= ny * 2;
          }

          // Collision with others
          for (const other of dots) {
            if (other === d || !other.alive) continue;
            const cx = other.x - d.x, cy = other.y - d.y;
            const cd = Math.sqrt(cx * cx + cy * cy);
            if (cd < d.r + other.r) {
              // Random elimination
              if (Math.random() > 0.5) {
                other.alive = false;
              } else {
                d.alive = false;
              }
              this._alive--;
              playNoise(0.05, 0.08);
              break;
            }
          }
        }

        if (this._step % 30 === 0 && this._alive > 1) {
          playNote(Math.max(1, this._alive % 15), 'sine', 0.05, 0.02);
        }

        await sleep(16);
      }

      // Winner
      const winner = dots.find(d => d.alive);
      if (winner) this._winner = winner;

      playNote(8, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(15, 'triangle', 0.8, 0.15);
      await sleep(3000);
    },
  },

  gameoflife: {
    type: 'simulation',
    title: 'Game of Life',
    badge: 'Cellular',
    desc: 'Conway\'s Game of Life. Simple rules create infinite complexity from nothing.',
    tiktokDesc: '4 regles simples. 0 intelligence. Et pourtant ca cree de la VIE. Conway\'s Game of Life #gameoflife #conway #emergence',
    tiktokTags: '#gameoflife #conway #simulation #satisfying #cellular #emergence #science #viral',
    init: function () {
      this._cols = 80;
      this._rows = 100;
      this._grid = new Uint8Array(this._cols * this._rows);
      // Random seed — ~30% alive
      for (let i = 0; i < this._grid.length; i++) {
        this._grid[i] = Math.random() < 0.3 ? 1 : 0;
      }
      this._gen = 0;
      this._pop = 0;
      this._maxPop = 0;
    },
    draw: function (c) {
      const SAFE_TOP = 130;
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Game of Life', WIDTH / 2, SAFE_TOP);
      c.font = 'bold 28px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText('Simple rules. Infinite complexity.', WIDTH / 2, SAFE_TOP + 42);

      if (!this._grid) return;
      const cols = this._cols, rows = this._rows;
      const SAFE_X = 40;
      const gridY = SAFE_TOP + 65;
      const gridW = WIDTH - SAFE_X * 2;
      const gridH = 1050;
      const cellW = gridW / cols;
      const cellH = gridH / rows;

      // Grid bg
      c.fillStyle = Theme.codeBg;
      c.fillRect(SAFE_X, gridY, gridW, gridH);

      // Alive cells
      let pop = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (this._grid[y * cols + x]) {
            pop++;
            c.fillStyle = Theme.barValid;
            c.fillRect(SAFE_X + x * cellW, gridY + y * cellH, cellW - 0.5, cellH - 0.5);
          }
        }
      }
      this._pop = pop;
      if (pop > this._maxPop) this._maxPop = pop;

      // Border
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      c.strokeRect(SAFE_X, gridY, gridW, gridH);

      // Stats panel
      const panelY = gridY + gridH + 20;
      c.fillStyle = Theme.codeBg;
      if (c.roundRect) { c.beginPath(); c.roundRect(60, panelY, WIDTH - 120, 120, 12); c.fill(); }

      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 30px Inter, sans-serif';
      c.fillText(`Generation ${this._gen}`, WIDTH / 2, panelY + 40);
      c.font = '26px Inter, sans-serif';
      c.fillStyle = Theme.barValid;
      c.fillText(`Population: ${pop}`, WIDTH / 3, panelY + 80);
      c.fillStyle = Theme.secondaryText;
      c.fillText(`Peak: ${this._maxPop}`, (WIDTH / 3) * 2, panelY + 80);
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const cols = this._cols, rows = this._rows;

      for (let gen = 0; gen < 500; gen++) {
        if (activeRunId !== runId) return;
        this._gen = gen;

        // Compute next generation
        const next = new Uint8Array(cols * rows);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + cols) % cols;
                const ny = (y + dy + rows) % rows;
                neighbors += this._grid[ny * cols + nx];
              }
            }
            const alive = this._grid[y * cols + x];
            if (alive && (neighbors === 2 || neighbors === 3)) next[y * cols + x] = 1;
            else if (!alive && neighbors === 3) next[y * cols + x] = 1;
          }
        }
        this._grid = next;

        if (gen % 10 === 0) {
          playNote((this._pop % 12) + 1, 'sine', 0.08, 0.02);
        }

        await sleep(50);
      }

      playNote(8, 'triangle', 0.5, 0.1);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.1);
      await sleep(2000);
    },
  },

  balloon: {
    type: 'simulation',
    title: 'Balloon vs Needles',
    badge: 'Survival',
    desc: 'A balloon bounces in a room. Every few seconds a new spike appears. How long until POP?',
    tiktokDesc: 'Le ballon survit combien de temps ? A chaque seconde un nouveau pic apparait... #balloon #survival #tension #satisfying',
    tiktokTags: '#balloon #survival #simulation #tension #viral #satisfying #pop #howlong',
    init: function () {
      this._balloon = { x: WIDTH / 2, y: 650, vx: 3, vy: -2, r: 30 };
      this._spikes = [];
      this._popped = false;
      this._step = 0;
      this._survivalTime = 0;
      this._roomTop = 250;
      this._roomBot = 1150;
      this._roomLeft = 80;
      this._roomRight = WIDTH - 80;
    },
    draw: function (c) {
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Balloon vs Needles', WIDTH / 2, 140);
      c.font = 'bold 32px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText(`Spikes: ${this._spikes ? this._spikes.length : 0}`, WIDTH / 2, 190);

      if (!this._balloon) return;
      const { _roomTop: rt, _roomBot: rb, _roomLeft: rl, _roomRight: rr } = this;

      // Room
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 3;
      c.strokeRect(rl, rt, rr - rl, rb - rt);

      // Spikes (triangles)
      if (this._spikes) {
        this._spikes.forEach(s => {
          c.fillStyle = Theme.barActive;
          c.beginPath();
          if (s.wall === 'top') { c.moveTo(s.x - 10, rt); c.lineTo(s.x + 10, rt); c.lineTo(s.x, rt + 25); }
          else if (s.wall === 'bottom') { c.moveTo(s.x - 10, rb); c.lineTo(s.x + 10, rb); c.lineTo(s.x, rb - 25); }
          else if (s.wall === 'left') { c.moveTo(rl, s.y - 10); c.lineTo(rl, s.y + 10); c.lineTo(rl + 25, s.y); }
          else { c.moveTo(rr, s.y - 10); c.lineTo(rr, s.y + 10); c.lineTo(rr - 25, s.y); }
          c.closePath();
          c.fill();
        });
      }

      // Balloon
      const b = this._balloon;
      if (!this._popped) {
        c.fillStyle = '#EF4444';
        c.beginPath();
        c.ellipse(b.x, b.y, b.r, b.r * 1.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.beginPath();
        c.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, b.r * 0.4, -0.3, 0, Math.PI * 2);
        c.fill();
        // String
        c.strokeStyle = Theme.secondaryText;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(b.x, b.y + b.r * 1.2);
        c.quadraticCurveTo(b.x + 10, b.y + b.r * 1.6, b.x - 5, b.y + b.r * 2);
        c.stroke();
      }

      // Timer
      const secs = (this._survivalTime / 1000).toFixed(1);
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 80px Inter, sans-serif';
      c.fillText(`${secs}s`, WIDTH / 2, rb + 120);
      c.font = '28px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText('survival time', WIDTH / 2, rb + 160);

      if (this._popped) {
        c.fillStyle = Theme.barActive;
        c.font = 'bold 72px Inter, sans-serif';
        c.fillText('POP!', WIDTH / 2, 700);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const b = this._balloon;
      const { _roomTop: rt, _roomBot: rb, _roomLeft: rl, _roomRight: rr } = this;
      const startMs = Date.now();

      while (activeRunId === runId && !this._popped) {
        this._step++;
        this._survivalTime = Date.now() - startMs;

        // Move balloon
        b.vy += 0.05; // slight gravity
        b.x += b.vx; b.y += b.vy;

        // Bounce off walls
        if (b.x - b.r < rl) { b.x = rl + b.r; b.vx = Math.abs(b.vx); playNote(8, 'sine', 0.03, 0.02); }
        if (b.x + b.r > rr) { b.x = rr - b.r; b.vx = -Math.abs(b.vx); playNote(8, 'sine', 0.03, 0.02); }
        if (b.y - b.r * 1.2 < rt) { b.y = rt + b.r * 1.2; b.vy = Math.abs(b.vy); playNote(10, 'sine', 0.03, 0.02); }
        if (b.y + b.r * 1.2 > rb) { b.y = rb - b.r * 1.2; b.vy = -Math.abs(b.vy) * 0.9; playNote(6, 'sine', 0.03, 0.02); }

        // Add speed wobble
        b.vx += (Math.random() - 0.5) * 0.2;

        // New spike every 60 frames (~1 sec)
        if (this._step % 60 === 0) {
          const walls = ['top', 'bottom', 'left', 'right'];
          const wall = walls[Math.floor(Math.random() * 4)];
          let spike;
          if (wall === 'top' || wall === 'bottom') spike = { wall, x: rl + 30 + Math.random() * (rr - rl - 60) };
          else spike = { wall, y: rt + 30 + Math.random() * (rb - rt - 60) };
          this._spikes.push(spike);
          playNote(2, 'square', 0.05, 0.04);
        }

        // Check spike collision
        for (const s of this._spikes) {
          let sx, sy;
          if (s.wall === 'top') { sx = s.x; sy = rt + 12; }
          else if (s.wall === 'bottom') { sx = s.x; sy = rb - 12; }
          else if (s.wall === 'left') { sx = rl + 12; sy = s.y; }
          else { sx = rr - 12; sy = s.y; }
          const dx = b.x - sx, dy = b.y - sy;
          if (Math.sqrt(dx * dx + dy * dy) < b.r + 8) {
            this._popped = true;
            playNoise(0.5, 0.4);
            break;
          }
        }

        await sleep(16);
      }
      await sleep(3000);
    },
  },

  birthmonth: {
    type: 'simulation',
    title: 'Birth Month Battle',
    badge: '12 Months',
    desc: '12 months fight. Stats randomized each round. Which month survives?',
    tiktokDesc: 'Quel mois de naissance va gagner ? Commente ton mois ! #birthdaymonth #battle #simulation #viral',
    tiktokTags: '#birthday #month #battle #simulation #viral #elimination #horoscope #satisfying',
    init: function () {
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#A855F6', '#14B8A6', '#E11D48'];
      this._months = names.map((n, i) => ({
        name: n, color: colors[i], hp: 100, alive: true,
        power: 30 + Math.floor(Math.random() * 40),
      }));
      this._alive = 12;
      this._round = 0;
      this._log = '';
      this._winner = null;
    },
    draw: function (c) {
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 56px Inter, sans-serif';
      c.fillText('Birth Month Battle', WIDTH / 2, 140);
      c.font = 'bold 30px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText(`Round ${this._round}  |  ${this._alive} alive`, WIDTH / 2, 185);

      if (!this._months) return;

      // Grid of month cards — 3 columns, 4 rows
      const startY = 220;
      const cardW = 280;
      const cardH = 140;
      const gapX = 30;
      const gapY = 16;
      const gridLeft = (WIDTH - (3 * cardW + 2 * gapX)) / 2;

      this._months.forEach((m, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = gridLeft + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        c.globalAlpha = m.alive ? 1 : 0.25;
        c.fillStyle = Theme.codeBg;
        if (c.roundRect) { c.beginPath(); c.roundRect(x, y, cardW, cardH, 12); c.fill(); }

        // Color bar
        c.fillStyle = m.color;
        c.fillRect(x, y, 8, cardH);

        // Name
        c.fillStyle = m.alive ? Theme.primaryText : Theme.secondaryText;
        c.textAlign = 'left';
        c.font = 'bold 32px Inter, sans-serif';
        c.fillText(m.name, x + 20, y + 40);

        // HP bar
        const hpW = cardW - 30;
        const hpH = 16;
        const hpX = x + 20;
        const hpY = y + 55;
        c.fillStyle = Theme.codeBorder;
        c.fillRect(hpX, hpY, hpW, hpH);
        if (m.alive) {
          c.fillStyle = m.hp > 50 ? Theme.barValid : m.hp > 25 ? '#F59E0B' : Theme.barActive;
          c.fillRect(hpX, hpY, hpW * (m.hp / 100), hpH);
        }

        // Stats
        c.fillStyle = Theme.secondaryText;
        c.font = '22px Inter, sans-serif';
        c.fillText(`HP: ${Math.max(0, Math.floor(m.hp))}  PWR: ${m.power}`, x + 20, y + 100);
        if (!m.alive) {
          c.fillStyle = Theme.barActive;
          c.font = 'bold 24px Inter, sans-serif';
          c.fillText('ELIMINATED', x + 20, y + 125);
        }
      });
      c.globalAlpha = 1;

      // Log
      if (this._log) {
        c.fillStyle = Theme.codeBg;
        if (c.roundRect) { c.beginPath(); c.roundRect(60, HEIGHT - 350, WIDTH - 120, 60, 12); c.fill(); }
        c.fillStyle = Theme.primaryText;
        c.textAlign = 'center';
        c.font = '26px Inter, sans-serif';
        c.fillText(this._log, WIDTH / 2, HEIGHT - 312);
      }

      // Winner
      if (this._winner) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);
        c.fillStyle = this._winner.color;
        c.textAlign = 'center';
        c.font = 'bold 72px Inter, sans-serif';
        c.fillText(`${this._winner.name} wins!`, WIDTH / 2, HEIGHT / 2 + 10);
        c.fillStyle = '#FFD700';
        c.font = 'bold 36px Inter, sans-serif';
        c.fillText('CHAMPION', WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();

      while (activeRunId === runId && this._alive > 1) {
        this._round++;
        const alive = this._months.filter(m => m.alive);
        // Pick two random fighters
        const i1 = Math.floor(Math.random() * alive.length);
        let i2 = Math.floor(Math.random() * (alive.length - 1));
        if (i2 >= i1) i2++;
        const a = alive[i1], b = alive[i2];

        // Fight
        const aDmg = a.power * (0.5 + Math.random());
        const bDmg = b.power * (0.5 + Math.random());
        b.hp -= aDmg;
        a.hp -= bDmg;

        this._log = `${a.name} (${Math.floor(aDmg)} dmg) vs ${b.name} (${Math.floor(bDmg)} dmg)`;
        playNote(Math.floor(Math.random() * 12) + 1, 'square', 0.08, 0.04);
        await sleep(600);

        if (b.hp <= 0) { b.alive = false; b.hp = 0; this._alive--; playNoise(0.2, 0.15); this._log = `${b.name} ELIMINATED by ${a.name}!`; }
        if (a.hp <= 0) { a.alive = false; a.hp = 0; this._alive--; playNoise(0.2, 0.15); this._log = `${a.name} ELIMINATED by ${b.name}!`; }

        // Randomize power each round for variety
        alive.forEach(m => { if (m.alive) m.power = 30 + Math.floor(Math.random() * 40); });

        await sleep(800);
      }

      const winner = this._months.find(m => m.alive);
      if (winner) this._winner = winner;
      playNote(8, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.15);
      await sleep(300);
      playNote(15, 'triangle', 0.8, 0.15);
      await sleep(3000);
    },
  },

  holeinone: {
    type: 'simulation',
    title: 'Hole in One',
    badge: 'Near Miss',
    desc: 'A ball launches at a tiny hole. Misses by millimeters. Again and again. Will it ever go in?',
    tiktokDesc: 'Attempt #1... #2... #347... QUAND est-ce que ca rentre ?! #holeinone #nearmiss #satisfying #impossible',
    tiktokTags: '#holeinone #golf #simulation #satisfying #viral #nearmiss #impossible #tension',
    init: function () {
      this._holeX = WIDTH / 2;
      this._holeY = 500;
      this._holeR = 15;
      this._ball = null;
      this._attempt = 0;
      this._success = false;
      this._trail = [];
      this._bestDist = Infinity;
    },
    draw: function (c) {
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Hole in One', WIDTH / 2, 140);

      if (this._attempt === undefined) return;

      c.font = 'bold 40px Inter, sans-serif';
      c.fillStyle = Theme.barActive;
      c.fillText(`Attempt #${this._attempt}`, WIDTH / 2, 195);

      // Play area
      const areaTop = 250;
      const areaBot = 1100;
      c.fillStyle = Theme.codeBg;
      c.fillRect(80, areaTop, WIDTH - 160, areaBot - areaTop);
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      c.strokeRect(80, areaTop, WIDTH - 160, areaBot - areaTop);

      // Hole
      c.fillStyle = '#111';
      c.beginPath();
      c.arc(this._holeX, this._holeY, this._holeR, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = Theme.barValid;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(this._holeX, this._holeY, this._holeR + 5, 0, Math.PI * 2);
      c.stroke();

      // Trail
      if (this._trail.length > 1) {
        c.strokeStyle = 'rgba(239,68,68,0.3)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(this._trail[0].x, this._trail[0].y);
        for (let i = 1; i < this._trail.length; i++) c.lineTo(this._trail[i].x, this._trail[i].y);
        c.stroke();
      }

      // Ball
      if (this._ball) {
        c.fillStyle = '#EF4444';
        c.beginPath();
        c.arc(this._ball.x, this._ball.y, 10, 0, Math.PI * 2);
        c.fill();
      }

      // Stats
      const panelY = areaBot + 30;
      c.fillStyle = Theme.codeBg;
      if (c.roundRect) { c.beginPath(); c.roundRect(80, panelY, WIDTH - 160, 140, 12); c.fill(); }
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 32px Inter, sans-serif';
      const bd = this._bestDist === Infinity ? '---' : `${this._bestDist.toFixed(1)}px`;
      c.fillText(`Best miss: ${bd}`, WIDTH / 2, panelY + 45);
      c.font = '26px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText(`${this._attempt} attempts`, WIDTH / 2, panelY + 85);

      if (this._success) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 80, WIDTH, 160);
        c.fillStyle = '#FFD700';
        c.textAlign = 'center';
        c.font = 'bold 72px Inter, sans-serif';
        c.fillText('HOLE IN ONE!', WIDTH / 2, HEIGHT / 2 + 10);
        c.fillStyle = Theme.barValid;
        c.font = 'bold 36px Inter, sans-serif';
        c.fillText(`After ${this._attempt} attempts`, WIDTH / 2, HEIGHT / 2 + 55);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const maxAttempts = 200;
      // success on a random attempt between 30 and 180
      const successAttempt = 30 + Math.floor(Math.random() * 150);

      for (let a = 1; a <= maxAttempts; a++) {
        if (activeRunId !== runId) return;
        this._attempt = a;
        this._trail = [];

        // Launch from bottom with random angle
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        const speed = 6 + Math.random() * 4;
        this._ball = { x: WIDTH / 2 + (Math.random() - 0.5) * 300, y: 1050, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };

        // If this is THE attempt, aim more accurately
        if (a === successAttempt) {
          const dx = this._holeX - this._ball.x;
          const dy = this._holeY - this._ball.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          this._ball.vx = (dx / d) * speed + (Math.random() - 0.5) * 0.5;
          this._ball.vy = (dy / d) * speed + (Math.random() - 0.5) * 0.5;
        }

        // Simulate ball flight
        for (let t = 0; t < 120; t++) {
          this._ball.x += this._ball.vx;
          this._ball.y += this._ball.vy;
          this._ball.vy += 0.08; // gravity
          this._trail.push({ x: this._ball.x, y: this._ball.y });

          // Bounce off walls
          if (this._ball.x < 90) { this._ball.x = 90; this._ball.vx *= -0.7; }
          if (this._ball.x > WIDTH - 90) { this._ball.x = WIDTH - 90; this._ball.vx *= -0.7; }
          if (this._ball.y < 260) { this._ball.y = 260; this._ball.vy *= -0.7; }
          if (this._ball.y > 1090) { this._ball.y = 1090; this._ball.vy *= -0.7; }

          // Check hole
          const hd = Math.sqrt((this._ball.x - this._holeX) ** 2 + (this._ball.y - this._holeY) ** 2);
          if (hd < this._holeR + 5) {
            this._success = true;
            playNote(15, 'triangle', 0.8, 0.2);
            await sleep(100);
            playNote(12, 'triangle', 0.5, 0.15);
            await sleep(100);
            playNote(8, 'triangle', 0.5, 0.15);
            break;
          }
          if (hd < this._bestDist) this._bestDist = hd;

          await sleep(8);
        }

        if (this._success) break;
        playNote(Math.floor(Math.random() * 5) + 1, 'sine', 0.03, 0.02);
        await sleep(200);
      }

      await sleep(3000);
    },
  },

  forestfire: {
    type: 'simulation',
    title: 'Forest vs Fire',
    badge: 'Nature',
    desc: 'A forest grows peacefully. Then fire starts. Trees vs flames. Who wins?',
    tiktokDesc: 'La foret pousse tranquillement... puis le feu demarre. Qui gagne ? #forest #fire #nature #simulation #tension',
    tiktokTags: '#forest #fire #nature #simulation #viral #satisfying #tension #survival',
    init: function () {
      this._cols = 80;
      this._rows = 80;
      this._grid = new Uint8Array(this._cols * this._rows); // 0=empty, 1=tree, 2=fire, 3=ash
      this._step = 0;
      this._fireStarted = false;
      this._trees = 0;
      this._fires = 0;
    },
    draw: function (c) {
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Forest vs Fire', WIDTH / 2, 140);
      c.font = 'bold 30px Inter, sans-serif';
      c.fillStyle = this._fireStarted ? Theme.barActive : Theme.barValid;
      c.fillText(this._fireStarted ? `Trees: ${this._trees} | Fire: ${this._fires}` : `Growing... Trees: ${this._trees}`, WIDTH / 2, 185);

      if (!this._grid) return;
      const cols = this._cols, rows = this._rows;
      const SAFE_X = 60;
      const gridY = 210;
      const gridW = WIDTH - SAFE_X * 2;
      const gridH = gridW;
      const cellW = gridW / cols;
      const cellH = gridH / rows;

      c.fillStyle = Theme.codeBg;
      c.fillRect(SAFE_X, gridY, gridW, gridH);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = this._grid[y * cols + x];
          if (v === 0) continue;
          if (v === 1) c.fillStyle = '#22C55E';
          else if (v === 2) c.fillStyle = '#EF4444';
          else c.fillStyle = '#6B7280';
          c.fillRect(SAFE_X + x * cellW, gridY + y * cellH, cellW, cellH);
        }
      }

      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      c.strokeRect(SAFE_X, gridY, gridW, gridH);

      // Stats bar at bottom
      const barY = gridY + gridH + 30;
      const barW = gridW;
      const total = cols * rows;
      const treePct = this._trees / total;
      const firePct = this._fires / total;

      c.fillStyle = Theme.codeBg;
      c.fillRect(SAFE_X, barY, barW, 30);
      c.fillStyle = '#22C55E';
      c.fillRect(SAFE_X, barY, barW * treePct, 30);
      c.fillStyle = '#EF4444';
      c.fillRect(SAFE_X + barW * treePct, barY, barW * firePct, 30);

      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = '26px Inter, sans-serif';
      c.fillText(`Step ${this._step}`, WIDTH / 2, barY + 70);

      if (this._fireStarted && this._fires === 0 && this._step > 200) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(0, HEIGHT / 2 - 60, WIDTH, 120);
        c.fillStyle = this._trees > 0 ? '#22C55E' : '#6B7280';
        c.font = 'bold 60px Inter, sans-serif';
        c.fillText(this._trees > 0 ? 'Forest survives!' : 'Everything burned.', WIDTH / 2, HEIGHT / 2 + 15);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const cols = this._cols, rows = this._rows;
      const grid = this._grid;

      // Phase 1: Forest grows for ~150 steps
      for (let s = 0; s < 150; s++) {
        if (activeRunId !== runId) return;
        this._step = s;
        // Random tree growth
        for (let i = 0; i < 20; i++) {
          const x = Math.floor(Math.random() * cols);
          const y = Math.floor(Math.random() * rows);
          if (grid[y * cols + x] === 0) grid[y * cols + x] = 1;
        }
        // Trees spread to neighbors
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (grid[y * cols + x] === 1 && Math.random() < 0.02) {
              const nx = x + Math.floor(Math.random() * 3) - 1;
              const ny = y + Math.floor(Math.random() * 3) - 1;
              if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny * cols + nx] === 0) {
                grid[ny * cols + nx] = 1;
              }
            }
          }
        }
        this._trees = Array.from(grid).filter(v => v === 1).length;
        if (s % 20 === 0) playNote(Math.min(15, Math.floor(this._trees / 200) + 1), 'sine', 0.1, 0.02);
        await sleep(30);
      }

      // Phase 2: FIRE
      this._fireStarted = true;
      // Start fire at a random edge
      const fx = Math.random() < 0.5 ? 0 : cols - 1;
      const fy = Math.floor(Math.random() * rows);
      grid[fy * cols + fx] = 2;
      playNoise(0.3, 0.2);

      // Wind direction (random)
      const windX = (Math.random() - 0.5) * 0.3;
      const windY = (Math.random() - 0.5) * 0.3;

      for (let s = 150; s < 800; s++) {
        if (activeRunId !== runId) return;
        this._step = s;

        // Fire spreads
        const newFires = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (grid[y * cols + x] !== 2) continue;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                if (grid[ny * cols + nx] === 1) {
                  // Wind affects spread probability
                  const prob = 0.05 + (dx * windX + dy * windY > 0 ? 0.1 : 0);
                  if (Math.random() < prob) newFires.push(ny * cols + nx);
                }
              }
            }
            // Fire burns out
            if (Math.random() < 0.03) grid[y * cols + x] = 3;
          }
        }
        newFires.forEach(i => { grid[i] = 2; });

        // Trees regrow slowly
        if (Math.random() < 0.3) {
          const rx = Math.floor(Math.random() * cols);
          const ry = Math.floor(Math.random() * rows);
          if (grid[ry * cols + rx] === 0) grid[ry * cols + rx] = 1;
        }

        this._trees = Array.from(grid).filter(v => v === 1).length;
        this._fires = Array.from(grid).filter(v => v === 2).length;

        if (this._fires === 0 && s > 200) break;

        if (s % 10 === 0 && this._fires > 0) playNote(2, 'square', 0.03, 0.02);
        await sleep(30);
      }

      playNote(8, 'triangle', 0.5, 0.1);
      await sleep(300);
      playNote(12, 'triangle', 0.5, 0.1);
      await sleep(3000);
    },
  },

  lonelydot: {
    type: 'simulation',
    title: 'The Lonely Dot',
    badge: 'Emotional',
    desc: 'One dot separated from the group by a wall. Will it find a way back?',
    tiktokDesc: 'Ce point est tout seul... il essaie de retrouver les autres. Regarde jusqu\'au bout. #lonelydot #emotional #simulation',
    tiktokTags: '#lonely #dot #emotional #simulation #viral #satisfying #wholesome #journey',
    init: function () {
      // Maze-like walls with one guaranteed path
      this._dot = { x: 150, y: 500, targetX: 0, targetY: 0 };
      this._group = [];
      for (let i = 0; i < 15; i++) {
        this._group.push({ x: 800 + (Math.random() - 0.5) * 100, y: 500 + (Math.random() - 0.5) * 100 });
      }
      // Walls with gaps
      this._walls = [
        { x: 400, y: 300, w: 10, h: 250 },
        { x: 400, y: 600, w: 10, h: 250 },
        { x: 600, y: 200, w: 10, h: 300 },
        { x: 600, y: 600, w: 10, h: 300 },
      ];
      this._path = [];
      this._reunited = false;
      this._step = 0;
    },
    draw: function (c) {
      c.fillStyle = Theme.primaryText;
      c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('The Lonely Dot', WIDTH / 2, 140);
      c.font = '28px Inter, sans-serif';
      c.fillStyle = Theme.secondaryText;
      c.fillText('Will it find its way back?', WIDTH / 2, 180);

      if (!this._dot) return;

      // Play area
      const ox = 40, oy = 250, ow = WIDTH - 80, oh = 700;
      c.fillStyle = Theme.codeBg;
      c.fillRect(ox, oy, ow, oh);
      c.strokeStyle = Theme.codeBorder;
      c.lineWidth = 2;
      c.strokeRect(ox, oy, ow, oh);

      // Scale positions to play area
      const sx = (px) => ox + (px / 1000) * ow;
      const sy = (py) => oy + (py / 1000) * oh;
      const sw = (pw) => (pw / 1000) * ow;
      const sh = (ph) => (ph / 1000) * oh;

      // Walls
      this._walls.forEach(w => {
        c.fillStyle = Theme.primaryText;
        c.fillRect(sx(w.x), sy(w.y), sw(w.w), sh(w.h));
      });

      // Trail
      if (this._path.length > 1) {
        c.strokeStyle = 'rgba(96, 165, 250, 0.2)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(sx(this._path[0].x), sy(this._path[0].y));
        for (let i = 1; i < this._path.length; i++) c.lineTo(sx(this._path[i].x), sy(this._path[i].y));
        c.stroke();
      }

      // Group dots
      this._group.forEach(g => {
        c.fillStyle = Theme.barValid;
        c.beginPath();
        c.arc(sx(g.x), sy(g.y), 10, 0, Math.PI * 2);
        c.fill();
      });

      // Lonely dot (bigger, different color)
      c.fillStyle = '#3B82F6';
      c.beginPath();
      c.arc(sx(this._dot.x), sy(this._dot.y), 14, 0, Math.PI * 2);
      c.fill();
      // Sad/happy face
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(sx(this._dot.x) - 4, sy(this._dot.y) - 3, 3, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(sx(this._dot.x) + 4, sy(this._dot.y) - 3, 3, 0, Math.PI * 2);
      c.fill();
      // Mouth
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      if (this._reunited) {
        c.arc(sx(this._dot.x), sy(this._dot.y) + 4, 5, 0, Math.PI);
      } else {
        c.arc(sx(this._dot.x), sy(this._dot.y) + 8, 5, Math.PI, 0);
      }
      c.stroke();

      // Step
      c.fillStyle = Theme.secondaryText;
      c.textAlign = 'center';
      c.font = '24px Inter, sans-serif';
      c.fillText(`Step ${this._step}`, WIDTH / 2, oy + oh + 40);

      // Reunion
      if (this._reunited) {
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(0, HEIGHT / 2 + 200, WIDTH, 100);
        c.fillStyle = '#FFD700';
        c.textAlign = 'center';
        c.font = 'bold 48px Inter, sans-serif';
        c.fillText('Reunited!', WIDTH / 2, HEIGHT / 2 + 265);
      }
    },
    run: async function (runId) {
      this.init();
      initAudio();
      const dot = this._dot;
      const group = this._group;
      const target = { x: group[0].x, y: group[0].y };

      // Path: go right, find gaps in walls, navigate through
      const waypoints = [
        { x: 380, y: 500 },  // approach first wall
        { x: 380, y: 560 },  // go to gap
        { x: 420, y: 560 },  // through gap
        { x: 580, y: 560 },  // approach second wall
        { x: 580, y: 520 },  // go to gap
        { x: 620, y: 520 },  // through gap
        { x: target.x, y: target.y }, // reach group
      ];

      // Add some exploration dead ends for drama
      const fullPath = [
        { x: 380, y: 500 }, { x: 380, y: 350 }, // try top — blocked!
        { x: 380, y: 500 }, { x: 380, y: 800 }, // try bottom — blocked!
        { x: 380, y: 560 }, // find the gap
        { x: 420, y: 560 }, // through!
        { x: 580, y: 560 }, { x: 580, y: 200 }, // try top — blocked!
        { x: 580, y: 520 }, // find gap
        { x: 620, y: 520 }, // through!
        { x: target.x, y: target.y }, // HOME
      ];

      for (const wp of fullPath) {
        if (activeRunId !== runId) return;

        // Move toward waypoint
        while (Math.abs(dot.x - wp.x) > 3 || Math.abs(dot.y - wp.y) > 3) {
          if (activeRunId !== runId) return;
          this._step++;
          const dx = wp.x - dot.x, dy = wp.y - dot.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const speed = 3;
          dot.x += (dx / d) * Math.min(speed, d);
          dot.y += (dy / d) * Math.min(speed, d);
          this._path.push({ x: dot.x, y: dot.y });

          // Group gently sways
          group.forEach(g => {
            g.x += (Math.random() - 0.5) * 0.5;
            g.y += (Math.random() - 0.5) * 0.5;
          });

          if (this._step % 15 === 0) playNote(Math.floor(Math.random() * 5) + 3, 'sine', 0.15, 0.015);
          await sleep(16);
        }

        // Hit a wall? Pause and "think"
        if (wp.y === 350 || wp.y === 800 || wp.y === 200) {
          playNote(2, 'square', 0.1, 0.03);
          await sleep(500);
        }
      }

      // Reunion!
      this._reunited = true;
      playNote(8, 'triangle', 0.6, 0.12);
      await sleep(400);
      playNote(12, 'triangle', 0.6, 0.12);
      await sleep(400);
      playNote(15, 'triangle', 0.8, 0.15);

      // Group gravitates toward dot
      for (let i = 0; i < 60; i++) {
        group.forEach(g => {
          g.x += (dot.x - g.x) * 0.05;
          g.y += (dot.y - g.y) * 0.05;
        });
        await sleep(30);
      }

      await sleep(3000);
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

function updateControlButtons(state) {
  // state: 'idle' | 'running' | 'done'
  if (state === 'idle') {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    restartBtn.disabled = true;
    startBtn.textContent = '\u25B6 Demarrer';
  } else if (state === 'running') {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    restartBtn.disabled = true;
  } else if (state === 'done') {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    restartBtn.disabled = false;
  }
}

async function startCurrentAlgo() {
  if (isAnimating || isRecording) return;
  isAnimating = true;
  updateControlButtons('running');

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
    updateControlButtons('done');
  }
}

function stopCurrentAlgo() {
  if (!isAnimating) return;
  activeRunId++; // invalide le runId en cours → l'algo s'arrete
  isAnimating = false;
  updateControlButtons('done');
}

function restartCurrentAlgo() {
  // Reset state puis relance
  activeRunId++;
  isAnimating = false;
  const algo = ALGORITHMS[currentAlgoId];
  if (algo.type === 'sort') generateArray();
  else if (algo.init) algo.init();
  activeLine = null;
  updateControlButtons('idle');
}

// --- EVENTS ---
stopBtn.addEventListener('click', stopCurrentAlgo);
restartBtn.addEventListener('click', restartCurrentAlgo);
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
