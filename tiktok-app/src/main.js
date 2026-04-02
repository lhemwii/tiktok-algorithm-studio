import { TEAMS } from '../../remotion/teams.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// BOUNDARIES
const PITCH_LEFT = 20, PITCH_RIGHT = 430;
const PITCH_TOP = 172, PITCH_BOTTOM = 522;
const GOAL_LEFT = 155, GOAL_RIGHT = 295; // 140px wide net

const STATE = {
  homeScore: 0,
  awayScore: 0,
  phase: 'play', // play, goal_celebration, end
  timerFrames: 0,
  events: [],
  lastTouchTeam: 0,
  touches1: 50,
  touches2: 50,
  ballZoneX: 225,
  ballZoneY: 365,
  ballStuckFrames: 0
};

// UI Elements
const team1ScoreEl = document.getElementById('team1-score');
const team2ScoreEl = document.getElementById('team2-score');
const matchTimerEl = document.getElementById('match-timer');
const matchHalfEl = document.getElementById('match-half');
const actionListEl = document.getElementById('action-list');
const posLabel1 = document.getElementById('pos-team1-label');
const posLabel2 = document.getElementById('pos-team2-label');
const posBar1 = document.getElementById('pos-bar-1');
const posBar2 = document.getElementById('pos-bar-2');

// Setup Teams (Using TEAMS from remotion/teams.js)
const homeTeamInfo = TEAMS['FRA'] || { color: '#002395', altColor: '#ED2939', name: 'FRANCE' };
const awayTeamInfo = TEAMS['SEN'] || { color: '#00853F', altColor: '#EF3340', name: 'SENEGAL' };

// Helpers
function createGradient(c, c1, c2, c3, c4) {
  const g = c.createLinearGradient(0, -20, 0, 20);
  g.addColorStop(0, c1);
  g.addColorStop(0.33, c2);
  g.addColorStop(0.66, c3);
  g.addColorStop(1, c4);
  return g;
}

function updateUI() {
  team1ScoreEl.innerText = STATE.homeScore;
  team2ScoreEl.innerText = STATE.awayScore;
  
  // 65 real seconds = 3900 frames -> 90 game minutes
  const MATCH_FRAMES = 3900;
  let gameMinute = Math.min(90, Math.floor((STATE.timerFrames / MATCH_FRAMES) * 90));
  
  // In game clock format XX:00 (just displaying minutes)
  matchTimerEl.innerText = gameMinute.toString().padStart(2, '0') + ':00';
  
  if (gameMinute >= 45) {
    matchHalfEl.innerText = '2ND HALF';
  }

  // Possession Info (Touch based)
  const totalPos = STATE.touches1 + STATE.touches2;
  const p1Pct = Math.round((STATE.touches1 / totalPos) * 100);
  const p2Pct = 100 - p1Pct;
  posLabel1.innerText = `${homeTeamInfo.name.substring(0,3)} (${p1Pct}%)`;
  posLabel2.innerText = `${awayTeamInfo.name.substring(0,3)} (${p2Pct}%)`;
  posBar1.style.width = `${p1Pct}%`;
  posBar2.style.width = `${p2Pct}%`;
}

function addEvent(type, title, teamName) {
  const icon = type === 'goal' ? '⚽' : '🟨';
  const cssClass = type === 'goal' ? 'goal' : 'yellow-card';
  const gameMinute = Math.floor((STATE.timerFrames / 3900) * 90);
  
  const el = document.createElement('div');
  el.className = `action-item ${cssClass}`;
  el.innerHTML = `
    <span class="act-time">${gameMinute}'</span>
    <span class="act-icon">${icon}</span>
    <div class="act-desc">
      <span class="act-title">${title}</span>
      <span class="act-team">${teamName}</span>
    </div>
  `;
  actionListEl.prepend(el); // add to top
}

// Draw Flag Backgrounds (managed by CSS classes like .bosnia and .italy in HTML)


const ball = { x: WIDTH/2, y: HEIGHT/2, vx: 0, vy: 0, r: 10 };
const players = [];

