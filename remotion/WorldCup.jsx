import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';
import { TEAMS as ALL_TEAMS } from './teams';

// Logical resolution for all drawing code
const W = 1080, H = 1920;
const CANVAS_SCALE = 2;

function getTeamPair(h, a) {
  const ht = ALL_TEAMS[h] || { name: h, shortName: h, color: '#333', altColor: '#999', flag: [] };
  const at = ALL_TEAMS[a] || { name: a, shortName: a, color: '#666', altColor: '#ccc', flag: [] };
  return [{ ...ht, score: 0, fouls: 0, touches: 0 }, { ...at, score: 0, fouls: 0, touches: 0 }];
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ============== SIMULATION ==============
function initState(seed, homeCode, awayCode, matchInfo) {
  const rand = seededRandom(seed);
  // VERTICAL pitch — goals at top and bottom
  // py=480 leaves room for scoreboard + top cage. ph=820 leaves room for bottom cage + panel
  const px = 60, py = 480, pw = 880, ph = 820;
  const midX = px + pw / 2, midY = py + ph / 2;
  // Goals: big visible cages above/below
  const goalW = 280, goalH = 60;
  const gLeft = midX - goalW / 2, gRight = midX + goalW / 2;
  const PR = 38; // BIG players
  const teams = getTeamPair(homeCode, awayCode);
  const players = [
    // Team 0 attacks DOWN, defends TOP goal
    { x: midX, y: py + 55, vx: 0, vy: 0, r: PR, team: 0, role: 'gk' },
    { x: midX - 150, y: midY - 120, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: midX + 150, y: midY - 120, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    // Team 1 attacks UP, defends BOTTOM goal
    { x: midX, y: py + ph - 55, vx: 0, vy: 0, r: PR, team: 1, role: 'gk' },
    { x: midX - 150, y: midY + 120, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
    { x: midX + 150, y: midY + 120, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
  ];
  const referee = { x: midX + 70, y: midY, vx: 0, vy: 0, r: PR };
  const ball = { x: midX, y: midY, vx: 0, vy: 0, r: 18 };
  return {
    rand, px, py, pw, ph, midX, midY, goalW, goalH, gLeft, gRight, teams, players, referee, ball,
    goalLog: [], foulLog: [], stuckTimer: 0, lastBallX: midX, lastBallY: midY,
    foulFlash: 0, goalFlash: 0, kickoff: true, kickoffTimer: 30,
    timerFrames: 0, totalFrames: 30 * 65, matchInfo: matchInfo || '',
    events: [], // events THIS frame
  };
}

function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < a.r + b.r && d > 0) {
    const nx = dx / d, ny = dy / d, rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rv > 0) {
      const mA = a.r * a.r, mB = b.r * b.r, tot = mA + mB;
      a.vx -= rv * nx * (2 * mB / tot); a.vy -= rv * ny * (2 * mB / tot);
      b.vx += rv * nx * (2 * mA / tot); b.vy += rv * ny * (2 * mA / tot);
      const ov = (a.r + b.r - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      return true;
    }
  }
  return false;
}

function bounceRect(b, s) {
  const { px, py, pw, ph, gLeft, gRight } = s;
  let hit = false;
  // Left/right walls — always solid
  if (b.x - b.r < px) { b.x = px + b.r; b.vx = Math.abs(b.vx); hit = true; }
  if (b.x + b.r > px + pw) { b.x = px + pw - b.r; b.vx = -Math.abs(b.vx); hit = true; }
  // Top wall — open in goal zone (gLeft to gRight)
  if (b.y - b.r < py && !(b.x > gLeft && b.x < gRight)) { b.y = py + b.r; b.vy = Math.abs(b.vy); hit = true; }
  // Bottom wall — open in goal zone
  if (b.y + b.r > py + ph && !(b.x > gLeft && b.x < gRight)) { b.y = py + ph - b.r; b.vy = -Math.abs(b.vy); hit = true; }
  return hit;
}

function resetPos(s) {
  const { py, ph, midX, midY, players, ball, referee } = s;
  ball.x = midX; ball.y = midY; ball.vx = 0; ball.vy = 0;
  players[0].x = midX; players[0].y = py + 55;
  players[1].x = midX - 150; players[1].y = midY - 120;
  players[2].x = midX + 150; players[2].y = midY - 120;
  players[3].x = midX; players[3].y = py + ph - 55;
  players[4].x = midX - 150; players[4].y = midY + 120;
  players[5].x = midX + 150; players[5].y = midY + 120;
  players.forEach(p => { p.vx = 0; p.vy = 0; });
  referee.x = midX + 70; referee.y = midY; referee.vx = 0; referee.vy = 0;
}

function stepSim(s) {
  s.events = []; // clear events for this frame
  const { rand, px, py, pw, ph, midX, midY, gLeft, gRight, players, ball, referee, teams, goalLog, foulLog } = s;

  if (s.kickoff) {
    s.kickoffTimer--;
    if (s.kickoffTimer <= 0) {
      s.kickoff = false;
      ball.vx = (rand() - 0.5) * 3; ball.vy = (rand() - 0.5) * 3;
      s.events.push('whistle');
    }
    s.timerFrames++; return;
  }
  s.timerFrames++;

  // AI — VERTICAL: team 0 defends TOP, attacks DOWN. Team 1 defends BOTTOM, attacks UP.
  players.forEach(pl => {
    const oppGoalY = pl.team === 0 ? py + ph : py; // team 0 attacks bottom, team 1 attacks top
    const ownGoalY = pl.team === 0 ? py : py + ph;
    let tx, ty;
    if (pl.role === 'gk') {
      // GK stays on own goal line, tracks ball X
      ty = ownGoalY + (pl.team === 0 ? 35 : -35);
      tx = midX + (ball.x - midX) * 0.8;
      tx = Math.max(gLeft + 15, Math.min(gRight - 15, tx));
      if (Math.abs(ball.y - ownGoalY) < 150) { tx = ball.x; ty = ball.y; }
    } else {
      // Field: get behind ball to push toward opponent goal
      const gdx = midX - ball.x, gdy = oppGoalY - ball.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      tx = ball.x - (gdx / gd) * (ball.r + pl.r + 5);
      ty = ball.y - (gdy / gd) * (ball.r + pl.r + 5);
      const dist = Math.sqrt((pl.x - ball.x) ** 2 + (pl.y - ball.y) ** 2);
      if (dist < 55) { tx = ball.x + (gdx / gd) * 8; ty = ball.y + (gdy / gd) * 8; }
      // Anti-corner
      if ((pl.y < py + 35 || pl.y > py + ph - 35) && (pl.x < px + 35 || pl.x > px + pw - 35)) {
        tx = midX + (rand() - 0.5) * 100; ty = midY + (rand() - 0.5) * 100;
      }
    }
    const dx = tx - pl.x, dy = ty - pl.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    pl.vx += (dx / d) * 0.75; pl.vy += (dy / d) * 0.75;
    pl.vx += (rand() - 0.5) * 0.3; pl.vy += (rand() - 0.5) * 0.3;
    pl.vx *= 0.92; pl.vy *= 0.92;
    const ms = pl.role === 'gk' ? 7 : 9.5;
    const sp = Math.sqrt(pl.vx * pl.vx + pl.vy * pl.vy);
    if (sp > ms) { pl.vx = (pl.vx / sp) * ms; pl.vy = (pl.vy / sp) * ms; }
    pl.x += pl.vx; pl.y += pl.vy;
  });

  // Referee
  const rtx = ball.x + (ball.x > midX ? -40 : 40), rty = ball.y + 25;
  const rdx = rtx - referee.x, rdy = rty - referee.y, rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
  referee.vx += (rdx / rd) * 0.2; referee.vy += (rdy / rd) * 0.2;
  referee.vx *= 0.93; referee.vy *= 0.93;
  referee.x += referee.vx; referee.y += referee.vy;
  bounceRect(referee, s);

  // Stuck detection
  const bmd = Math.sqrt((ball.x - s.lastBallX) ** 2 + (ball.y - s.lastBallY) ** 2);
  if (bmd < ball.r) s.stuckTimer++; else { s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y; }
  if (s.stuckTimer >= 60) {
    s.foulFlash = 40;
    const atk = ball.y < midY ? 0 : 1; // ball in top half = team 0's territory
    teams[atk === 0 ? 1 : 0].fouls++;
    const foulTeam = atk === 0 ? 1 : 0;
    const elapsed = 90 * (s.timerFrames / s.totalFrames);
    foulLog.push({ team: foulTeam, timeStr: `${Math.floor(elapsed / 60)}'${Math.floor(elapsed % 60).toString().padStart(2, '0')}` });
    ball.vx = (midX - ball.x) * 0.06 + (rand() - 0.5) * 7;
    ball.vy = (midY - ball.y) * 0.06 + (rand() - 0.5) * 7;
    // Send opponent back to their half (vertical)
    players.forEach(pl => { if (pl.team !== atk) { pl.y = pl.team === 0 ? py + ph / 4 : py + ph * 3 / 4; pl.x = midX + (rand() - 0.5) * 200; pl.vx = 0; pl.vy = 0; } });
    s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y;
    s.events.push('whistle');
  }

  ball.vx *= 0.997; ball.vy *= 0.997; ball.x += ball.vx; ball.y += ball.vy;
  if (bounceRect(ball, s)) s.events.push('bounce');
  players.forEach(pl => {
    bounceRect(pl, s);
    if (collide(pl, ball)) {
      teams[pl.team].touches++;
      s.events.push('kick');
    }
  });
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      collide(players[i], players[j]);
    }
  }
  if (collide(referee, ball)) s.events.push('kick');
  players.forEach(pl => collide(referee, pl));

  // Goals — VERTICAL: top goal = team 0 defends, bottom goal = team 1 defends
  let scored = -1;
  if (ball.y < py && ball.x > gLeft && ball.x < gRight) scored = 1; // ball goes through top → team 1 scores
  if (ball.y > py + ph && ball.x > gLeft && ball.x < gRight) scored = 0; // ball goes through bottom → team 0 scores
  if (scored >= 0) {
    teams[scored].score++;
    const elapsed = 90 * (s.timerFrames / s.totalFrames);
    goalLog.push({ team: scored, timeStr: `${Math.floor(elapsed / 60)}'${Math.floor(elapsed % 60).toString().padStart(2, '0')}` });
    s.goalFlash = 30;
    resetPos(s);
    s.kickoff = true; s.kickoffTimer = 30; s.stuckTimer = 0;
    s.events.push('goal');
  }
  if (s.foulFlash > 0) s.foulFlash--;
  if (s.goalFlash > 0) s.goalFlash--;
}

