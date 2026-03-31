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

// --- CANVAS METRICS (9:16 -> 4K) ---
const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1920;
const WIDTH = LOGICAL_WIDTH * 2;
const HEIGHT = LOGICAL_HEIGHT * 2;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// --- STATE ---
let audioCtx = null;
let audioDest = null;
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
    audioDest = audioCtx.createMediaStreamDestination();
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
    gainNode.connect(audioCtx.destination);
    gainNode.connect(audioDest);

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
    gainNode.connect(audioCtx.destination);
    gainNode.connect(audioDest);

    noise.start();
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
  generateArray();

  const videoStream = canvas.captureStream(60);
  const audioStream = audioDest.stream;
  const combined = new MediaStream([...videoStream.getTracks(), ...audioStream.getTracks()]);

  // Chrome 125+ : MP4 natif avec H.264 + AAC (compatible TikTok)
  const mp4Aac = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
  const mp4Any = 'video/mp4';
  const canMP4 = MediaRecorder.isTypeSupported(mp4Aac) || MediaRecorder.isTypeSupported(mp4Any);
  const mimeType = MediaRecorder.isTypeSupported(mp4Aac) ? mp4Aac
    : MediaRecorder.isTypeSupported(mp4Any) ? mp4Any
    : 'video/webm;codecs=vp9';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.start(100);

  isRecording = true;
  startTime = Date.now();

  recBtn.textContent = 'Recording...';
  recBtn.classList.add('recording');
  recBtn.disabled = true;
  recStatus.classList.remove('hidden');

  startBtn.disabled = true;
  activeRunId++;
  await ALGORITHMS[currentAlgoId].run(activeRunId);

  await sleep(1000);
  stopRecording();
}

async function stopRecording() {
  if (!mediaRecorder || !isRecording) return;
  isRecording = false;

  recBtn.textContent = 'Encoding...';
  recBtn.classList.remove('recording');
  recStatus.classList.add('hidden');

  // Attendre que MediaRecorder finisse d'ecrire les chunks
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

  // 1. Clear
  ctx.fillStyle = Theme.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.scale(2, 2); // 4K

  const algo = ALGORITHMS[currentAlgoId];
  if (!algo) {
    ctx.restore();
    return requestAnimationFrame(drawLoop);
  }

  // 2. Title — safe zone: 200px top, 100px sides
  const SAFE_TOP = 200;
  const SAFE_X = 100;
  const contentWidth = LOGICAL_WIDTH - SAFE_X * 2; // 880px

  ctx.fillStyle = Theme.primaryText;
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText(algo.title, LOGICAL_WIDTH / 2, SAFE_TOP);

  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillStyle = Theme.barActive;
  ctx.fillText(`Badges: ${algo.badge}`, LOGICAL_WIDTH / 2, SAFE_TOP + 80);

  ctx.font = '32px Inter, sans-serif';
  ctx.fillStyle = Theme.secondaryText;
  const words = algo.desc.split(' ');
  let line = '';
  let yText = SAFE_TOP + 160;
  for (let i = 0; i < words.length; i++) {
    if (ctx.measureText(line + words[i]).width > contentWidth - 40) {
      ctx.fillText(line, LOGICAL_WIDTH / 2, yText);
      line = words[i] + ' ';
      yText += 42;
    } else line += words[i] + ' ';
  }
  ctx.fillText(line, LOGICAL_WIDTH / 2, yText);

  // 3. Code panel position
  const codeBoxHeight = algo.codeLines.length * 45 + 50;
  const panelY = LOGICAL_HEIGHT - 350 - codeBoxHeight;

  // 4. Bars
  ctx.save();
  const barBaseline = panelY - 50;
  ctx.translate(LOGICAL_WIDTH / 2, barBaseline);

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

  // 5. Code block — respects safe zone margins
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

  ctx.restore();

  // Recording timer
  if (isRecording) {
    recStatus.innerText = `\u25CF REC ${formatTime(Date.now() - startTime)}`;
  }

  requestAnimationFrame(drawLoop);
}

requestAnimationFrame(drawLoop);

// --- ALGORITHMS ---
const ALGORITHMS = {
  anxiety: {
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

      highlightLine(5);
      await sleep(600);
      if (activeRunId !== runId) return;
      arr.forEach(item => { item.state = 'valid'; });
      playNote(1, 'triangle', 0.4, 0.1); playNote(5, 'triangle', 0.4, 0.1); playNote(8, 'triangle', 0.4, 0.1);
      await sleep(1000); highlightLine(null);
    },
  },

  stalin: {
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

        arr[i].state = 'active';
        await sleep(500);

        if (arr[i].value >= maxItem.value) {
          highlightLine(4);
          maxItem.state = 'default';
          maxItem = arr[i];
          maxItem.state = 'valid';
          playNote(maxItem.value, 'triangle', 0.15, 0.1);
          await sleep(600);
        } else {
          highlightLine(5);
          playNoise(0.2, 0.4);
          arr[i].eliminated = true;
          await sleep(800);
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
          highlightLine(6);
          playNoise(0.8, 0.5);
          arr[idx].eliminated = true;
          await sleep(1000);

          highlightLine(7);
          toDestroy--;
        }
      }

      highlightLine(10);
      if (activeRunId !== runId) return;
      playNote(1, 'sine', 1.0, 0.1); playNote(3, 'sine', 1.0, 0.1); playNote(5, 'sine', 1.0, 0.1);
      await sleep(1500); highlightLine(null);
    },
  },

  bogo: {
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
            item.visible = true;
            item.state = 'valid';
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
};

// --- NAVIGATION ---
function loadAlgorithm(id) {
  isAnimating = false;
  startBtn.disabled = false;
  activeRunId++;
  activeLine = null;

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

  document.querySelectorAll('#nav-list button').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-btn-${id}`);
  if (activeBtn) activeBtn.classList.add('active');

  window.location.hash = id;

  numBars = 15;
  generateArray();
}

function renderNav() {
  navList.innerHTML = '';
  for (const [id, algo] of Object.entries(ALGORITHMS)) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.id = `nav-btn-${id}`;
    btn.textContent = algo.title;
    btn.addEventListener('click', () => {
      if (!isRecording) loadAlgorithm(id);
    });
    li.appendChild(btn);
    navList.appendChild(li);
  }
}

async function startCurrentAlgo() {
  if (isAnimating || isRecording) return;
  isAnimating = true;
  startBtn.disabled = true;

  initAudio();
  activeRunId++;
  const runId = activeRunId;

  generateArray();
  await sleep(400);

  await ALGORITHMS[currentAlgoId].run(runId);

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

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !isRecording) {
    e.preventDefault();
    startCurrentAlgo();
  }
  if (e.code === 'KeyR' && !isRecording && !isAnimating) {
    startRecording();
  }
});

// URL hash routing
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
