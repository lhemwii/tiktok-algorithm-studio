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
function createState(seed, homeCode, awayCode, matchInfo) {
  const rand = seededRandom(seed);
  // Rectangular pitch
  const px = 70, py = 380, pw = W - 140, ph = 600;
  const midX = px + pw / 2, midY = py + ph / 2;
  const goalW = 50, goalH = 240;
  const gTop = midY - goalH / 2, gBot = midY + goalH / 2;
  const PR = 20;

  const teams = getTeamPair(homeCode, awayCode);
  const players = [
    // Team 0: GK + 2 field
    { x: px + 30, y: midY, vx: 0, vy: 0, r: PR, team: 0, role: 'gk' },
    { x: midX - 120, y: midY - 80, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: midX - 120, y: midY + 80, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    // Team 1: GK + 2 field
    { x: px + pw - 30, y: midY, vx: 0, vy: 0, r: PR, team: 1, role: 'gk' },
    { x: midX + 120, y: midY - 80, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
    { x: midX + 120, y: midY + 80, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
  ];
  const referee = { x: midX, y: midY + 40, vx: 0, vy: 0, r: 14 };
  const ball = { x: midX, y: midY, vx: 0, vy: 0, r: 10 };

  return {
    rand, px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot,
    teams, players, referee, ball,
    goalLog: [], stuckTimer: 0, lastBallX: midX, lastBallY: midY,
    foulFlash: 0, goalFlash: 0, kickoff: true, kickoffTimer: 30,
    timerFrames: 0, totalFrames: 30 * 65, matchInfo: matchInfo || '',
  };
}

function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < a.r + b.r && d > 0) {
    const nx = dx / d, ny = dy / d;
    const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
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
  if (b.y - b.r < py) { b.y = py + b.r; b.vy = Math.abs(b.vy); }
  if (b.y + b.r > py + ph) { b.y = py + ph - b.r; b.vy = -Math.abs(b.vy); }
  if (b.x - b.r < px && !(b.y > gTop && b.y < gBot)) { b.x = px + b.r; b.vx = Math.abs(b.vx); }
  if (b.x + b.r > px + pw && !(b.y > gTop && b.y < gBot)) { b.x = px + pw - b.r; b.vx = -Math.abs(b.vx); }
}

function resetPos(s) {
  const { px, pw, midX, midY, players, ball, referee } = s;
  ball.x = midX; ball.y = midY; ball.vx = 0; ball.vy = 0;
  players[0].x = px + 30; players[0].y = midY;
  players[1].x = midX - 120; players[1].y = midY - 80;
  players[2].x = midX - 120; players[2].y = midY + 80;
  players[3].x = px + pw - 30; players[3].y = midY;
  players[4].x = midX + 120; players[4].y = midY - 80;
  players[5].x = midX + 120; players[5].y = midY + 80;
  players.forEach(p => { p.vx = 0; p.vy = 0; });
  referee.x = midX; referee.y = midY + 40; referee.vx = 0; referee.vy = 0;
}

function stepSim(s) {
  const { rand, px, pw, midX, midY, gTop, gBot, players, ball, referee, teams, goalLog } = s;

  if (s.kickoff) { s.kickoffTimer--; if (s.kickoffTimer <= 0) { s.kickoff = false; ball.vx = (rand() - 0.5) * 3; ball.vy = (rand() - 0.5) * 3; } s.timerFrames++; return; }
  s.timerFrames++;

  // AI — ULTRA AGGRESSIVE
  players.forEach(pl => {
    const oppGoalX = pl.team === 0 ? px + pw : px;
    const ownGoalX = pl.team === 0 ? px : px + pw;
    let tx, ty;
    if (pl.role === 'gk') {
      tx = ownGoalX + (pl.team === 0 ? 30 : -30);
      ty = midY + (ball.y - midY) * 0.75;
      ty = Math.max(gTop + 15, Math.min(gBot - 15, ty));
      if (Math.abs(ball.x - ownGoalX) < 130) { tx = ball.x; ty = ball.y; }
    } else {
      const gdx = oppGoalX - ball.x, gdy = midY - ball.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      tx = ball.x - (gdx / gd) * (ball.r + pl.r + 6);
      ty = ball.y - (gdy / gd) * (ball.r + pl.r + 6);
      const dist = Math.sqrt((pl.x - ball.x) ** 2 + (pl.y - ball.y) ** 2);
      if (dist < 50) { tx = ball.x + (gdx / gd) * 8; ty = ball.y + (gdy / gd) * 8; }
      if ((pl.x < px + 35 || pl.x > px + pw - 35) && (pl.y < gTop - 30 || pl.y > gBot + 30)) {
        tx = midX + (rand() - 0.5) * 80; ty = midY + (rand() - 0.5) * 80;
      }
    }
    const dx = tx - pl.x, dy = ty - pl.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    pl.vx += (dx / d) * 0.7; pl.vy += (dy / d) * 0.7;
    pl.vx += (rand() - 0.5) * 0.25; pl.vy += (rand() - 0.5) * 0.25;
    pl.vx *= 0.92; pl.vy *= 0.92;
    const ms = pl.role === 'gk' ? 6.5 : 9;
    const sp = Math.sqrt(pl.vx * pl.vx + pl.vy * pl.vy);
    if (sp > ms) { pl.vx = (pl.vx / sp) * ms; pl.vy = (pl.vy / sp) * ms; }
    pl.x += pl.vx; pl.y += pl.vy;
  });

  // Referee
  const rtx = ball.x + (ball.x > midX ? -45 : 45), rty = ball.y + 30;
  const rdx = rtx - referee.x, rdy = rty - referee.y, rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
  referee.vx += (rdx / rd) * 0.2; referee.vy += (rdy / rd) * 0.2;
  referee.vx *= 0.93; referee.vy *= 0.93;
  referee.x += referee.vx; referee.y += referee.vy;
  bounceRect(referee, s);

  // Stuck
  const bmd = Math.sqrt((ball.x - s.lastBallX) ** 2 + (ball.y - s.lastBallY) ** 2);
  if (bmd < ball.r) s.stuckTimer++; else { s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y; }
  if (s.stuckTimer >= 60) {
    s.foulFlash = 40;
    const atk = ball.x < midX ? 0 : 1;
    teams[atk === 0 ? 1 : 0].fouls++;
    ball.vx = (midX - ball.x) * 0.06 + (rand() - 0.5) * 7;
    ball.vy = (midY - ball.y) * 0.06 + (rand() - 0.5) * 7;
    players.forEach(pl => { if (pl.team !== atk) { pl.x = pl.team === 0 ? px + pw / 4 : px + pw * 3 / 4; pl.y = midY + (rand() - 0.5) * 200; pl.vx = 0; pl.vy = 0; } });
    s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y;
  }

  ball.vx *= 0.997; ball.vy *= 0.997; ball.x += ball.vx; ball.y += ball.vy;
  bounceRect(ball, s);
  players.forEach(pl => { bounceRect(pl, s); collide(pl, ball); });
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) collide(players[i], players[j]);
  collide(referee, ball);
  players.forEach(pl => collide(referee, pl));

  // Goals
  let scored = -1;
  if (ball.x < px && ball.y > gTop && ball.y < gBot) scored = 1;
  if (ball.x > px + pw && ball.y > gTop && ball.y < gBot) scored = 0;
  if (scored >= 0) {
    teams[scored].score++;
    const elapsed = 90 * (s.timerFrames / s.totalFrames);
    const m = Math.floor(elapsed / 60), sec = Math.floor(elapsed % 60).toString().padStart(2, '0');
    goalLog.push({ team: scored, timeStr: `${m}'${sec}` });
    s.goalFlash = 30;
    resetPos(s);
    s.kickoff = true; s.kickoffTimer = 30; s.stuckTimer = 0;
  }
  if (s.foulFlash > 0) s.foulFlash--;
  if (s.goalFlash > 0) s.goalFlash--;
}

// ============== DRAW ==============
function drawFrame(ctx, s) {
  const { px, py, pw, ph, midX, midY, goalW, goalH, gTop, gBot, teams, players, referee, ball, goalLog } = s;
  const c = ctx;
  c.save(); c.scale(SCALE, SCALE);

  // BG
  c.fillStyle = '#1B7339'; c.fillRect(0, 0, W, H);

  // === SCOREBOARD (reference style with flag bars) ===
  const sbY = 180, sbW = 750, sbH = 75;
  const sx = W / 2 - sbW / 2;
  // Left flag bg
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(sx, sbY, sbW * 0.32, sbH, [14, 0, 0, 14]); c.clip(); }
  const lf = teams[0].flag || [];
  const ld = sbW * 0.32;
  lf.forEach(f => { c.fillStyle = f[0]; c.fillRect(sx + f[1] * ld, sbY + f[2] * sbH, f[3] * ld, f[4] * sbH); });
  c.restore();
  // Score left
  c.fillStyle = teams[0].color; c.fillRect(sx + sbW * 0.32, sbY, sbW * 0.1, sbH);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 48px Inter, sans-serif';
  c.fillText(teams[0].score, sx + sbW * 0.37, sbY + 54);
  // Timer center
  c.fillStyle = '#B8860B'; c.fillRect(sx + sbW * 0.42, sbY, sbW * 0.16, sbH);
  const tSecs = Math.max(0, 90 * (1 - s.timerFrames / s.totalFrames));
  const mins = Math.floor(tSecs / 60).toString().padStart(2, '0');
  const secs = Math.floor(tSecs % 60).toString().padStart(2, '0');
  c.fillStyle = '#fff'; c.font = 'bold 30px Fira Code, monospace';
  c.fillText(`${mins}:${secs}`, sx + sbW * 0.5, sbY + 50);
  // Score right
  c.fillStyle = teams[1].color; c.fillRect(sx + sbW * 0.58, sbY, sbW * 0.1, sbH);
  c.fillStyle = '#fff'; c.font = 'bold 48px Inter, sans-serif';
  c.fillText(teams[1].score, sx + sbW * 0.63, sbY + 54);
  // Right flag bg
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(sx + sbW * 0.68, sbY, sbW * 0.32, sbH, [0, 14, 14, 0]); c.clip(); }
  const rf = teams[1].flag || [];
  const rd2 = sbW * 0.32;
  rf.forEach(f => { c.fillStyle = f[0]; c.fillRect(sx + sbW * 0.68 + f[1] * rd2, sbY + f[2] * sbH, f[3] * rd2, f[4] * sbH); });
  c.restore();

  // === PITCH with neon glow ===
  c.fillStyle = '#22883F'; c.fillRect(px, py, pw, ph);
  c.save(); c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 18;
  c.strokeStyle = '#fff'; c.lineWidth = 5;
  c.strokeRect(px, py, pw, ph);
  c.beginPath(); c.moveTo(midX, py); c.lineTo(midX, py + ph); c.stroke();
  c.beginPath(); c.arc(midX, midY, 55, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(midX, midY, 4, 0, Math.PI * 2); c.fill();
  const penW = 80, penH = 250;
  c.strokeRect(px, midY - penH / 2, penW, penH);
  c.strokeRect(px + pw - penW, midY - penH / 2, penW, penH);
  c.restore();

  // === GOALS (white neon cages + net) ===
  for (let side = 0; side < 2; side++) {
    const gx = side === 0 ? px - goalW : px + pw;
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(gx, gTop, goalW, goalH);
    c.save(); c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 14;
    c.strokeStyle = '#fff'; c.lineWidth = 5;
    if (side === 0) { c.beginPath(); c.moveTo(px, gTop); c.lineTo(gx, gTop); c.lineTo(gx, gBot); c.lineTo(px, gBot); c.stroke(); }
    else { c.beginPath(); c.moveTo(px + pw, gTop); c.lineTo(gx + goalW, gTop); c.lineTo(gx + goalW, gBot); c.lineTo(px + pw, gBot); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
    for (let ny = gTop + 10; ny < gBot; ny += 10) { c.beginPath(); c.moveTo(gx, ny); c.lineTo(gx + goalW, ny); c.stroke(); }
    for (let nx = 0; nx < goalW; nx += 7) { c.beginPath(); c.moveTo(gx + nx, gTop); c.lineTo(gx + nx, gBot); c.stroke(); }
  }

  // === FOOTBALL ===
  c.fillStyle = '#fff'; c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#555'; c.lineWidth = 1; c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.stroke();

  // === PLAYERS (countryballs with flag + eyes) ===
  const drawPlayer = (pl) => {
    const tm = teams[pl.team];
    c.save(); c.translate(pl.x, pl.y);
    // Body
    c.fillStyle = tm.color; c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.fill();
    // Flag clipped
    c.save(); c.beginPath(); c.arc(0, 0, pl.r, 0, Math.PI * 2); c.clip();
    const fl = tm.flag || [], d = pl.r * 2;
    fl.forEach(f => { c.fillStyle = f[0]; c.fillRect(-pl.r + f[1] * d, -pl.r + f[2] * d, f[3] * d, f[4] * d); });
    c.restore();
    // GK ring
    if (pl.role === 'gk') { c.strokeStyle = '#FFD700'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, pl.r + 2, 0, Math.PI * 2); c.stroke(); }
    // Eyes follow ball
    const ea = Math.atan2(ball.y - pl.y, ball.x - pl.x);
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-5, -3, 7, 9, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(5, -3, 7, 9, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(-5, -3, 7, 9, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(5, -3, 7, 9, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(-5 + Math.cos(ea) * 3, -3 + Math.sin(ea) * 3, 3.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(5 + Math.cos(ea) * 3, -3 + Math.sin(ea) * 3, 3.5, 0, Math.PI * 2); c.fill();
    c.restore();
  };
  players.forEach(drawPlayer);

  // === REFEREE ===
  c.save(); c.translate(referee.x, referee.y);
  c.fillStyle = '#111'; c.beginPath(); c.arc(0, 0, referee.r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#FFD700'; c.fillRect(-referee.r, -3, referee.r * 2, 6);
  const rea = Math.atan2(ball.y - referee.y, ball.x - referee.x);
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-4, -3, 5, 6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(4, -3, 5, 6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#000';
  c.beginPath(); c.arc(-4 + Math.cos(rea) * 2, -3 + Math.sin(rea) * 2, 2.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(4 + Math.cos(rea) * 2, -3 + Math.sin(rea) * 2, 2.5, 0, Math.PI * 2); c.fill();
  c.restore();

  // === GOAL LOG (large cards with timer) ===
  if (goalLog.length > 0) {
    const logY = py + ph + 15;
    goalLog.forEach((g, i) => {
      const cy2 = logY + i * 52;
      c.fillStyle = 'rgba(0,0,0,0.8)';
      if (c.roundRect) { c.beginPath(); c.roundRect(60, cy2, W - 120, 45, 10); c.fill(); }
      c.fillStyle = teams[g.team].color;
      if (c.roundRect) { c.beginPath(); c.roundRect(60, cy2, 7, 45, [10, 0, 0, 10]); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.12)';
      if (c.roundRect) { c.beginPath(); c.roundRect(82, cy2 + 8, 65, 28, 7); c.fill(); }
      c.fillStyle = '#4ADE80'; c.font = 'bold 20px Fira Code, monospace'; c.textAlign = 'center';
      c.fillText(g.timeStr, 114, cy2 + 29);
      c.fillStyle = '#fff'; c.font = 'bold 26px Inter, sans-serif'; c.textAlign = 'left';
      c.fillText(`\u26BD  ${teams[g.team].shortName} GOAL!`, 160, cy2 + 32);
    });
  }

  // === BOTTOM INFO CARD (reference style) ===
  const ibY = H - 200, ibW = 580, ibH = 120;
  const ibx = W / 2 - ibW / 2;
  c.fillStyle = '#fff';
  if (c.roundRect) { c.beginPath(); c.roundRect(ibx, ibY, ibW, ibH, 18); c.fill(); }
  // Left flag mini
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(ibx + 20, ibY + 20, 55, 35, 4); c.clip(); }
  const lf2 = teams[0].flag || [];
  lf2.forEach(f => { c.fillStyle = f[0]; c.fillRect(ibx + 20 + f[1] * 55, ibY + 20 + f[2] * 35, f[3] * 55, f[4] * 35); });
  c.restore();
  c.strokeStyle = '#ddd'; c.lineWidth = 1;
  if (c.roundRect) { c.beginPath(); c.roundRect(ibx + 20, ibY + 20, 55, 35, 4); c.stroke(); }
  // Right flag mini
  c.save();
  if (c.roundRect) { c.beginPath(); c.roundRect(ibx + ibW - 75, ibY + 20, 55, 35, 4); c.clip(); }
  const rf2 = teams[1].flag || [];
  rf2.forEach(f => { c.fillStyle = f[0]; c.fillRect(ibx + ibW - 75 + f[1] * 55, ibY + 20 + f[2] * 35, f[3] * 55, f[4] * 35); });
  c.restore();
  c.strokeStyle = '#ddd'; c.lineWidth = 1;
  if (c.roundRect) { c.beginPath(); c.roundRect(ibx + ibW - 75, ibY + 20, 55, 35, 4); c.stroke(); }
  // Text
  c.fillStyle = '#111'; c.textAlign = 'center'; c.font = 'bold 18px Inter, sans-serif';
  c.fillText('FIFA WORLD CUP 2026', ibx + ibW / 2, ibY + 38);
  c.font = 'bold 38px serif'; c.fillText('qualifiers', ibx + ibW / 2, ibY + 80);
  c.font = 'bold 13px Inter, sans-serif'; c.fillStyle = '#666';
  c.textAlign = 'left'; c.fillText(teams[0].shortName, ibx + 20, ibY + 75);
  c.textAlign = 'right'; c.fillText(teams[1].shortName, ibx + ibW - 20, ibY + 75);

  // === FOUL ===
  if (s.foulFlash > 0) {
    c.fillStyle = `rgba(255,255,0,${(s.foulFlash / 40) * 0.15})`; c.fillRect(0, 0, W, H);
    c.fillStyle = '#FFD700'; c.textAlign = 'center'; c.font = 'bold 46px Inter, sans-serif';
    c.fillText('FOUL!', W / 2, midY);
  }
  // === GOAL FLASH ===
  if (s.goalFlash > 0) { c.fillStyle = `rgba(255,255,255,${(s.goalFlash / 30) * 0.3})`; c.fillRect(0, 0, W, H); }
  // === KICKOFF ===
  if (s.kickoff && s.kickoffTimer > 0) {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(px, midY - 35, pw, 70);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 44px Inter, sans-serif';
    c.fillText(s.kickoffTimer > 20 ? 'KICK OFF!' : s.kickoffTimer > 10 ? '2' : '1', W / 2, midY + 14);
  }
  // === FULL TIME ===
  if (s.timerFrames >= s.totalFrames - 90) {
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(0, H / 2 - 90, W, 180);
    c.textAlign = 'center'; c.font = 'bold 28px Inter, sans-serif'; c.fillStyle = '#aaa';
    c.fillText('FULL TIME', W / 2, H / 2 - 50);
    c.font = 'bold 64px Inter, sans-serif'; c.fillStyle = '#fff';
    c.fillText(`${teams[0].score} - ${teams[1].score}`, W / 2, H / 2 + 10);
    c.font = 'bold 32px Inter, sans-serif'; c.fillStyle = '#FFD700';
    const w = teams[0].score > teams[1].score ? teams[0].name : teams[1].score > teams[0].score ? teams[1].name : 'DRAW';
    c.fillText(w === 'DRAW' ? 'DRAW!' : `${w} WINS!`, W / 2, H / 2 + 55);
  }
  // === MATCH INFO ===
  if (s.matchInfo) {
    c.fillStyle = '#fff'; c.globalAlpha = 0.4; c.textAlign = 'center'; c.font = '16px Inter, sans-serif';
    c.fillText(s.matchInfo, W / 2, H - 60); c.globalAlpha = 1;
  }
  c.restore();
}

// ============== PRE-COMPUTE EVENTS ==============
function precomputeEvents(seed, home, away, info, totalFrames) {
  const s = createState(seed, home, away, info);
  const events = [{ type: 'whistle', frame: 25 }];
  let lastGoals = 0, lastFoul = 0;
  for (let f = 0; f < totalFrames; f++) {
    stepSim(s);
    const goals = s.teams[0].score + s.teams[1].score;
    if (goals > lastGoals) { events.push({ type: 'goal', frame: f }); lastGoals = goals; }
    if (s.foulFlash > 0 && lastFoul === 0) events.push({ type: 'whistle', frame: f });
    lastFoul = s.foulFlash;
    if (f % 5 === 0 && Math.sqrt(s.ball.vx ** 2 + s.ball.vy ** 2) > 4) events.push({ type: 'kick', frame: f });
  }
  return events;
}

// ============== COMPONENT ==============
export const WorldCup = ({ homeTeam = 'FRA', awayTeam = 'SEN', seed = 42, matchInfo = '' }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  const audioEvents = useMemo(() => precomputeEvents(seed, homeTeam, awayTeam, matchInfo, durationInFrames), [seed, homeTeam, awayTeam, matchInfo, durationInFrames]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = createState(seed, homeTeam, awayTeam, matchInfo);
    for (let f = 0; f < frame; f++) stepSim(state);
    ctx.clearRect(0, 0, width, height);
    drawFrame(ctx, state);
  }, [frame, width, height, seed, homeTeam, awayTeam, matchInfo]);

  const bgmSrc = new URL('./audio/bgm.wav', import.meta.url).href;
  const crowdSrc = new URL('./audio/crowd.wav', import.meta.url).href;
  const goalSrc = new URL('./audio/goal.wav', import.meta.url).href;
  const whistleSrc = new URL('./audio/whistle.wav', import.meta.url).href;
  const kickSrc = new URL('./audio/kick.wav', import.meta.url).href;

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      <Audio src={bgmSrc} volume={0.25} />
      {Array.from({ length: 7 }).map((_, i) => (
        <Sequence key={`c${i}`} from={i * 300} durationInFrames={300}><Audio src={crowdSrc} volume={0.12} /></Sequence>
      ))}
      {audioEvents.map((e, i) => {
        if (e.type === 'goal') return <Sequence key={`g${i}`} from={e.frame} durationInFrames={75}><Audio src={goalSrc} volume={0.6} /></Sequence>;
        if (e.type === 'whistle') return <Sequence key={`w${i}`} from={e.frame} durationInFrames={25}><Audio src={whistleSrc} volume={0.5} /></Sequence>;
        if (e.type === 'kick') return <Sequence key={`k${i}`} from={e.frame} durationInFrames={5}><Audio src={kickSrc} volume={0.25} /></Sequence>;
        return null;
      })}
    </>
  );
};