// Run entire simulation, store snapshot per frame + events
function simulateAll(seed, home, away, info, totalFrames) {
  const s = initState(seed, home, away, info);
  const snapshots = [];
  const allEvents = [{ type: 'whistle', frame: 1 }]; // opening whistle

  for (let f = 0; f < totalFrames; f++) {
    stepSim(s);
    // Deep-copy drawable state
    snapshots.push({
      ball: { ...s.ball },
      players: s.players.map(p => ({ ...p })),
      referee: { ...s.referee },
      teams: s.teams.map(t => ({ ...t })),
      goalLog: s.goalLog.map(g => ({ ...g })),
      foulLog: s.foulLog.map(foul => ({ ...foul })),
      foulFlash: s.foulFlash, goalFlash: s.goalFlash,
      kickoff: s.kickoff, kickoffTimer: s.kickoffTimer,
      timerFrames: s.timerFrames, totalFrames: s.totalFrames,
      matchInfo: s.matchInfo,
      px: s.px, py: s.py, pw: s.pw, ph: s.ph,
      midX: s.midX, midY: s.midY,
      goalW: s.goalW, goalH: s.goalH, gLeft: s.gLeft, gRight: s.gRight,
    });
    // Record events with frame number
    s.events.forEach(e => allEvents.push({ type: e, frame: f }));
  }
  return { snapshots, allEvents };
}

