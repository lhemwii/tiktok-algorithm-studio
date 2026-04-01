import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';
import { TEAMS as ALL_TEAMS } from './teams';

const W = 1080, H = 1920, SCALE = 2;

function getTeamPair(h, a) {
  const ht = ALL_TEAMS[h] || { name: h, shortName: h, color: '#333', altColor: '#999', flag: [] };
  const at = ALL_TEAMS[a] || { name: a, shortName: a, color: '#666', altColor: '#ccc', flag: [] };
  return [{ ...ht, score: 0, fouls: 0 }, { ...at, score: 0, fouls: 0 }];
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ============== SIMULATION ==============
function initState(seed, homeCode, awayCode, matchInfo) {
  const rand = seededRandom(seed);
  const px = 70, py = 400, pw = W - 140, ph = 580;
  const midX = px + pw / 2, midY = py + ph / 2;
  const goalW = 50, goalH = 230;
  const gTop = midY - goalH / 2, gBot = midY + goalH / 2;
  const PR = 20;
  const teams = getTeamPair(homeCode, awayCode);
  const players = [
    { x: px + 30, y: midY, vx: 0, vy: 0, r: PR, team: 0, role: 'gk' },
    { x: midX - 110, y: midY - 70, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: midX - 110, y: midY + 70, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: px + pw - 30, y: midY, vx: 0, vy: 0, r: PR, team: 1, role: 'gk' },
    { x: midX + 110, y: midY - 70, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
    { x: midX + 110, y: midY + 70, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
  ];
  const referee = { x: midX, y: midY + 35, vx: 0, vy: 0, r: 14 };
  const ball = { x: midX, y: midY, vx: 0, vy: 0, r: 10 };
  return {
    rand, px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot, teams, players, referee, ball,
    goalLog: [], stuckTimer: 0, lastBallX: midX, lastBallY: midY,
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
  const { px, py, pw, ph, gTop, gBot } = s;
  let hit = false;
  if (b.y - b.r < py) { b.y = py + b.r; b.vy = Math.abs(b.vy); hit = true; }
  if (b.y + b.r > py + ph) { b.y = py + ph - b.r; b.vy = -Math.abs(b.vy); hit = true; }
  if (b.x - b.r < px && !(b.y > gTop && b.y < gBot)) { b.x = px + b.r; b.vx = Math.abs(b.vx); hit = true; }
  if (b.x + b.r > px + pw && !(b.y > gTop && b.y < gBot)) { b.x = px + pw - b.r; b.vx = -Math.abs(b.vx); hit = true; }
  return hit;
}

function resetPos(s) {
  const { px, pw, midX, midY, players, ball, referee } = s;
  ball.x = midX; ball.y = midY; ball.vx = 0; ball.vy = 0;
  players[0].x = px + 30; players[0].y = midY;
  players[1].x = midX - 110; players[1].y = midY - 70;
  players[2].x = midX - 110; players[2].y = midY + 70;
  players[3].x = px + pw - 30; players[3].y = midY;
  players[4].x = midX + 110; players[4].y = midY - 70;
  players[5].x = midX + 110; players[5].y = midY + 70;
  players.forEach(p => { p.vx = 0; p.vy = 0; });
  referee.x = midX; referee.y = midY + 35; referee.vx = 0; referee.vy = 0;
}

function stepSim(s) {
  s.events = []; // clear events for this frame
  const { rand, px, pw, midX, midY, gTop, gBot, players, ball, referee, teams, goalLog } = s;

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

  // AI
  players.forEach(pl => {
    const oppGoalX = pl.team === 0 ? px + pw : px;
    const ownGoalX = pl.team === 0 ? px : px + pw;
    let tx, ty;
    if (pl.role === 'gk') {
      tx = ownGoalX + (pl.team === 0 ? 28 : -28);
      ty = midY + (ball.y - midY) * 0.8;
      ty = Math.max(gTop + 12, Math.min(gBot - 12, ty));
      if (Math.abs(ball.x - ownGoalX) < 120) { tx = ball.x; ty = ball.y; }
    } else {
      const gdx = oppGoalX - ball.x, gdy = midY - ball.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      tx = ball.x - (gdx / gd) * (ball.r + pl.r + 5);
      ty = ball.y - (gdy / gd) * (ball.r + pl.r + 5);
      const dist = Math.sqrt((pl.x - ball.x) ** 2 + (pl.y - ball.y) ** 2);
      if (dist < 45) { tx = ball.x + (gdx / gd) * 8; ty = ball.y + (gdy / gd) * 8; }
      if ((pl.x < px + 30 || pl.x > px + pw - 30) && (pl.y < gTop - 25 || pl.y > gBot + 25)) {
        tx = midX + (rand() - 0.5) * 80; ty = midY + (rand() - 0.5) * 80;
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
    const atk = ball.x < midX ? 0 : 1;
    teams[atk === 0 ? 1 : 0].fouls++;
    ball.vx = (midX - ball.x) * 0.06 + (rand() - 0.5) * 7;
    ball.vy = (midY - ball.y) * 0.06 + (rand() - 0.5) * 7;
    players.forEach(pl => { if (pl.team !== atk) { pl.x = pl.team === 0 ? px + pw / 4 : px + pw * 3 / 4; pl.y = midY + (rand() - 0.5) * 180; pl.vx = 0; pl.vy = 0; } });
    s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y;
    s.events.push('whistle');
  }

  ball.vx *= 0.997; ball.vy *= 0.997; ball.x += ball.vx; ball.y += ball.vy;
  if (bounceRect(ball, s)) s.events.push('bounce');
  players.forEach(pl => { bounceRect(pl, s); if (collide(pl, ball)) s.events.push('kick'); });
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) collide(players[i], players[j]);
  if (collide(referee, ball)) s.events.push('kick');
  players.forEach(pl => collide(referee, pl));

  // Goals
  let scored = -1;
  if (ball.x < px && ball.y > gTop && ball.y < gBot) scored = 1;
  if (ball.x > px + pw && ball.y > gTop && ball.y < gBot) scored = 0;
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
  const allEvents = [];

  for (let f = 0; f < totalFrames; f++) {
    stepSim(s);
    // Deep-copy drawable state
    snapshots.push({
      ball: { ...s.ball },
      players: s.players.map(p => ({ ...p })),
      referee: { ...s.referee },
      teams: s.teams.map(t => ({ ...t })),
      goalLog: s.goalLog.map(g => ({ ...g })),
      foulFlash: s.foulFlash, goalFlash: s.goalFlash,
      kickoff: s.kickoff, kickoffTimer: s.kickoffTimer,
      timerFrames: s.timerFrames, totalFrames: s.totalFrames,
      matchInfo: s.matchInfo,
      px: s.px, py: s.py, pw: s.pw, ph: s.ph,
      midX: s.midX, midY: s.midY,
      goalW: s.goalW, goalH: s.goalH, gTop: s.gTop, gBot: s.gBot,
    });
    // Record events with frame number
    s.events.forEach(e => allEvents.push({ type: e, frame: f }));
  }
  return { snapshots, allEvents };
}

// ============== DRAW ==============
function drawFlag(c, flag, x, y, w, h) {
  (flag || []).forEach(f => {
    c.fillStyle = f[0];
    c.fillRect(x + f[1] * w, y + f[2] * h, f[3] * w, f[4] * h);
  });
}

function drawFrame(ctx, snap) {
  const { px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot, teams, players, referee, ball, goalLog } = snap;
  const c = ctx;
  c.save(); c.scale(SCALE, SCALE);

  // BG
  c.fillStyle = '#1A6B35'; c.fillRect(0, 0, W, H);

  // === SCOREBOARD (glassmorphism + flags) ===
  const sbY = 170, sbW = 800, sbH = 80;
  const sx = W / 2 - sbW / 2;
  // Glass background
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.save(); c.filter = 'blur(0px)';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, sbW, sbH, 16); c.fill(); }
  c.restore();
  // Border glow
  c.save(); c.shadowColor = 'rgba(255,255,255,0.15)'; c.shadowBlur = 8;
  c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, sbW, sbH, 16); c.stroke(); }
  c.restore();

  // Left flag bar
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, sbW * 0.28, sbH, [16, 0, 0, 16]); c.clip(); }
  drawFlag(c, teams[0].flag, sx, sbY, sbW * 0.28, sbH);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx, sbY, sbW * 0.28, sbH);
  c.restore();
  // Left team name
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 22px Inter, sans-serif';
  c.fillText(teams[0].shortName, sx + sbW * 0.14, sbY + 52);

  // Score left
  c.fillStyle = 'rgba(255,255,255,0.15)';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW * 0.28, sbY + 10, sbW * 0.1, sbH - 20, 8); c.fill(); }
  c.fillStyle = '#fff'; c.font = 'bold 44px Inter, sans-serif';
  c.fillText(teams[0].score, sx + sbW * 0.33, sbY + 56);

  // Timer center
  c.fillStyle = 'rgba(200,160,0,0.7)';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW * 0.4, sbY + 8, sbW * 0.2, sbH - 16, 10); c.fill(); }
  const tSecs = Math.max(0, 90 * (1 - snap.timerFrames / snap.totalFrames));
  const mins = Math.floor(tSecs / 60).toString().padStart(2, '0');
  const secs = Math.floor(tSecs % 60).toString().padStart(2, '0');
  c.fillStyle = '#fff'; c.font = 'bold 28px Fira Code, monospace';
  c.fillText(`${mins}:${secs}`, sx + sbW * 0.5, sbY + 52);

  // Score right
  c.fillStyle = 'rgba(255,255,255,0.15)';
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW * 0.62, sbY + 10, sbW * 0.1, sbH - 20, 8); c.fill(); }
  c.fillStyle = '#fff'; c.font = 'bold 44px Inter, sans-serif';
  c.fillText(teams[1].score, sx + sbW * 0.67, sbY + 56);

  // Right flag bar
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW * 0.72, sbY, sbW * 0.28, sbH, [0, 16, 16, 0]); c.clip(); }
  drawFlag(c, teams[1].flag, sx + sbW * 0.72, sbY, sbW * 0.28, sbH);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx + sbW * 0.72, sbY, sbW * 0.28, sbH);
  c.restore();
  c.fillStyle = '#fff'; c.font = 'bold 22px Inter, sans-serif';
  c.fillText(teams[1].shortName, sx + sbW * 0.86, sbY + 52);

  // Yellow cards under scoreboard
  c.font = 'bold 18px Inter, sans-serif';
  if (teams[0].fouls > 0) { c.fillStyle = '#FFD700'; c.textAlign = 'left'; c.fillText(`\uD83D\uDFE8 x${teams[0].fouls}`, sx + 10, sbY + sbH + 22); }
  if (teams[1].fouls > 0) { c.fillStyle = '#FFD700'; c.textAlign = 'right'; c.fillText(`\uD83D\uDFE8 x${teams[1].fouls}`, sx + sbW - 10, sbY + sbH + 22); }

  // === PITCH with neon glow ===
  c.fillStyle = '#228B3F'; c.fillRect(px, py, pw, ph);
  c.save(); c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 20;
  c.strokeStyle = '#fff'; c.lineWidth = 5;
  c.strokeRect(px, py, pw, ph);
  c.beginPath(); c.moveTo(midX, py); c.lineTo(midX, py + ph); c.stroke();
  c.beginPath(); c.arc(midX, midY, 50, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(midX, midY, 4, 0, Math.PI * 2); c.fill();
  c.strokeRect(px, midY - 120, 70, 240);
  c.strokeRect(px + pw - 70, midY - 120, 70, 240);
  c.restore();

  // === GOALS ===
  for (let side = 0; side < 2; side++) {
    const gx = side === 0 ? px - goalW : px + pw;
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(gx, gTop, goalW, goalH);
    c.save(); c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 14;
    c.strokeStyle = '#fff'; c.lineWidth = 5;
    if (side === 0) { c.beginPath(); c.moveTo(px, gTop); c.lineTo(gx, gTop); c.lineTo(gx, gBot); c.lineTo(px, gBot); c.stroke(); }
    else { c.beginPath(); c.moveTo(px + pw, gTop); c.lineTo(gx + goalW, gTop); c.lineTo(gx + goalW, gBot); c.lineTo(px + pw, gBot); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
    for (let ny = gTop + 10; ny < gBot; ny += 10) { c.beginPath(); c.moveTo(gx, ny); c.lineTo(gx + goalW, ny); c.stroke(); }
    for (let nx = 0; nx < goalW; nx += 7) { c.beginPath(); c.moveTo(gx + nx, gTop); c.lineTo(gx + nx, gBot); c.stroke(); }
  }

  // === FOOTBALL ===
  c.fillStyle = '#fff'; c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#444'; c.lineWidth = 1; c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.stroke();

  // === PLAYERS ===
  players.forEach(pl => {
    const tm = teams[pl.team];
    c.save(); c.translate(pl.x, pl.y);
    c.fillStyle = tm.color; c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.clip();
    drawFlag(c, tm.flag, -pl.r, -pl.r, pl.r * 2, pl.r * 2);
    c.restore();
    if (pl.role === 'gk') { c.strokeStyle = '#FFD700'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, pl.r + 2, 0, Math.PI * 2); c.stroke(); }
    const ea = Math.atan2(ball.y - pl.y, ball.x - pl.x);
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-5, -3, 6, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(5, -3, 6, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(-5, -3, 6, 8, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(5, -3, 6, 8, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(-5 + Math.cos(ea) * 2.5, -3 + Math.sin(ea) * 2.5, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(5 + Math.cos(ea) * 2.5, -3 + Math.sin(ea) * 2.5, 3, 0, Math.PI * 2); c.fill();
    c.restore();
  });

  // === REFEREE ===
  c.save(); c.translate(referee.x, referee.y);
  c.fillStyle = '#111'; c.beginPath(); c.arc(0, 0, referee.r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#FFD700'; c.fillRect(-referee.r, -2, referee.r * 2, 4);
  const rea = Math.atan2(ball.y - referee.y, ball.x - referee.x);
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-3, -2, 4, 5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(3, -2, 4, 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#000';
  c.beginPath(); c.arc(-3 + Math.cos(rea) * 1.5, -2 + Math.sin(rea) * 1.5, 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(3 + Math.cos(rea) * 1.5, -2 + Math.sin(rea) * 1.5, 2, 0, Math.PI * 2); c.fill();
  c.restore();

  // === GOAL LOG + INFO (just under pitch) ===
  const infoY = py + ph + 12;
  // Mini team badges
  c.fillStyle = 'rgba(0,0,0,0.5)';
  if (c.roundRect) { c.beginPath(); c.roundRect(60, infoY, W - 120, 45, 10); c.fill(); }
  // Left flag mini
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(72, infoY + 8, 40, 28, 4); c.clip(); }
  drawFlag(c, teams[0].flag, 72, infoY + 8, 40, 28);
  c.restore();
  // Right flag mini
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(W - 60 - 52, infoY + 8, 40, 28, 4); c.clip(); }
  drawFlag(c, teams[1].flag, W - 60 - 52, infoY + 8, 40, 28);
  c.restore();
  // Team names
  c.fillStyle = '#fff'; c.font = 'bold 16px Inter, sans-serif';
  c.textAlign = 'left'; c.fillText(teams[0].shortName, 118, infoY + 28);
  c.textAlign = 'right'; c.fillText(teams[1].shortName, W - 120, infoY + 28);
  c.textAlign = 'center'; c.fillStyle = '#aaa'; c.font = '14px Inter, sans-serif';
  c.fillText('FIFA WORLD CUP 2026', W / 2, infoY + 28);

  // Goal log cards
  if (goalLog.length > 0) {
    goalLog.forEach((g, i) => {
      const cy2 = infoY + 55 + i * 42;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      if (c.roundRect) { c.beginPath(); c.roundRect(70, cy2, W - 140, 36, 8); c.fill(); }
      c.fillStyle = teams[g.team].color;
      c.fillRect(70, cy2, 5, 36);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      if (c.roundRect) { c.beginPath(); c.roundRect(88, cy2 + 6, 55, 24, 5); c.fill(); }
      c.fillStyle = '#4ADE80'; c.font = 'bold 16px Fira Code, monospace'; c.textAlign = 'center';
      c.fillText(g.timeStr, 115, cy2 + 24);
      c.fillStyle = '#fff'; c.font = 'bold 20px Inter, sans-serif'; c.textAlign = 'left';
      c.fillText(`\u26BD ${teams[g.team].shortName} GOAL!`, 155, cy2 + 26);
    });
  }

  // === FOUL ===
  if (snap.foulFlash > 0) {
    c.fillStyle = `rgba(255,255,0,${(snap.foulFlash / 40) * 0.12})`; c.fillRect(0, 0, W, H);
    c.fillStyle = '#FFD700'; c.textAlign = 'center'; c.font = 'bold 42px Inter, sans-serif';
    c.fillText('FOUL!', W / 2, midY);
  }
  if (snap.goalFlash > 0) { c.fillStyle = `rgba(255,255,255,${(snap.goalFlash / 30) * 0.25})`; c.fillRect(0, 0, W, H); }
  if (snap.kickoff && snap.kickoffTimer > 0) {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(px, midY - 30, pw, 60);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 38px Inter, sans-serif';
    c.fillText(snap.kickoffTimer > 20 ? 'KICK OFF!' : snap.kickoffTimer > 10 ? '2' : '1', W / 2, midY + 12);
  }
  if (snap.timerFrames >= snap.totalFrames - 90) {
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(0, H / 2 - 80, W, 160);
    c.textAlign = 'center'; c.font = 'bold 26px Inter, sans-serif'; c.fillStyle = '#aaa';
    c.fillText('FULL TIME', W / 2, H / 2 - 42);
    c.font = 'bold 58px Inter, sans-serif'; c.fillStyle = '#fff';
    c.fillText(`${teams[0].score} - ${teams[1].score}`, W / 2, H / 2 + 10);
    c.font = 'bold 30px Inter, sans-serif'; c.fillStyle = '#FFD700';
    const w = teams[0].score > teams[1].score ? teams[0].name : teams[1].score > teams[0].score ? teams[1].name : 'DRAW';
    c.fillText(w === 'DRAW' ? 'DRAW!' : `${w} WINS!`, W / 2, H / 2 + 50);
  }
  if (snap.matchInfo) {
    c.fillStyle = '#fff'; c.globalAlpha = 0.3; c.textAlign = 'center'; c.font = '14px Inter, sans-serif';
    c.fillText(snap.matchInfo, W / 2, H - 50); c.globalAlpha = 1;
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

  const bgmSrc = new URL('./audio/bgm.wav', import.meta.url).href;
  const crowdSrc = new URL('./audio/crowd.wav', import.meta.url).href;
  const goalSrc = new URL('./audio/goal.wav', import.meta.url).href;
  const whistleSrc = new URL('./audio/whistle.wav', import.meta.url).href;
  const kickSrc = new URL('./audio/kick.wav', import.meta.url).href;

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      <Audio src={bgmSrc} volume={0.2} />
      {Array.from({ length: 7 }).map((_, i) => (
        <Sequence key={`c${i}`} from={i * 300} durationInFrames={300}><Audio src={crowdSrc} volume={0.1} /></Sequence>
      ))}
      {allEvents.map((e, i) => {
        if (e.type === 'goal') return <Sequence key={`g${i}`} from={e.frame} durationInFrames={75}><Audio src={goalSrc} volume={0.55} /></Sequence>;
        if (e.type === 'whistle') return <Sequence key={`w${i}`} from={e.frame} durationInFrames={25}><Audio src={whistleSrc} volume={0.45} /></Sequence>;
        if (e.type === 'kick' && i % 3 === 0) return <Sequence key={`k${i}`} from={e.frame} durationInFrames={5}><Audio src={kickSrc} volume={0.2} /></Sequence>;
        return null;
      })}
    </>
  );
};