// Init Players
function resetPositions() {
  players.length = 0;
  const centerY = (PITCH_TOP + PITCH_BOTTOM) / 2;
  
  // Home (Bottom) - Defending Bottom Goal
  players.push({ x: WIDTH/2, y: PITCH_BOTTOM - 20, vx: 0, vy: 0, r: 22, type: 'gk', team: 1, baseColor: homeTeamInfo.color, stuckTime: 0 });
  players.push({ x: 130, y: centerY + 60, vx: 0, vy: 0, r: 19, type: 'field', team: 1, baseColor: homeTeamInfo.color, stuckTime: 0 });
  players.push({ x: 320, y: centerY + 60, vx: 0, vy: 0, r: 19, type: 'field', team: 1, baseColor: homeTeamInfo.color, stuckTime: 0 });
  
  // Away (Top) - Defending Top Goal
  players.push({ x: WIDTH/2, y: PITCH_TOP + 20, vx: 0, vy: 0, r: 22, type: 'gk', team: 2, baseColor: awayTeamInfo.color, stuckTime: 0 });
  players.push({ x: 130, y: centerY - 60, vx: 0, vy: 0, r: 19, type: 'field', team: 2, baseColor: awayTeamInfo.color, stuckTime: 0 });
  players.push({ x: 320, y: centerY - 60, vx: 0, vy: 0, r: 19, type: 'field', team: 2, baseColor: awayTeamInfo.color, stuckTime: 0 });

  // Referee
  players.push({ x: WIDTH/2 - 80, y: centerY, vx: 0, vy: 0, r: 17, type: 'ref', team: 0, baseColor: '#222' });
  
  ball.x = WIDTH/2; ball.y = centerY; ball.vx = 0; ball.vy = 0;
  STATE.ballZoneX = ball.x; STATE.ballZoneY = ball.y; STATE.ballStuckFrames = 0;
}

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function physicsStep() {
  if (STATE.phase === 'end') return;

  // Ball physics
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= 0.98; ball.vy *= 0.98;

  // Ball stuck logic (5 seconds = 300 frames)
  if (dist({x: ball.x, y: ball.y}, {x: STATE.ballZoneX, y: STATE.ballZoneY}) > 50) {
    STATE.ballZoneX = ball.x;
    STATE.ballZoneY = ball.y;
    STATE.ballStuckFrames = 0;
  } else {
    STATE.ballStuckFrames++;
  }

  if (STATE.ballStuckFrames > 300) {
    // Find closest player to yellow card
    let closestP = null; let minDist = 9999;
    for (const p of players) {
      if (p.type === 'field' && !p.hasCard) {
        let d = dist(p, ball);
        if (d < minDist) { minDist = d; closestP = p; }
      }
    }
    if (closestP) {
      closestP.hasCard = true;
      addEvent('card', 'YELLOW CARD (Stalling)', closestP.team === 1 ? homeTeamInfo.name : awayTeamInfo.name);
    }
    STATE.ballStuckFrames = 0;
    ball.vx += (Math.random()-0.5)*25;
    ball.vy += (Math.random()-0.5)*25;
  }

  // Pitch collisions
  if (ball.x - ball.r < PITCH_LEFT) { ball.x = PITCH_LEFT + ball.r; ball.vx *= -1; }
  if (ball.x + ball.r > PITCH_RIGHT) { ball.x = PITCH_RIGHT - ball.r; ball.vx *= -1; }
  
  // Goals logic (stuck inside net)
  if (ball.y < PITCH_TOP) {
    if (ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT) {
      // Goal Top! (Home Team Scored)
      if (STATE.phase === 'play') {
        STATE.homeScore++;
        STATE.phase = 'goal_celebration';
        addEvent('goal', 'GOAL!', homeTeamInfo.name);
        updateUI();
        setTimeout(() => { if(STATE.phase !== 'end') { STATE.phase = 'play'; resetPositions(); } }, 2500);
      }
      // Dead ball effect inside net
      ball.vy *= 0.7; ball.vx *= 0.7;
      if (ball.y < PITCH_TOP - 25) { ball.y = PITCH_TOP - 25; ball.vy *= -0.3; } // back of net
    } else {
      ball.y = PITCH_TOP + ball.r; ball.vy *= -1;
    }
  }
  
  if (ball.y > PITCH_BOTTOM) {
    if (ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT) {
      // Goal Bottom! (Away Team Scored)
      if (STATE.phase === 'play') {
        STATE.awayScore++;
        STATE.phase = 'goal_celebration';
        addEvent('goal', 'GOAL!', awayTeamInfo.name);
        updateUI();
        setTimeout(() => { if(STATE.phase !== 'end') { STATE.phase = 'play'; resetPositions(); } }, 2500);
      }
      ball.vy *= 0.7; ball.vx *= 0.7;
      if (ball.y > PITCH_BOTTOM + 25) { ball.y = PITCH_BOTTOM + 25; ball.vy *= -0.3; } // back of net
    } else {
      ball.y = PITCH_BOTTOM - ball.r; ball.vy *= -1;
    }
  }

  // Player physics and basic AI
  for (const p of players) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.9; p.vy *= 0.9;

    // Boundaries
    if (p.x - p.r < PITCH_LEFT) p.x = PITCH_LEFT + p.r;
    if (p.x + p.r > PITCH_RIGHT) p.x = PITCH_RIGHT - p.r;
    if (p.y - p.r < PITCH_TOP) p.y = PITCH_TOP + p.r;
    if (p.y + p.r > PITCH_BOTTOM) p.y = PITCH_BOTTOM - p.r;

    if (STATE.phase !== 'play') continue;

    // Basic AI - removed old stuck logic since we have new global logic
    if (p.type === 'field') {
      const d = dist(p, ball);
      if (d > 0) {
        const ax = (ball.x - p.x) / d;
        const ay = (ball.y - p.y) / d;
        const speed = p.hasCard ? 0.2 : 0.45;
        p.vx += ax * speed;
        p.vy += ay * speed;
      }
    }

    // GK AI
    if (p.type === 'gk') {
      const targetX = Math.max(GOAL_LEFT+10, Math.min(GOAL_RIGHT-10, ball.x));
      const targetY = p.team === 1 ? HEIGHT - 80 : 80;
      p.vx += (targetX - p.x) * 0.05;
      p.vy += (targetY - p.y) * 0.05;
    }

    // Ref AI
    if (p.type === 'ref') {
      const targetX = ball.x + 80 * Math.cos(STATE.timerFrames * 0.02);
      const targetY = ball.y + 80 * Math.sin(STATE.timerFrames * 0.02);
      p.vx += (targetX - p.x) * 0.02;
      p.vy += (targetY - p.y) * 0.02;
    }

    // Ball Collision
    const db = dist(p, ball);
    if (db < p.r + ball.r) {
      if (p.type !== 'ref') {
         if (p.team === 1) STATE.touches1++;
         else if (p.team === 2) STATE.touches2++;
      }
      
      const nx = (ball.x - p.x) / db;
      const ny = (ball.y - p.y) / db;
      const impulse = 3;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
      p.vx -= nx * impulse * 0.5;
      p.vy -= ny * impulse * 0.5;
    }
  }

  // Player vs Player
  for(let i=0; i<players.length; i++){
    for(let j=i+1; j<players.length; j++){
      const p1 = players[i], p2 = players[j];
      const d = dist(p1, p2);
      if (d < p1.r + p2.r) {
        const nx = (p2.x - p1.x)/d;
        const ny = (p2.y - p1.y)/d;
        const overlap = (p1.r+p2.r)-d;
        p1.x -= nx * overlap*0.5; p1.y -= ny * overlap*0.5;
        p2.x += nx * overlap*0.5; p2.y += ny * overlap*0.5;
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  
  // The Pitch is drawn via HTML/CSS already.
  // We just draw the objects here!

  // Draw Players
  for (const p of players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Smooth shadow matching original code
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    
    // Draw Body with clip for details
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI*2);
    ctx.clip();
    
    if (p.team === 2) {
      ctx.fillStyle = '#00853F'; // SEN green
      ctx.fillRect(-p.r, -p.r, (p.r*2)/3, p.r*2);
      ctx.fillStyle = '#FDEF42'; // SEN yellow
      ctx.fillRect(-p.r + (p.r*2)/3, -p.r, (p.r*2)/3, p.r*2);
      ctx.fillStyle = '#EF3340'; // SEN red
      ctx.fillRect(-p.r + ((p.r*2)/3)*2, -p.r, (p.r*2)/3, p.r*2);
    } else if (p.team === 1) {
      ctx.fillStyle = '#002395'; // FRA blue
      ctx.fillRect(-p.r, -p.r, (p.r*2)/3, p.r*2);
      ctx.fillStyle = '#fff';      // FRA white
      ctx.fillRect(-p.r + (p.r*2)/3, -p.r, (p.r*2)/3, p.r*2);
      ctx.fillStyle = '#ED2939'; // FRA red
      ctx.fillRect(-p.r + ((p.r*2)/3)*2, -p.r, (p.r*2)/3, p.r*2);
    } else {
      ctx.fillStyle = '#131313';
      ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
      if (p.type === 'ref') {
         ctx.fillStyle = '#ffd54a';
         ctx.fillRect(-p.r, -4, p.r*2, 8);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI*2);
    ctx.stroke();

    if (p.type === 'gk') {
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 4, 0, Math.PI*2);
      ctx.stroke();
    }

    // Dynamic eyes
    const eyeAngle = Math.atan2(ball.y - p.y, ball.x - p.x);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-7, -4, 8, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -4, 8, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-7 + Math.cos(eyeAngle)*2.6, -4 + Math.sin(eyeAngle)*2.6, 3.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7 + Math.cos(eyeAngle)*2.6, -4 + Math.sin(eyeAngle)*2.6, 3.4, 0, Math.PI*2); ctx.fill();

    // Yellow Card icon above head
    if (p.hasCard) {
      ctx.fillStyle = '#FFD100';
      ctx.fillRect(-6, -p.r - 20, 12, 16);
      ctx.strokeRect(-6, -p.r - 20, 12, 16);
    }

    ctx.restore();
  }

  // Draw Ball
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  
  // Classic pattern
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(0, 0, ball.r*0.4, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function loop() {
  if (STATE.phase === 'play') {
    STATE.timerFrames++;
    if (STATE.timerFrames >= 3900) {
      STATE.phase = 'end';
      matchTimerEl.innerText = '90:00';
      matchHalfEl.innerText = 'FULL TIME';
    }
  }

  physicsStep();
  draw();
  updateUI();
  
  requestAnimationFrame(loop);
}

// Kickoff
resetPositions();
loop();

// --- VIDEO EXPORT API ---
const renderBtn = document.getElementById('renderBtn');
const renderStatus = document.getElementById('renderStatus');
const renderStatusText = document.getElementById('renderStatusText');
const renderProgressBar = document.getElementById('renderProgressBar');
const renderDownload = document.getElementById('renderDownload');

if (renderBtn) {
  renderBtn.addEventListener('click', async () => {
    // Re-verify team selection if dynamic in the future. Static for now.
    const home = 'FRA';
    const away = 'SEN';
    const seed = 42;

    renderBtn.disabled = true;
    renderBtn.textContent = 'Génération en cours...';
    renderStatus.style.display = 'block';
    renderDownload.style.display = 'none';
    renderProgressBar.style.width = '0%';
    renderStatusText.textContent = 'Bundling Remotion...';

    try {
      // Start render job on composition TikTokWorldCup
      const resp = await fetch('http://localhost:3001/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'TikTokWorldCup',
          props: {
            homeTeam: home,
            awayTeam: away,
            seed
          },
        }),
      });
      const { jobId } = await resp.json();

      // Poll progress
      const poll = setInterval(async () => {
        try {
          const statusResp = await fetch(`http://localhost:3001/api/render/${jobId}`);
          const job = await statusResp.json();

          if (job.status === 'bundling') {
            renderStatusText.textContent = 'Préparation (bundling)...';
          } else if (job.status === 'composing') {
            renderStatusText.textContent = 'Création des images...';
          } else if (job.status === 'rendering') {
            renderProgressBar.style.width = `${job.progress}%`;
            renderStatusText.textContent = `Rendu 4K : ${Math.round(job.progress)}%`;
          } else if (job.status === 'done') {
            clearInterval(poll);
            renderProgressBar.style.width = '100%';
            renderStatusText.textContent = 'Terminé ! ✅';
            renderDownload.href = `http://localhost:3001${job.file}`;
            renderDownload.download = `tiktok_${home}_vs_${away}.mp4`;
            renderDownload.style.display = 'block';
            renderBtn.disabled = false;
            renderBtn.textContent = '🚀 Relancer Vidéo';
          } else if (job.status === 'error') {
            clearInterval(poll);
            renderStatusText.textContent = `Erreur: ${job.error}`;
            renderBtn.disabled = false;
            renderBtn.textContent = '🚀 Réessayer';
          }
        } catch (e) {
          // Keep polling
        }
      }, 1000);
    } catch (e) {
      renderStatusText.textContent = 'Erreur: Serveur local non joignable.';
      renderBtn.disabled = false;
      renderBtn.textContent = '🚀 Réessayer';
    }
  });
}
