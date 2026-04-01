import { useCurrentFrame, useVideoConfig, Audio, Sequence } from 'remotion';
import { useCallback, useEffect, useRef } from 'react';

// --- CONSTANTS ---
const W = 1080, H = 1920; // logical size
const SCALE = 2; // 4K

const TEAMS = [
  { name: 'BOSNIA', shortName: 'BOS', color: '#002395', altColor: '#FFC107', score: 0, fouls: 0 },
  { name: 'ITALY', shortName: 'ITA', color: '#008C45', altColor: '#CE2B37', score: 0, fouls: 0 },
];

// --- SIMULATION STATE (deterministic, seeded) ---
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createState(seed) {
  const rand = seededRandom(seed);
  const px = 60, py = 320, pw = W - 120, ph = 650;
  const midX = px + pw / 2, midY = py + ph / 2;
  const goalW = 55, goalH = 280;
  const gTop = midY - goalH / 2, gBot = midY + goalH / 2;
  const PR = 22;

  const teams = TEAMS.map(t => ({ ...t }));
  const players = [
    { x: px + 35, y: midY, vx: 0, vy: 0, r: PR, team: 0, role: 'gk' },
    { x: midX - 130, y: midY - 90, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: midX - 130, y: midY + 90, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: px + pw - 35, y: midY, vx: 0, vy: 0, r: PR, team: 1, role: 'gk' },
    { x: midX + 130, y: midY - 90, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
    { x: midX + 130, y: midY + 90, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
  ];
  const referee = { x: midX, y: midY + 50, vx: 0, vy: 0, r: 16 };
  const ball = { x: midX, y: midY, vx: 0, vy: 0, r: 12 };
  const goalLog = [];
  let stuckTimer = 0;
  let lastBallX = midX, lastBallY = midY;
  let foulFlash = 0;
  let goalFlash = 0;
  let kickoff = true;
  let kickoffTimer = 30; // frames

  return {
    rand, px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot,
    teams, players, referee, ball, goalLog,
    stuckTimer, lastBallX, lastBallY, foulFlash, goalFlash,
    kickoff, kickoffTimer, timerFrames: 0, totalFrames: 30 * 65,
  };
}

function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < a.r + b.r && dist > 0) {
    const nx = dx / dist, ny = dy / dist;
    const relV = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (relV > 0) {
      const mA = a.r * a.r, mB = b.r * b.r, tot = mA + mB;
      a.vx -= relV * nx * (2 * mB / tot); a.vy -= relV * ny * (2 * mB / tot);
      b.vx += relV * nx * (2 * mA / tot); b.vy += relV * ny * (2 * mA / tot);
      const ov = (a.r + b.r - dist) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      return true;
    }
  }
  return false;
}

function bounceRect(b, state) {
  const { px, py, pw, ph, gTop, gBot } = state;
  if (b.y - b.r < py) { b.y = py + b.r; b.vy = Math.abs(b.vy); }
  if (b.y + b.r > py + ph) { b.y = py + ph - b.r; b.vy = -Math.abs(b.vy); }
  if (b.x - b.r < px) {
    if (!(b.y > gTop && b.y < gBot)) { b.x = px + b.r; b.vx = Math.abs(b.vx); }
  }
  if (b.x + b.r > px + pw) {
    if (!(b.y > gTop && b.y < gBot)) { b.x = px + pw - b.r; b.vx = -Math.abs(b.vx); }
  }
}

function resetPositions(state) {
  const { px, pw, midX, midY, players, ball, referee } = state;
  ball.x = midX; ball.y = midY; ball.vx = 0; ball.vy = 0;
  players[0].x = px + 35; players[0].y = midY;
  players[1].x = midX - 130; players[1].y = midY - 90;
  players[2].x = midX - 130; players[2].y = midY + 90;
  players[3].x = px + pw - 35; players[3].y = midY;
  players[4].x = midX + 130; players[4].y = midY - 90;
  players[5].x = midX + 130; players[5].y = midY + 90;
  players.forEach(p => { p.vx = 0; p.vy = 0; });
  referee.x = midX; referee.y = midY + 50; referee.vx = 0; referee.vy = 0;
}

