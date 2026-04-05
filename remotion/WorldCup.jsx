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
  // Pitch starts right after scoreboard (sbY+sbH+goalH+12 ≈ 362)
  const px = 60, py = 420, pw = 880, ph = 1150;
  const midX = px + pw / 2, midY = py + ph / 2;
  // Goals: big visible cages above/below
  const goalW = 280, goalH = 60;
  const gLeft = midX - goalW / 2, gRight = midX + goalW / 2;
  const PR = 57; // 50% bigger players (was 38)
  const teams = getTeamPair(homeCode, awayCode);
  const players = [
    // Team 0 attacks DOWN, defends TOP goal
    { x: midX, y: py + 70, vx: 0, vy: 0, r: PR, team: 0, role: 'gk' },
    { x: midX - 160, y: midY - 160, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    { x: midX + 160, y: midY - 160, vx: 0, vy: 0, r: PR, team: 0, role: 'field' },
    // Team 1 attacks UP, defends BOTTOM goal
    { x: midX, y: py + ph - 70, vx: 0, vy: 0, r: PR, team: 1, role: 'gk' },
    { x: midX - 160, y: midY + 160, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
    { x: midX + 160, y: midY + 160, vx: 0, vy: 0, r: PR, team: 1, role: 'field' },
  ];
  const referee = { x: midX + 80, y: midY, vx: 0, vy: 0, r: PR };
  // Ball 50% bigger (was 18), starts with strong velocity toward a goal for instant action
  const ballDir = rand() > 0.5 ? 1 : -1;
  const ball = { x: midX + (rand() - 0.5) * 100, y: midY, vx: (rand() - 0.5) * 8, vy: ballDir * 15, r: 27 };
  return {
    rand, px, py, pw, ph, midX, midY, goalW, goalH, gLeft, gRight, teams, players, referee, ball,
    goalLog: [], foulLog: [], stuckTimer: 0, lastBallX: midX, lastBallY: midY,
    foulFlash: 0, goalFlash: 0, kickoff: false, kickoffTimer: 0,
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
  players[1].x = midX - 150; players[1].y = midY - 150;
  players[2].x = midX + 150; players[2].y = midY - 150;
  players[3].x = midX; players[3].y = py + ph - 55;
  players[4].x = midX - 150; players[4].y = midY + 150;
  players[5].x = midX + 150; players[5].y = midY + 150;
  players.forEach(p => { p.vx = 0; p.vy = 0; });
  referee.x = midX + 70; referee.y = midY; referee.vx = 0; referee.vy = 0;
}

function stepSim(s) {
  s.events = []; // clear events for this frame
  const { rand, px, py, pw, ph, midX, midY, gLeft, gRight, players, ball, referee, teams, goalLog, foulLog } = s;

  // Timer ALWAYS ticks
  s.timerFrames++;
  // No kickoff pause — action never stops

  // AI — ULTRA AGGRESSIVE. Everyone rushes the ball. GK included.
  players.forEach(pl => {
    const oppGoalY = pl.team === 0 ? py + ph : py;
    const ownGoalY = pl.team === 0 ? py : py + ph;
    let tx, ty;
    if (pl.role === 'gk') {
      // GK: aggressive but STAYS IN GOAL ZONE. Never leaves the cage area.
      // Track ball X aggressively within goal width
      tx = midX + (ball.x - midX) * 0.95;
      tx = Math.max(gLeft + 5, Math.min(gRight - 5, tx));
      // Stay on goal line — only go a tiny bit forward
      const goalLineY = ownGoalY + (pl.team === 0 ? 30 : -30);
      ty = goalLineY;
      // If ball is VERY close to goal, rush toward ball but still clamp Y
      if (Math.abs(ball.y - ownGoalY) < 100) {
        tx = ball.x;
        tx = Math.max(gLeft - 10, Math.min(gRight + 10, tx));
        ty = ball.y;
        // Clamp Y to goal zone — never more than goalH/2 from goal line
        const maxDist = s.goalH / 2 + 20;
        if (pl.team === 0) ty = Math.min(py + maxDist, Math.max(py - s.goalH, ty));
        else ty = Math.max(py + ph - maxDist, Math.min(py + ph + s.goalH, ty));
      }
    } else {
      // Field: ALWAYS rush the ball, get behind it to smash toward goal
      const gdx = midX - ball.x, gdy = oppGoalY - ball.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      tx = ball.x - (gdx / gd) * (ball.r + pl.r + 3);
      ty = ball.y - (gdy / gd) * (ball.r + pl.r + 3);
      const dist = Math.sqrt((pl.x - ball.x) ** 2 + (pl.y - ball.y) ** 2);
      // When close, RAM the ball toward goal
      if (dist < 70) { tx = ball.x + (gdx / gd) * 12; ty = ball.y + (gdy / gd) * 12; }
      // Anti-corner
      if ((pl.y < py + 30 || pl.y > py + ph - 30) && (pl.x < px + 30 || pl.x > px + pw - 30)) {
        tx = midX + (rand() - 0.5) * 100; ty = midY + (rand() - 0.5) * 100;
      }
    }
    const dx = tx - pl.x, dy = ty - pl.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const accel = pl.role === 'gk' ? 1.15 : 1.5; // faster for bigger pitch
    pl.vx += (dx / d) * accel; pl.vy += (dy / d) * accel;
    pl.vx += (rand() - 0.5) * 0.4; pl.vy += (rand() - 0.5) * 0.4;
    pl.vx *= 0.90; pl.vy *= 0.90;
    const ms = pl.role === 'gk' ? 10 : 16; // faster for bigger pitch
    const sp = Math.sqrt(pl.vx * pl.vx + pl.vy * pl.vy);
    if (sp > ms) { pl.vx = (pl.vx / sp) * ms; pl.vy = (pl.vy / sp) * ms; }
    pl.x += pl.vx; pl.y += pl.vy;
  });

  // Referee — follows action but NEVER touches ball. Repels from ball.
  const refDist = Math.sqrt((referee.x - ball.x) ** 2 + (referee.y - ball.y) ** 2);
  const refMinDist = referee.r + ball.r + 30; // keep 30px gap from ball
  if (refDist < refMinDist) {
    // REPEL — push referee away from ball
    const repelX = (referee.x - ball.x) / refDist;
    const repelY = (referee.y - ball.y) / refDist;
    referee.vx += repelX * 1.5;
    referee.vy += repelY * 1.5;
  } else {
    // Follow action at safe distance
    const rtx = ball.x + (ball.x > midX ? -60 : 60);
    const rty = ball.y + (ball.y > midY ? -50 : 50);
    const rdx = rtx - referee.x, rdy = rty - referee.y, rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
    referee.vx += (rdx / rd) * 0.25; referee.vy += (rdy / rd) * 0.25;
  }
  referee.vx *= 0.92; referee.vy *= 0.92;
  const rspd = Math.sqrt(referee.vx * referee.vx + referee.vy * referee.vy);
  if (rspd > 8) { referee.vx = (referee.vx / rspd) * 8; referee.vy = (referee.vy / rspd) * 8; }
  referee.x += referee.vx; referee.y += referee.vy;
  bounceRect(referee, s);

  // Stuck detection — if ball stays within a ~50px zone for 2s = foul
  // This catches the "vibrating between two players" case where speed > 0 but position barely changes
  const stuckZoneRadius = 35; // smaller zone = faster foul detection
  const distFromAnchor = Math.sqrt((ball.x - s.lastBallX) ** 2 + (ball.y - s.lastBallY) ** 2);
  if (distFromAnchor < stuckZoneRadius) {
    s.stuckTimer++;
  } else {
    // Ball escaped the zone — reset anchor to current position
    s.stuckTimer = 0;
    s.lastBallX = ball.x;
    s.lastBallY = ball.y;
  }
  if (s.stuckTimer >= 30) { // 1 second instead of 2 — faster foul
    s.foulFlash = 75; // 2.5 seconds visible
    const atk = ball.y < midY ? 0 : 1;
    teams[atk === 0 ? 1 : 0].fouls++;
    const foulTeam = atk === 0 ? 1 : 0;
    const elapsed = 90 * (s.timerFrames / s.totalFrames);
    foulLog.push({ team: foulTeam, timeStr: `${Math.floor(elapsed / 60)}'${Math.floor(elapsed % 60).toString().padStart(2, '0')}` });
    // STRONG kick toward center
    ball.vx = (midX - ball.x) * 0.12 + (rand() - 0.5) * 14;
    ball.vy = (midY - ball.y) * 0.12 + (rand() - 0.5) * 14;
    players.forEach(pl => { if (pl.team !== atk) { pl.y = pl.team === 0 ? py + ph / 4 : py + ph * 3 / 4; pl.x = midX + (rand() - 0.5) * 200; pl.vx = 0; pl.vy = 0; } });
    s.stuckTimer = 0; s.lastBallX = ball.x; s.lastBallY = ball.y;
    s.events.push('whistle');
  }

  // Ball — FASTER, less friction, more energy
  ball.vx *= 0.999; ball.vy *= 0.999; ball.x += ball.vx; ball.y += ball.vy;
  // Minimum ball speed — if too slow, give it a nudge
  const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (ballSpeed < 2.5 && !s.kickoff) {
    ball.vx += (rand() - 0.5) * 3;
    ball.vy += (rand() - 0.5) * 3;
  }
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
  // Referee NEVER touches ball — force separation if too close
  const rbDist = Math.sqrt((referee.x - ball.x) ** 2 + (referee.y - ball.y) ** 2);
  if (rbDist < referee.r + ball.r + 5) {
    const rnx = (referee.x - ball.x) / rbDist;
    const rny = (referee.y - ball.y) / rbDist;
    referee.x = ball.x + rnx * (referee.r + ball.r + 6);
    referee.y = ball.y + rny * (referee.r + ball.r + 6);
    referee.vx += rnx * 3; referee.vy += rny * 3;
  }
  // Referee is STRONGER than players — players bounce off him harder
  players.forEach(pl => {
    const pd = Math.sqrt((referee.x - pl.x) ** 2 + (referee.y - pl.y) ** 2);
    if (pd < referee.r + pl.r && pd > 0) {
      const pnx = (pl.x - referee.x) / pd, pny = (pl.y - referee.y) / pd;
      pl.vx += pnx * 3; pl.vy += pny * 3; // player gets pushed back hard
      referee.vx -= pnx * 0.5; referee.vy -= pny * 0.5; // referee barely moves
      pl.x = referee.x + pnx * (referee.r + pl.r + 1);
      pl.y = referee.y + pny * (referee.r + pl.r + 1);
    }
  });

  // Goals — VERTICAL: top goal = team 0 defends, bottom goal = team 1 defends
  let scored = -1;
  if (ball.y < py && ball.x > gLeft && ball.x < gRight) scored = 1; // ball goes through top → team 1 scores
  if (ball.y > py + ph && ball.x > gLeft && ball.x < gRight) scored = 0; // ball goes through bottom → team 0 scores
  if (scored >= 0) {
    teams[scored].score++;
    const elapsed = 90 * (s.timerFrames / s.totalFrames);
    goalLog.push({ team: scored, timeStr: `${Math.floor(elapsed / 60)}'${Math.floor(elapsed % 60).toString().padStart(2, '0')}` });
    s.goalFlash = 90; // 3 seconds visible
    resetPos(s);
    s.stuckTimer = 0;
    // No pause — ball gets strong velocity immediately after goal
    ball.vx = (rand() - 0.5) * 8;
    ball.vy = (rand() > 0.5 ? 1 : -1) * (12 + rand() * 5);
    s.events.push('goal');
  }
  if (s.foulFlash > 0) s.foulFlash--;
  if (s.goalFlash > 0) s.goalFlash--;
}

// Run entire simulation, store snapshot per frame + events
function simulateAll(seed, home, away, info, totalFrames) {
  const s = initState(seed, home, away, info);
  const snapshots = [];
  const allEvents = []; // no opening whistle — match starts instantly

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


  // SCOREBOARD — single row, compact:
  // [FLAG/NAME] [SCORE] [TIMER] [SCORE] [FLAG/NAME]
  // SCOREBOARD — full width flags, full country names, scores tight around timer
  // [FLAG——————] [SCORE] [TIMER] [SCORE] [FLAG——————]
  // [  NAME    ]                         [   NAME   ]
  const sbX = px;
  const sbY = 190;
  const sbW = pw;
  const sbH = 130;
  drawGlassPanel(sbX, sbY, sbW, sbH, 20);

  const sbMidY = sbY + sbH / 2;
  const centerCX = sbX + sbW / 2;

  // Timer — center pill — goes 00:00 → 90:00 (match minutes) over 65 real seconds
  const matchMinutes = Math.min(90, 90 * (snap.timerFrames / snap.totalFrames));
  const mins = Math.floor(matchMinutes).toString().padStart(2, '0');
  const secs = Math.floor((matchMinutes % 1) * 60).toString().padStart(2, '0');
  c.save();
  c.translate(centerCX, sbMidY - 4);
  c.scale(pulse, pulse);
  c.fillStyle = '#1a3328';
  roundRect(-58, -22, 116, 44, 14);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1.5;
  roundRect(-58, -22, 116, 44, 14); c.stroke();
  c.fillStyle = '#fff'; c.font = '900 32px Fira Code, monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`${mins}:${secs}`, 0, 0);
  c.restore();

  // Scores — space for 2 digits each side
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#fff'; c.font = '900 60px Inter, sans-serif';
  c.fillText(String(teams[0].score), centerCX - 100, sbMidY - 4);
  c.fillText(String(teams[1].score), centerCX + 100, sbMidY - 4);

  // Left side: wide flag stretched from edge to score area
  const scoreEdgeL = centerCX - 140; // leave room for 2-digit score
  const flagMargin = 10;
  const lFlagX = sbX + flagMargin;
  const lFlagW = scoreEdgeL - lFlagX - 8;
  const flagH = 34;
  const flagY = sbY + 14;
  c.save();
  roundRect(lFlagX, flagY, lFlagW, flagH, 8); c.clip();
  drawFlag(c, teams[0].flag, lFlagX, flagY, lFlagW, flagH);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
  roundRect(lFlagX, flagY, lFlagW, flagH, 8); c.stroke();
  // Team name glued under flag
  c.fillStyle = '#fff'; c.font = '800 22px Inter, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(teams[0].name, lFlagX + lFlagW / 2, flagY + flagH + 4);
  // Yellow cards under team name
  for (let yc = 0; yc < teams[0].fouls; yc++) {
    c.fillStyle = '#f4c845';
    roundRect(lFlagX + lFlagW / 2 - 8 + yc * 20 - (teams[0].fouls - 1) * 10, flagY + flagH + 30, 14, 20, 3);
    c.fill();
  }

  // Right side: wide flag
  const scoreEdgeR = centerCX + 140;
  const rFlagX = scoreEdgeR + 8;
  const rFlagW = sbX + sbW - flagMargin - rFlagX;
  c.save();
  roundRect(rFlagX, flagY, rFlagW, flagH, 8); c.clip();
  drawFlag(c, teams[1].flag, rFlagX, flagY, rFlagW, flagH);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
  roundRect(rFlagX, flagY, rFlagW, flagH, 8); c.stroke();
  // Team name glued under flag
  c.fillStyle = '#fff'; c.font = '800 22px Inter, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(teams[1].name, rFlagX + rFlagW / 2, flagY + flagH + 4);
  // Yellow cards under team name
  for (let yc = 0; yc < teams[1].fouls; yc++) {
    c.fillStyle = '#f4c845';
    roundRect(rFlagX + rFlagW / 2 - 8 + yc * 20 - (teams[1].fouls - 1) * 10, flagY + flagH + 30, 14, 20, 3);
    c.fill();
  }

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
  c.shadowColor = 'rgba(255,255,255,0.6)';
  c.shadowBlur = 38;
  c.strokeStyle = '#fff';
  c.lineWidth = 10;
  // Rounded corners pitch
  roundRect(px, py, pw, ph, 24);
  c.stroke();
  // Center line (horizontal for vertical pitch)
  c.beginPath(); c.moveTo(px, midY); c.lineTo(px + pw, midY); c.stroke();
  // Center circle
  c.beginPath(); c.arc(midX, midY, 95, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(midX, midY, 7, 0, Math.PI * 2); c.fill();
  // Penalty areas (horizontal bars at top and bottom)
  const penW = 360, penH = 145;
  c.strokeRect(midX - penW / 2, py, penW, penH);
  c.strokeRect(midX - penW / 2, py + ph - penH, penW, penH);
  c.restore();

  // GOALS (top and bottom) — rounded corners, same bg green, neon frame
  const drawGoal = (isTop) => {
    const gy = isTop ? py - goalH : py + ph;
    const gyEnd = isTop ? gy : gy + goalH;
    const gyStart = isTop ? py : py + ph;
    const gw = gRight - gLeft;
    const yMin = Math.min(gyStart, gyEnd);

    // Background — same green as main background
    c.fillStyle = '#0d5f35';
    if (isTop) {
      roundRect(gLeft, gy, gw, goalH, [16, 16, 0, 0]);
    } else {
      roundRect(gLeft, py + ph, gw, goalH, [0, 0, 16, 16]);
    }
    c.fill();

    // Net pattern
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1.5;
    for (let nx = gLeft + 14; nx < gRight; nx += 14) {
      c.beginPath(); c.moveTo(nx, gyStart); c.lineTo(nx, gyEnd); c.stroke();
    }
    for (let ny = 1; ny < goalH; ny += 12) {
      const yy = yMin + ny;
      c.beginPath(); c.moveTo(gLeft, yy); c.lineTo(gRight, yy); c.stroke();
    }

    // Frame — thick white neon with rounded corners
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.6)';
    c.shadowBlur = 20;
    c.strokeStyle = '#fff';
    c.lineWidth = 10;
    c.beginPath();
    if (isTop) {
      const cr = 16;
      c.moveTo(gLeft, py);
      c.lineTo(gLeft, gy + cr);
      c.quadraticCurveTo(gLeft, gy, gLeft + cr, gy);
      c.lineTo(gRight - cr, gy);
      c.quadraticCurveTo(gRight, gy, gRight, gy + cr);
      c.lineTo(gRight, py);
    } else {
      const cr = 16;
      c.moveTo(gLeft, py + ph);
      c.lineTo(gLeft, gyEnd - cr);
      c.quadraticCurveTo(gLeft, gyEnd, gLeft + cr, gyEnd);
      c.lineTo(gRight - cr, gyEnd);
      c.quadraticCurveTo(gRight, gyEnd, gRight, gyEnd - cr);
      c.lineTo(gRight, py + ph);
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
    // Eyes — no border
    const es = pl.r / 25;
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
  const res = referee.r / 25;
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-8 * res, -4 * res, 9 * res, 12 * res, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8 * res, -4 * res, 9 * res, 12 * res, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111';
  c.beginPath(); c.arc(-8 * res + Math.cos(rea) * 3.5 * res, -4 * res + Math.sin(rea) * 3.5 * res, 4 * res, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(8 * res + Math.cos(rea) * 3.5 * res, -4 * res + Math.sin(rea) * 3.5 * res, 4 * res, 0, Math.PI * 2); c.fill();
  c.restore();


  if (snap.foulFlash > 0) {
    c.fillStyle = `rgba(244,200,69,${(snap.foulFlash / 75) * 0.24})`;
    c.fillRect(0, 0, W, H);
    // YELLOW CARD — centered in pitch, white with glow
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.6)'; c.shadowBlur = 20;
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = '900 76px Inter, sans-serif';
    c.fillText('CARTON JAUNE', midX, midY);
    c.restore();
  }
  if (snap.goalFlash > 0) {
    c.fillStyle = `rgba(255,255,255,${(snap.goalFlash / 90) * 0.26})`;
    c.fillRect(0, 0, W, H);
  }

  // === HOOK OVERLAY — REMOVED (match starts with instant action) ===
  if (false) {
    c.restore();
  }

  // === TENSION MOMENTS ===
  const totalGoals = teams[0].score + teams[1].score;
  // Pitch upper quarter for tension text
  const pitchTopQuarter = py + ph / 4;

  // TIED alert — inside pitch upper quarter, white with glow, visible for ~2.5s
  if (teams[0].score === teams[1].score && totalGoals > 0 && snap.goalFlash > 10 && snap.goalFlash < 85) {
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 20;
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = '900 52px Inter, sans-serif';
    c.fillText('EGALITE !  Qui va marquer ?', midX, pitchTopQuarter);
    c.restore();
  }
  // COMEBACK alert — inside pitch upper quarter, white with glow, visible for ~2.5s
  if (snap.goalFlash > 10 && snap.goalFlash < 85) {
    const lastGoal = goalLog.length > 0 ? goalLog[goalLog.length - 1] : null;
    if (lastGoal) {
      const scoringTeam = lastGoal.team;
      const otherTeam = scoringTeam === 0 ? 1 : 0;
      if (teams[scoringTeam].score >= teams[otherTeam].score && goalLog.filter(g => g.team === scoringTeam).length > 1) {
        c.save();
        c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 20;
        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.font = '900 62px Inter, sans-serif';
        c.fillText('REMONTADA ?!', midX, pitchTopQuarter);
        c.restore();
      }
    }
  }

  // === FINAL COUNTDOWN (last 10 real seconds = 300 frames) ===
  const framesLeft = snap.totalFrames - snap.timerFrames;
  if (framesLeft <= 300 && framesLeft > 90) {
    const countdownNum = Math.ceil(framesLeft / 30);
    const pulse2 = 1 + Math.sin(snap.timerFrames * 0.3) * 0.1;
    c.save();
    c.translate(midX, midY);
    c.scale(pulse2, pulse2);
    c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 25;
    c.fillStyle = `rgba(255,255,255,${Math.min(1, (framesLeft - 90) / 60) * 0.7})`;
    c.textAlign = 'center';
    c.font = '900 140px Inter, sans-serif';
    c.fillText(countdownNum, 0, 50);
    c.restore();
  }

  // === FULL TIME + WERE YOU RIGHT (last 3 seconds = 90 frames) ===
  if (framesLeft <= 90) {
    // Glassmorphism panel centered in pitch
    const ftH = 300;
    const ftY = midY - ftH / 2;
    drawGlassPanel(px + 20, ftY, pw - 40, ftH, 22);
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.font = '700 30px Inter, sans-serif';
    c.fillText('COUP DE SIFFLET FINAL', midX, ftY + 45);
    c.fillStyle = '#fff';
    c.font = '900 90px Inter, sans-serif';
    c.fillText(`${teams[0].score} - ${teams[1].score}`, midX, ftY + 130);
    c.fillStyle = '#f4c845';
    c.font = '800 38px Inter, sans-serif';
    const winner = teams[0].score > teams[1].score ? teams[0].name : teams[1].score > teams[0].score ? teams[1].name : 'NUL';
    c.fillText(winner === 'NUL' ? 'MATCH NUL' : `${winner} GAGNE !`, midX, ftY + 185);
    // WERE YOU RIGHT — inside the glassmorphism panel
    c.fillStyle = '#4ADE80';
    c.font = '900 32px Inter, sans-serif';
    c.fillText('Tu avais raison ?  \uD83D\uDC40', midX, ftY + 235);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '700 24px Inter, sans-serif';
    c.fillText('Commente le score exact pour apparaitre !', midX, ftY + 275);
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