function normalizeAudioEvents(events, durationInFrames) {
  const rules = {
    whistle: { cooldown: 10, offset: 0 },
    goal: { cooldown: 20, offset: 0 },
    kick: { cooldown: 2, offset: 1 },
    bounce: { cooldown: 3, offset: 1 },
  };
  const lastFrameByType = new Map();
  const normalized = [];

  events
    .slice()
    .sort((a, b) => a.frame - b.frame)
    .forEach((event) => {
      const rule = rules[event.type] || { cooldown: 0, offset: 0 };
      const targetFrame = Math.max(0, Math.min(durationInFrames - 1, event.frame + rule.offset));
      const previous = lastFrameByType.get(event.type);
      if (previous !== undefined && targetFrame - previous < rule.cooldown) {
        return;
      }
      lastFrameByType.set(event.type, targetFrame);
      normalized.push({ ...event, frame: targetFrame });
    });

  return normalized;
}

// ============== DRAW ==============
function drawFlag(c, flag, x, y, w, h) {
  (flag || []).forEach(f => {
    c.fillStyle = f[0];
    c.fillRect(x + f[1] * w, y + f[2] * h, f[3] * w, f[4] * h);
  });
}

function drawFrame(ctx, snap) {
  const { px, py, pw, ph, midX, midY, goalW, goalH, gLeft, gRight, teams, players, referee, ball, goalLog, foulLog } = snap;
  const c = ctx;
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.scale(CANVAS_SCALE, CANVAS_SCALE); // 2x for 4K sharpness on canvas elements

  const elapsed = 90 * (snap.timerFrames / snap.totalFrames);
  const pulse = 1 + Math.sin(elapsed * 0.5) * 0.03;

  const roundRect = (x, y, w, h, r = 18) => {
    if (c.roundRect) {
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      return;
    }
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
  };

  const drawGlassPanel = (x, y, w, h, r = 18) => {
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.16)';
    c.shadowBlur = 10;
    c.fillStyle = 'rgba(18,54,43,0.88)';
    roundRect(x, y, w, h, r);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 2.5;
    roundRect(x, y, w, h, r);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth = 1;
    roundRect(x + 8, y + 8, w - 16, h - 16, Math.max(8, r - 8));
    c.stroke();
    c.restore();
  };

  const drawFlagBadge = (team, x, y, size = 56) => {
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.12)';
    c.shadowBlur = 6;
    c.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(x, y, size, size, 16);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 2.5;
    roundRect(x, y, size, size, 16);
    c.stroke();
    roundRect(x + 3, y + 3, size - 6, size - 6, 14);
    c.clip();
    drawFlag(c, team.flag, x + 3, y + 3, size - 6, size - 6);
    c.restore();
  };

  c.fillStyle = '#0d5f35';
  c.fillRect(0, 0, W, H);
  const bgGrad = c.createRadialGradient(W / 2, H * 0.22, 160, W / 2, H * 0.24, H);
  bgGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, W, H);

  const touchSum = teams[0].touches + teams[1].touches;
  const possession = touchSum === 0
    ? [50, 50]
    : [
        Math.round((teams[0].touches / touchSum) * 100),
        0,
      ];
  possession[1] = 100 - possession[0];

  const sbX = 72;
  const sbY = 190;
  const sbW = W - 144;
  const sbH = 170;
  drawGlassPanel(sbX, sbY, sbW, sbH, 28);
  // Row 1: flags + names (vertically aligned)
  const flagSize = 52;
  const flagY = sbY + 22;
  drawFlagBadge(teams[0], sbX + 18, flagY, flagSize);
  c.textAlign = 'left'; c.fillStyle = '#f8fbff'; c.font = '800 28px Inter, sans-serif';
  c.fillText(teams[0].name, sbX + 18 + flagSize + 14, flagY + flagSize / 2 + 10);

  drawFlagBadge(teams[1], sbX + sbW - 18 - flagSize, flagY, flagSize);
  c.textAlign = 'right'; c.fillStyle = '#f8fbff'; c.font = '800 28px Inter, sans-serif';
  c.fillText(teams[1].name, sbX + sbW - 18 - flagSize - 14, flagY + flagSize / 2 + 10);

  // Row 2: scores (centered, large)
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '900 88px Inter, sans-serif';
  c.fillText(String(teams[0].score), sbX + sbW / 2 - 150, sbY + 140);
  c.fillText(String(teams[1].score), sbX + sbW / 2 + 150, sbY + 140);

  const tSecs = Math.max(0, 90 * (1 - snap.timerFrames / snap.totalFrames));
  const mins = Math.floor(tSecs / 60).toString().padStart(2, '0');
  const secs = Math.floor(tSecs % 60).toString().padStart(2, '0');
  c.save();
  c.translate(sbX + sbW / 2, sbY + 54);
  c.scale(pulse, pulse);
  c.fillStyle = '#253a31';
  roundRect(-100, -6, 200, 58, 22);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 1.75;
  roundRect(-100, -6, 200, 58, 22);
  c.stroke();
  c.fillStyle = '#f6fbf7';
  c.font = '900 34px Fira Code, monospace';
  c.textBaseline = 'middle';
  c.fillText(`${mins}:${secs}`, 0, 22);
  c.restore();
  c.textBaseline = 'alphabetic';

  // VERTICAL PITCH
  const pitchGrad = c.createLinearGradient(px, py, px, py + ph);
  pitchGrad.addColorStop(0, '#116742');
  pitchGrad.addColorStop(1, '#0b5a38');
  c.fillStyle = pitchGrad;
  c.fillRect(px, py, pw, ph);
  // Grass stripes (horizontal)
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)';
    c.fillRect(px, py + (ph / 8) * i, pw, ph / 8);
  }
  // Neon glow lines
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.25)';
  c.shadowBlur = 22;
  c.strokeStyle = 'rgba(255,255,255,0.98)';
  c.lineWidth = 6;
  c.strokeRect(px, py, pw, ph);
  // Center line (horizontal for vertical pitch)
  c.beginPath(); c.moveTo(px, midY); c.lineTo(px + pw, midY); c.stroke();
  // Center circle
  c.beginPath(); c.arc(midX, midY, 80, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(midX, midY, 7, 0, Math.PI * 2); c.fill();
  // Penalty areas (horizontal bars at top and bottom)
  const penW = 360, penH = 120;
  c.strokeRect(midX - penW / 2, py, penW, penH);
  c.strokeRect(midX - penW / 2, py + ph - penH, penW, penH);
  c.restore();

  // GOALS (top and bottom) — visible cages with net fill
  const drawGoal = (isTop) => {
    const gy = isTop ? py - goalH : py + ph;
    const gyEnd = isTop ? gy : gy + goalH;
    const gyStart = isTop ? py : py + ph;

    // Background fill so cage is visible on green
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(gLeft, Math.min(gyStart, gyEnd), gRight - gLeft, goalH);

    // Net pattern FIRST (behind frame)
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.5;
    for (let nx = gLeft + 14; nx < gRight; nx += 14) {
      c.beginPath(); c.moveTo(nx, gyStart); c.lineTo(nx, gyEnd); c.stroke();
    }
    for (let ny = 1; ny < goalH; ny += 12) {
      const yy = Math.min(gyStart, gyEnd) + ny;
      c.beginPath(); c.moveTo(gLeft, yy); c.lineTo(gRight, yy); c.stroke();
    }

    // Frame — thick white neon
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.5)';
    c.shadowBlur = 16;
    c.strokeStyle = '#fff';
    c.lineWidth = 8;
    c.beginPath();
    if (isTop) {
      c.moveTo(gLeft, py); c.lineTo(gLeft, gy); c.lineTo(gRight, gy); c.lineTo(gRight, py);
    } else {
      c.moveTo(gLeft, py + ph); c.lineTo(gLeft, gyEnd); c.lineTo(gRight, gyEnd); c.lineTo(gRight, py + ph);
    }
    c.stroke();
    c.restore();
  };
  drawGoal(true);
  drawGoal(false);

  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (speed > 3.5) {
    const tailAngle = Math.atan2(ball.vy, ball.vx);
    c.save();
    c.translate(ball.x, ball.y);
    c.rotate(tailAngle + Math.PI);
    const trailGrad = c.createLinearGradient(0, 0, 46, 0);
    trailGrad.addColorStop(0, 'rgba(255,255,255,0.24)');
    trailGrad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = trailGrad;
    roundRect(0, -8, 46, 16, 10);
    c.fill();
    c.restore();
  }

  c.save();
  c.shadowColor = 'rgba(255,255,255,0.24)';
  c.shadowBlur = 10;
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(24,24,24,0.24)';
  c.lineWidth = 2;
  c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.stroke();

  players.forEach((pl) => {
    const tm = teams[pl.team];
    c.save();
    c.translate(pl.x, pl.y);
    c.shadowColor = 'rgba(0,0,0,0.12)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 4;
    c.beginPath();
    c.arc(0, 0, pl.r, 0, Math.PI * 2);
    c.clip();
    drawFlag(c, tm.flag, -pl.r, -pl.r, pl.r * 2, pl.r * 2);
    c.restore();
    c.save();
    c.translate(pl.x, pl.y);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.stroke();
    const eyeAngle = Math.atan2(ball.y - pl.y, ball.x - pl.x);
    // Eyes — smaller, no border
    const es = pl.r / 28;
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-8 * es, -4 * es, 9 * es, 12 * es, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(8 * es, -4 * es, 9 * es, 12 * es, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(-8 * es + Math.cos(eyeAngle) * 3.5 * es, -4 * es + Math.sin(eyeAngle) * 3.5 * es, 4 * es, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(8 * es + Math.cos(eyeAngle) * 3.5 * es, -4 * es + Math.sin(eyeAngle) * 3.5 * es, 4 * es, 0, Math.PI * 2); c.fill();
    c.restore();
  });

  c.save();
  c.translate(referee.x, referee.y);
  c.shadowColor = 'rgba(0,0,0,0.12)';
  c.shadowBlur = 6;
  c.shadowOffsetY = 4;
  c.fillStyle = '#131313';
  c.beginPath(); c.arc(0, 0, referee.r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd54a';
  c.fillRect(-referee.r, -5, referee.r * 2, 10);
  const rea = Math.atan2(ball.y - referee.y, ball.x - referee.x);
  // Same eye size as players, no border
  const res = referee.r / 28;
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-8 * res, -4 * res, 9 * res, 12 * res, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8 * res, -4 * res, 9 * res, 12 * res, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111';
  c.beginPath(); c.arc(-8 * res + Math.cos(rea) * 3.5 * res, -4 * res + Math.sin(rea) * 3.5 * res, 4 * res, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(8 * res + Math.cos(rea) * 3.5 * res, -4 * res + Math.sin(rea) * 3.5 * res, 4 * res, 0, Math.PI * 2); c.fill();
  c.restore();

  const teamEvents = [
    [
      ...goalLog.filter((g) => g.team === 0).map((g) => ({ timeStr: g.timeStr, label: 'GOAL', accent: '#4ade80' })),
      ...(foulLog || []).filter((foul) => foul.team === 0).map((foul) => ({ timeStr: foul.timeStr, label: 'YELLOW CARD', accent: '#f4c845' })),
    ].slice(-5).reverse(),
    [
      ...goalLog.filter((g) => g.team === 1).map((g) => ({ timeStr: g.timeStr, label: 'GOAL', accent: '#4ade80' })),
      ...(foulLog || []).filter((foul) => foul.team === 1).map((foul) => ({ timeStr: foul.timeStr, label: 'YELLOW CARD', accent: '#f4c845' })),
    ].slice(-5).reverse(),
  ];

  // INFO PANEL — same left margin as pitch, right margin for TikTok buttons
  const panelX = px;
  const panelY = py + ph + goalH + 20;
  const panelW = pw; // same width as pitch
  const panelH = H - panelY - 20;
  drawGlassPanel(panelX, panelY, panelW, panelH, 20);

  // FIFA WORLD CUP 2026 — BIG
  c.fillStyle = '#fff';
  c.font = '900 36px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('FIFA WORLD CUP 2026', panelX + panelW / 2, panelY + 42);

  // Possession bar — BIG
  const possessionY = panelY + 68;
  const possessionX = panelX + 24;
  const possessionW = panelW - 48;
  const leftPW = Math.max(24, (possessionW * possession[0]) / 100);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(possessionX, possessionY, possessionW, 30, 15);
  c.fill();
  c.fillStyle = teams[0].color || '#fff';
  roundRect(possessionX, possessionY, leftPW, 30, 15);
  c.fill();
  c.fillStyle = teams[1].color || '#fff';
  roundRect(possessionX + leftPW, possessionY, possessionW - leftPW, 30, 15);
  c.fill();
  c.fillStyle = '#fff'; c.font = '900 24px Inter, sans-serif';
  c.textAlign = 'left'; c.fillText(`${possession[0]}%`, possessionX, possessionY - 8);
  c.textAlign = 'right'; c.fillText(`${possession[1]}%`, possessionX + possessionW, possessionY - 8);
  c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = '800 22px Inter, sans-serif';
  c.fillText('Possession', panelX + panelW / 2, possessionY - 8);

  // Two columns: flag + team name + yellow card rectangles (no text, just visual)
  const colY = possessionY + 48;

  // Left column (team 0)
  drawFlagBadge(teams[0], panelX + 20, colY, 56);
  c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '900 38px Inter, sans-serif';
  c.fillText(teams[0].name, panelX + 90, colY + 40);
  for (let yc = 0; yc < teams[0].fouls; yc++) {
    c.fillStyle = '#f4c845';
    roundRect(panelX + 90 + yc * 32, colY + 54, 24, 34, 5);
    c.fill();
  }

  // Right column (team 1)
  drawFlagBadge(teams[1], panelX + panelW / 2 + 20, colY, 56);
  c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '900 38px Inter, sans-serif';
  c.fillText(teams[1].name, panelX + panelW / 2 + 90, colY + 40);
  for (let yc = 0; yc < teams[1].fouls; yc++) {
    c.fillStyle = '#f4c845';
    roundRect(panelX + panelW / 2 + 90 + yc * 32, colY + 54, 24, 34, 5);
    c.fill();
  }

  // Events list — goals and fouls pop up, most recent first
  const eventsY = colY + 100;
  const allMatchEvents = [
    ...goalLog.map(g => ({ type: 'goal', team: g.team, timeStr: g.timeStr, label: 'GOAL', accent: '#4ADE80' })),
    ...foulLog.map(f => ({ type: 'foul', team: f.team, timeStr: f.timeStr, label: 'FOUL', accent: '#f4c845' })),
  ].sort((a, b) => {
    const ta = parseFloat(a.timeStr.replace("'", '.'));
    const tb = parseFloat(b.timeStr.replace("'", '.'));
    return tb - ta;
  }).slice(0, 3);

  allMatchEvents.forEach((evt, i) => {
    const rowY = eventsY + i * 50;
    if (rowY + 40 > panelY + panelH - 8) return;
    c.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(panelX + 16, rowY, panelW - 32, 42, 12);
    c.fill();
    c.fillStyle = teams[evt.team].color;
    c.fillRect(panelX + 16, rowY, 6, 42);
    c.fillStyle = evt.accent; c.font = '900 22px Fira Code, monospace'; c.textAlign = 'left';
    c.fillText(evt.timeStr, panelX + 36, rowY + 30);
    c.fillStyle = '#fff'; c.font = '900 26px Inter, sans-serif';
    c.fillText(`${evt.label} — ${teams[evt.team].shortName || teams[evt.team].name}`, panelX + 150, rowY + 30);
  });

  if (snap.foulFlash > 0) {
    c.fillStyle = `rgba(244,200,69,${(snap.foulFlash / 40) * 0.24})`;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#f4c845';
    c.textAlign = 'center';
    c.font = '900 86px Inter, sans-serif';
    c.fillText('YELLOW CARD', W / 2, midY - 16);
  }
  if (snap.goalFlash > 0) {
    c.fillStyle = `rgba(255,255,255,${(snap.goalFlash / 30) * 0.26})`;
    c.fillRect(0, 0, W, H);
  }
  if (snap.kickoff && snap.kickoffTimer > 0) {
    c.fillStyle = 'rgba(8,16,24,0.52)';
    roundRect(midX - 170, midY - 44, 340, 88, 20);
    c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = '900 48px Inter, sans-serif';
    c.fillText(snap.kickoffTimer > 20 ? 'KICK OFF' : snap.kickoffTimer > 10 ? '2' : '1', midX, midY + 16);
  }
  if (snap.timerFrames >= snap.totalFrames - 90) {
    c.fillStyle = 'rgba(6,10,16,0.82)';
    c.fillRect(0, H / 2 - 130, W, 260);
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,0.72)';
    c.font = '700 28px Inter, sans-serif';
    c.fillText('FULL TIME', W / 2, H / 2 - 52);
    c.fillStyle = '#fff';
    c.font = '900 96px Inter, sans-serif';
    c.fillText(`${teams[0].score} - ${teams[1].score}`, W / 2, H / 2 + 24);
    c.fillStyle = '#f4c845';
    c.font = '800 34px Inter, sans-serif';
    const winner = teams[0].score > teams[1].score ? teams[0].name : teams[1].score > teams[0].score ? teams[1].name : 'DRAW';
    c.fillText(winner === 'DRAW' ? 'DRAW' : `${winner} WINS`, W / 2, H / 2 + 78);
  }
  c.restore();
}

// ============== COMPONENT ==============
export const WorldCup = ({ homeTeam = 'FRA', awayTeam = 'SEN', seed = 42, matchInfo = '' }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  // Simulate ONCE, cache all snapshots + events
  const { snapshots, allEvents } = useMemo(
    () => simulateAll(seed, homeTeam, awayTeam, matchInfo, durationInFrames),
    [seed, homeTeam, awayTeam, matchInfo, durationInFrames]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (snapshots[frame]) drawFrame(ctx, snapshots[frame]);
  }, [frame, width, height, snapshots]);

  const crowdSrc = new URL('./audio/clean-stadium-loop.mp3', import.meta.url).href;
  const goalSrc = new URL('./audio/goal-cheer.mp3', import.meta.url).href;
  const goalNetSrc = new URL('./audio/goal-net-impact.mp3', import.meta.url).href;
  const whistleShortSrc = new URL('./audio/whistle-short.mp3', import.meta.url).href;
  const whistleLongSrc = new URL('./audio/whistle-long.mp3', import.meta.url).href;
  const kickSrc = new URL('./audio/realistic-kick.mp3', import.meta.url).href;
  const bounceSrc = new URL('./audio/bounce.wav', import.meta.url).href;
  const normalizedEvents = useMemo(
    () => normalizeAudioEvents(allEvents, durationInFrames),
    [allEvents, durationInFrames]
  );
  const whistles = normalizedEvents.filter((e) => e.type === 'whistle');
  const kicks = normalizedEvents.filter((e) => e.type === 'kick');
  const bounces = normalizedEvents.filter((e) => e.type === 'bounce');
  const goals = normalizedEvents.filter((e) => e.type === 'goal');
  const crowdLoopFrames = 30 * 30;

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      {Array.from({ length: Math.ceil(durationInFrames / crowdLoopFrames) }).map((_, i) => {
        const from = i * crowdLoopFrames;
        const remaining = durationInFrames - from;
        return (
        <Sequence key={`crowd-bed-${i}`} from={from} durationInFrames={Math.min(crowdLoopFrames, remaining)}>
          <Audio src={crowdSrc} volume={0.14} />
        </Sequence>
        );
      })}
      {whistles.map((e, i) => (
        <Sequence key={`w${i}`} from={e.frame} durationInFrames={60}>
          <Audio src={i === 0 ? whistleLongSrc : whistleShortSrc} volume={i === 0 ? 0.22 : 0.16} />
        </Sequence>
      ))}
      {kicks.map((e, i) => (
        <Sequence key={`k${i}`} from={e.frame} durationInFrames={6}>
          <Audio src={kickSrc} volume={0.26 + (i % 3) * 0.03} />
        </Sequence>
      ))}
      {bounces.map((e, i) => (
        <Sequence key={`b${i}`} from={e.frame} durationInFrames={6}>
          <Audio src={bounceSrc} volume={0.24 + (i % 2) * 0.04} />
        </Sequence>
      ))}
      {goals.map((e, i) => (
        <Sequence key={`g-net-${i}`} from={e.frame} durationInFrames={45}>
          <Audio src={goalNetSrc} volume={0.48} />
        </Sequence>
      ))}
      {goals.map((e, i) => (
        <Sequence key={`g${i}`} from={e.frame} durationInFrames={90}>
          <Audio src={goalSrc} volume={0.72} />
        </Sequence>
      ))}
      {goals.map((e, i) => (
        <Sequence key={`goal-crowd-${i}`} from={Math.max(0, e.frame - 6)} durationInFrames={120}>
          <Audio src={crowdSrc} volume={0.4} />
        </Sequence>
      ))}
      {whistles.slice(0, 1).map((e, i) => (
        <Sequence key={`kickoff-crowd-${i}`} from={Math.max(0, e.frame + 3)} durationInFrames={70}>
          <Audio src={crowdSrc} volume={0.16} />
        </Sequence>
      ))}
      {kicks.filter((_, i) => i % 5 === 0).map((e, i) => (
        <Sequence key={`kick-crowd-${i}`} from={e.frame} durationInFrames={35}>
          <Audio src={crowdSrc} volume={0.12} />
        </Sequence>
      ))}
    </>
  );
};