function stepSimulation(state) {
  const { rand, px, pw, midX, midY, gTop, gBot, players, ball, referee, teams, goalLog } = state;

  if (state.kickoff) {
    state.kickoffTimer--;
    if (state.kickoffTimer <= 0) {
      state.kickoff = false;
      ball.vx = (rand() - 0.5) * 3;
      ball.vy = (rand() - 0.5) * 3;
    }
    state.timerFrames++;
    return;
  }

  state.timerFrames++;
  const timerSecs = 90 * (1 - state.timerFrames / state.totalFrames);

  // AI
  players.forEach(pl => {
    const oppGoalX = pl.team === 0 ? px + pw : px;
    const ownGoalX = pl.team === 0 ? px : px + pw;
    let tx, ty;

    if (pl.role === 'gk') {
      tx = ownGoalX + (pl.team === 0 ? 35 : -35);
      ty = midY + (ball.y - midY) * 0.7;
      ty = Math.max(gTop + 20, Math.min(gBot - 20, ty));
      if (Math.abs(ball.x - ownGoalX) < 150) { tx = ball.x; ty = ball.y; }
    } else {
      const gdx = oppGoalX - ball.x, gdy = midY - ball.y;
      const gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      tx = ball.x - (gdx / gd) * (ball.r + pl.r + 8);
      ty = ball.y - (gdy / gd) * (ball.r + pl.r + 8);
      const dist = Math.sqrt((pl.x - ball.x) ** 2 + (pl.y - ball.y) ** 2);
      if (dist < 60) { tx = ball.x + (gdx / gd) * 10; ty = ball.y + (gdy / gd) * 10; }
      const nearCorner = (pl.x < px + 40 || pl.x > px + pw - 40) && (pl.y < gTop - 40 || pl.y > gBot + 40);
      if (nearCorner) { tx = midX + (rand() - 0.5) * 100; ty = midY + (rand() - 0.5) * 100; }
    }

    const dx = tx - pl.x, dy = ty - pl.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    pl.vx += (dx / d) * 0.6; pl.vy += (dy / d) * 0.6;
    pl.vx += (rand() - 0.5) * 0.2; pl.vy += (rand() - 0.5) * 0.2;
    pl.vx *= 0.93; pl.vy *= 0.93;
    const ms = pl.role === 'gk' ? 6 : 8;
    const sp = Math.sqrt(pl.vx * pl.vx + pl.vy * pl.vy);
    if (sp > ms) { pl.vx = (pl.vx / sp) * ms; pl.vy = (pl.vy / sp) * ms; }
    pl.x += pl.vx; pl.y += pl.vy;
  });

  // Referee
  const rtx = ball.x + (ball.x > midX ? -50 : 50);
  const rty = ball.y + 35;
  const rdx = rtx - referee.x, rdy = rty - referee.y, rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
  referee.vx += (rdx / rd) * 0.2; referee.vy += (rdy / rd) * 0.2;
  referee.vx *= 0.94; referee.vy *= 0.94;
  referee.x += referee.vx; referee.y += referee.vy;
  bounceRect(referee, state);

  // Stuck detection
  const bmd = Math.sqrt((ball.x - state.lastBallX) ** 2 + (ball.y - state.lastBallY) ** 2);
  if (bmd < ball.r) { state.stuckTimer++; } else { state.stuckTimer = 0; state.lastBallX = ball.x; state.lastBallY = ball.y; }
  if (state.stuckTimer >= 60) { // 2 seconds at 30fps
    state.foulFlash = 45;
    const attackTeam = ball.x < midX ? 0 : 1;
    teams[attackTeam === 0 ? 1 : 0].fouls++;
    ball.vx = (midX - ball.x) * 0.05 + (rand() - 0.5) * 6;
    ball.vy = (midY - ball.y) * 0.05 + (rand() - 0.5) * 6;
    players.forEach(pl => {
      if (pl.team !== attackTeam) {
        pl.x = pl.team === 0 ? px + pw / 4 : px + pw * 3 / 4;
        pl.y = midY + (rand() - 0.5) * 200;
        pl.vx = 0; pl.vy = 0;
      }
    });
    state.stuckTimer = 0;
    state.lastBallX = ball.x; state.lastBallY = ball.y;
  }

  // Ball physics
  ball.vx *= 0.997; ball.vy *= 0.997;
  ball.x += ball.vx; ball.y += ball.vy;
  bounceRect(ball, state);
  players.forEach(pl => { bounceRect(pl, state); collide(pl, ball); });
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) collide(players[i], players[j]);
  collide(referee, ball);
  players.forEach(pl => collide(referee, pl));

  // Goal detection
  let scored = -1;
  if (ball.x < px && ball.y > gTop && ball.y < gBot) scored = 1;
  if (ball.x > px + pw && ball.y > gTop && ball.y < gBot) scored = 0;
  if (scored >= 0) {
    teams[scored].score++;
    const elapsed = timerSecs;
    const m = Math.floor((90 - elapsed) / 60);
    const s = Math.floor((90 - elapsed) % 60).toString().padStart(2, '0');
    goalLog.push({ team: scored, timeStr: `${m}'${s}` });
    state.goalFlash = 30;
    resetPositions(state);
    state.kickoff = true;
    state.kickoffTimer = 30;
  }

  if (state.foulFlash > 0) state.foulFlash--;
  if (state.goalFlash > 0) state.goalFlash--;
}

// --- DRAW FUNCTION ---
function drawFrame(ctx, state, frameNum) {
  const { px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot, teams, players, referee, ball, goalLog } = state;
  const c = ctx;

  c.save();
  c.scale(SCALE, SCALE);

  // Background
  c.fillStyle = '#1B7339';
  c.fillRect(0, 0, W, H);

  // --- SCOREBOARD ---
  const sbY = 180, sbW = 920, sbH = 100;
  const sx = W / 2 - sbW / 2;
  c.fillStyle = 'rgba(0,0,0,0.9)';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, sbW, sbH, 18); c.fill(); }
  c.fillStyle = teams[0].color;
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, 12, sbH, [18, 0, 0, 18]); c.fill(); }
  c.fillStyle = teams[1].color;
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW - 12, sbY, 12, sbH, [0, 18, 18, 0]); c.fill(); }

  c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = 'bold 36px Inter, sans-serif';
  c.fillText(teams[0].shortName, sx + 30, sbY + 62);
  c.textAlign = 'right';
  c.fillText(teams[1].shortName, sx + sbW - 30, sbY + 62);

  c.textAlign = 'center'; c.font = 'bold 64px Inter, sans-serif';
  c.fillText(teams[0].score, sx + sbW / 2 - 80, sbY + 68);
  c.fillStyle = '#555'; c.font = 'bold 40px Inter, sans-serif';
  c.fillText('-', sx + sbW / 2, sbY + 64);
  c.fillStyle = '#fff'; c.font = 'bold 64px Inter, sans-serif';
  c.fillText(teams[1].score, sx + sbW / 2 + 80, sbY + 68);

  // Timer — maps frame to 90:00 countdown
  const timerSecs = Math.max(0, 90 * (1 - state.timerFrames / state.totalFrames));
  const mins = Math.floor(timerSecs / 60).toString().padStart(2, '0');
  const secs = Math.floor(timerSecs % 60).toString().padStart(2, '0');
  c.fillStyle = '#111';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW / 2 - 55, sbY - 14, 110, 34, 12); c.fill(); }
  c.fillStyle = '#4ADE80'; c.font = 'bold 24px Fira Code, monospace';
  c.fillText(`${mins}:${secs}`, sx + sbW / 2, sbY + 14);

  // Fouls (yellow cards)
  c.font = 'bold 22px Inter, sans-serif';
  c.fillStyle = '#FFD700';
  c.textAlign = 'left';
  if (teams[0].fouls > 0) c.fillText(`\uD83D\uDFE8 ${teams[0].fouls}`, sx + 30, sbY + 90);
  c.textAlign = 'right';
  if (teams[1].fouls > 0) c.fillText(`\uD83D\uDFE8 ${teams[1].fouls}`, sx + sbW - 30, sbY + 90);

  // --- PITCH (neon glow) ---
  c.fillStyle = '#22883F';
  c.fillRect(px, py, pw, ph);
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.6)'; c.shadowBlur = 15;
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 4;
  c.strokeRect(px, py, pw, ph);
  c.beginPath(); c.moveTo(midX, py); c.lineTo(midX, py + ph); c.stroke();
  c.beginPath(); c.arc(midX, midY, 60, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(midX, midY, 5, 0, Math.PI * 2); c.fill();
  const penW = 90, penH = 280;
  c.strokeRect(px, midY - penH / 2, penW, penH);
  c.strokeRect(px + pw - penW, midY - penH / 2, penW, penH);
  c.restore();

  // --- GOALS (neon glow + net) ---
  for (let side = 0; side < 2; side++) {
    const gx = side === 0 ? px - goalW : px + pw;
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(gx, gTop, goalW, goalH);
    c.save(); c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 12;
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    if (side === 0) {
      c.beginPath(); c.moveTo(px, gTop); c.lineTo(gx, gTop); c.lineTo(gx, gBot); c.lineTo(px, gBot); c.stroke();
    } else {
      c.beginPath(); c.moveTo(px + pw, gTop); c.lineTo(gx + goalW, gTop); c.lineTo(gx + goalW, gBot); c.lineTo(px + pw, gBot); c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
    for (let ny = gTop + 12; ny < gBot; ny += 12) { c.beginPath(); c.moveTo(gx, ny); c.lineTo(gx + goalW, ny); c.stroke(); }
    for (let nx = 0; nx < goalW; nx += 8) { c.beginPath(); c.moveTo(gx + nx, gTop); c.lineTo(gx + nx, gBot); c.stroke(); }
  }

  // --- FOOTBALL ---
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#555'; c.lineWidth = 1;
  c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.stroke();

  // --- PLAYERS ---
  players.forEach(pl => {
    const tm = teams[pl.team];
    c.save(); c.translate(pl.x, pl.y);
    c.fillStyle = tm.color;
    c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.clip();
    if (pl.team === 0) {
      c.fillStyle = '#FFC107';
      c.beginPath(); c.moveTo(-pl.r, -pl.r); c.lineTo(pl.r, pl.r); c.lineTo(-pl.r, pl.r); c.fill();
    } else {
      c.fillStyle = '#008C45'; c.fillRect(-pl.r, -pl.r, pl.r * 2 / 3, pl.r * 2);
      c.fillStyle = '#fff'; c.fillRect(-pl.r / 3, -pl.r, pl.r * 2 / 3, pl.r * 2);
      c.fillStyle = '#CE2B37'; c.fillRect(pl.r / 3, -pl.r, pl.r * 2 / 3, pl.r * 2);
    }
    c.restore();
    if (pl.role === 'gk') { c.strokeStyle = '#FFD700'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, pl.r + 2, 0, Math.PI * 2); c.stroke(); }
    const ea = Math.atan2(ball.y - pl.y, ball.x - pl.x);
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-7, -4, 9, 12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(7, -4, 9, 12, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(-7, -4, 9, 12, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(7, -4, 9, 12, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(-7 + Math.cos(ea) * 3.5, -4 + Math.sin(ea) * 3.5, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(7 + Math.cos(ea) * 3.5, -4 + Math.sin(ea) * 3.5, 4, 0, Math.PI * 2); c.fill();
    c.restore();
  });

  // --- REFEREE ---
  c.save(); c.translate(referee.x, referee.y);
  c.fillStyle = '#111';
  c.beginPath(); c.arc(0, 0, referee.r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#FFD700'; c.fillRect(-referee.r, -3, referee.r * 2, 6);
  const rea = Math.atan2(ball.y - referee.y, ball.x - referee.x);
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-4, -3, 5, 7, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(4, -3, 5, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#000';
  c.beginPath(); c.arc(-4 + Math.cos(rea) * 2, -3 + Math.sin(rea) * 2, 2.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(4 + Math.cos(rea) * 2, -3 + Math.sin(rea) * 2, 2.5, 0, Math.PI * 2); c.fill();
  c.restore();

  // --- FOUL FLASH ---
  if (state.foulFlash > 0) {
    c.fillStyle = `rgba(255,255,0,${(state.foulFlash / 45) * 0.15})`;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#FFD700'; c.textAlign = 'center'; c.font = 'bold 50px Inter, sans-serif';
    c.fillText('FOUL!', W / 2, midY);
  }

  // --- GOAL LOG ---
  if (goalLog.length > 0) {
    const logY = py + ph + 20;
    goalLog.forEach((g, i) => {
      const cardY = logY + i * 58;
      c.fillStyle = 'rgba(0,0,0,0.8)';
      if (c.roundRect) { c.beginPath(); c.roundRect(60, cardY, W - 120, 50, 12); c.fill(); }
      c.fillStyle = teams[g.team].color;
      if (c.roundRect) { c.beginPath(); c.roundRect(60, cardY, 8, 50, [12, 0, 0, 12]); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.12)';
      if (c.roundRect) { c.beginPath(); c.roundRect(85, cardY + 10, 70, 30, 8); c.fill(); }
      c.fillStyle = '#4ADE80'; c.font = 'bold 22px Fira Code, monospace'; c.textAlign = 'center';
      c.fillText(g.timeStr, 120, cardY + 32);
      c.fillStyle = '#fff'; c.font = 'bold 28px Inter, sans-serif'; c.textAlign = 'left';
      c.fillText(`\u26BD  ${teams[g.team].shortName} GOAL!`, 170, cardY + 35);
    });
  }

  // --- KICKOFF ---
  if (state.kickoff && state.kickoffTimer > 0) {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(px, midY - 40, pw, 80);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 50px Inter, sans-serif';
    c.fillText(state.kickoffTimer > 20 ? 'KICK OFF!' : state.kickoffTimer > 10 ? '2' : '1', W / 2, midY + 16);
  }

  // --- GOAL FLASH ---
  if (state.goalFlash > 0) {
    c.fillStyle = `rgba(255,255,255,${(state.goalFlash / 30) * 0.3})`;
    c.fillRect(0, 0, W, H);
  }

  // --- FULL TIME ---
  if (state.timerFrames >= state.totalFrames - 90) { // last 3 seconds
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(0, H / 2 - 100, W, 200);
    c.textAlign = 'center'; c.font = 'bold 30px Inter, sans-serif'; c.fillStyle = '#aaa';
    c.fillText('FULL TIME', W / 2, H / 2 - 55);
    c.font = 'bold 70px Inter, sans-serif'; c.fillStyle = '#fff';
    c.fillText(`${teams[0].score} - ${teams[1].score}`, W / 2, H / 2 + 10);
    c.font = 'bold 36px Inter, sans-serif'; c.fillStyle = '#FFD700';
    const w = teams[0].score > teams[1].score ? teams[0].name : teams[1].score > teams[0].score ? teams[1].name : 'DRAW';
    c.fillText(w === 'DRAW' ? 'DRAW!' : `${w} WINS!`, W / 2, H / 2 + 60);
  }

  c.restore();
}

// --- REACT COMPONENT ---
export const WorldCup = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  // Initialize state on first frame
  if (!stateRef.current) {
    stateRef.current = createState(42); // deterministic seed
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Reset state and simulate up to current frame
    const state = createState(42);
    for (let f = 0; f < frame; f++) {
      stepSimulation(state);
    }
    stateRef.current = state;

    // Draw
    ctx.clearRect(0, 0, width, height);
    drawFrame(ctx, state, frame);
  }, [frame, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
