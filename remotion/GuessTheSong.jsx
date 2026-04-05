import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';

const W = 1080, H = 1920, SCALE = 2;

import { MARIO_NOTES } from './mario-notes';

// ============== SONG DATA ==============
const SONGS = {
  mario64: {
    name: '???',
    notes: MARIO_NOTES,
  },
  twinkle: {
    name: '???',
    notes: [262, 262, 392, 392, 440, 440, 392, 349, 349, 330, 330, 294, 294, 262,
      392, 392, 349, 349, 330, 330, 294, 392, 392, 349, 349, 330, 330, 294,
      262, 262, 392, 392, 440, 440, 392, 349, 349, 330, 330, 294, 294, 262],
  },
};

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ============== SIMULATION ==============
function initState(seed, songId) {
  const rand = seededRandom(seed);
  const song = SONGS[songId] || SONGS.twinkle;
  const totalNotes = song.notes.length;

  // Circle arena
  const cx = W / 2, cy = H * 0.45, radius = 380;

  // Generate spikes inside the circle (random positions on the inner wall)
  const numSpikes = 24;
  const spikes = [];
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2 + rand() * 0.1;
    const spikeLen = 35 + rand() * 25;
    // Color cycling
    const hue = (i * 360 / numSpikes + 30) % 360;
    spikes.push({ angle, len: spikeLen, color: `hsl(${hue}, 80%, 55%)` });
  }

  // Ball colors for each attempt
  const ballColors = [];
  for (let i = 0; i < totalNotes + 5; i++) {
    const hue = (i * 37 + 10) % 360;
    ballColors.push(`hsl(${hue}, 85%, 60%)`);
  }

  return {
    rand, cx, cy, radius, spikes, song, totalNotes, ballColors,
    // Simulation state
    currentAttempt: 0,
    noteIndex: 0, // which note we're on in this attempt
    ball: { x: cx, y: cy - radius + 60, vx: 0, vy: 0, r: 16, alive: true, color: ballColors[0] },
    deadBalls: [], // { x, y, r, color: 'grey' }
    phase: 'dropping', // 'dropping' | 'playing_notes' | 'dead' | 'respawn'
    phaseTimer: 0,
    noteTimer: 0,
    notesPlayedThisAttempt: 0,
    totalFrames: 30 * 65,
    frameCount: 0,
    events: [], // { type: 'note', frame, freq } or { type: 'death', frame }
  };
}

function stepSim(s) {
  s.events = [];
  s.frameCount++;
  const { rand, cx, cy, radius, spikes, ball, deadBalls, song, ballColors } = s;

  if (s.phase === 'dropping') {
    // Ball falls with gravity
    ball.vy += 0.4; // gravity
    ball.vx += (rand() - 0.5) * 0.3; // slight random wobble
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off circle walls
    const dx = ball.x - cx, dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist + ball.r > radius) {
      const nx = dx / dist, ny = dy / dist;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx * 0.7;
      ball.vy -= 2 * dot * ny * 0.7;
      ball.x = cx + nx * (radius - ball.r - 1);
      ball.y = cy + ny * (radius - ball.r - 1);
    }

    // Bounce off dead balls
    deadBalls.forEach(db => {
      const dbx = ball.x - db.x, dby = ball.y - db.y;
      const dbd = Math.sqrt(dbx * dbx + dby * dby);
      if (dbd < ball.r + db.r) {
        const dnx = dbx / dbd, dny = dby / dbd;
        const ddot = ball.vx * dnx + ball.vy * dny;
        if (ddot < 0) {
          ball.vx -= 2 * ddot * dnx * 0.6;
          ball.vy -= 2 * ddot * dny * 0.6;
          ball.x = db.x + dnx * (ball.r + db.r + 1);
          ball.y = db.y + dny * (ball.r + db.r + 1);
        }
      }
    });

    // Check spike collision
    const ballAngle = Math.atan2(ball.y - cy, ball.x - cx);
    const ballDist = Math.sqrt((ball.x - cx) ** 2 + (ball.y - cy) ** 2);

    for (const spike of spikes) {
      // Spike tip position
      const tipX = cx + Math.cos(spike.angle) * (radius - spike.len);
      const tipY = cy + Math.sin(spike.angle) * (radius - spike.len);
      const tipDist = Math.sqrt((ball.x - tipX) ** 2 + (ball.y - tipY) ** 2);

      if (tipDist < ball.r + 12) {
        // HIT SPIKE — play note and die
        s.phase = 'dead';
        s.phaseTimer = 0;
        ball.alive = false;

        // Play note for this attempt
        const noteIdx = Math.min(s.currentAttempt, song.notes.length - 1);
        s.events.push({ type: 'note', freq: song.notes[noteIdx] });
        s.events.push({ type: 'death' });

        // Add dead ball
        deadBalls.push({ x: ball.x, y: ball.y, r: ball.r, color: '#555' });
        break;
      }
    }

    // Play notes as ball bounces (each bounce = one note of the sequence)
    // Actually: each ATTEMPT plays all notes from 0 to currentAttempt
    // The note plays on the first frame of dropping
    if (s.phaseTimer === 0 && s.notesPlayedThisAttempt < s.currentAttempt) {
      // Play accumulated notes quickly
    }

    s.phaseTimer++;

    // If ball settles (speed very low near bottom), force death
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < 0.5 && s.phaseTimer > 60) {
      s.phase = 'dead';
      ball.alive = false;
      const noteIdx = Math.min(s.currentAttempt, song.notes.length - 1);
      s.events.push({ type: 'note', freq: song.notes[noteIdx] });
      s.events.push({ type: 'death' });
      deadBalls.push({ x: ball.x, y: ball.y, r: ball.r, color: '#555' });
    }

  } else if (s.phase === 'dead') {
    s.phaseTimer++;
    // Short pause then respawn
    if (s.phaseTimer > 20) {
      s.currentAttempt++;
      if (s.currentAttempt >= s.totalNotes) {
        s.phase = 'dropping'; // keep going, it'll just bounce on dead balls
      }
      // New ball from top
      const newColor = ballColors[s.currentAttempt % ballColors.length];
      ball.x = cx + (rand() - 0.5) * 100;
      ball.y = cy - radius + 50;
      ball.vx = (rand() - 0.5) * 3;
      ball.vy = 2;
      ball.r = 16;
      ball.alive = true;
      ball.color = newColor;
      s.phase = 'dropping';
      s.phaseTimer = 0;
      s.notesPlayedThisAttempt = 0;
    }
  }
}

// Pre-compute all frames
function simulateAll(seed, songId, totalFrames) {
  const s = initState(seed, songId);
  const snapshots = [];
  const allEvents = [];

  for (let f = 0; f < totalFrames; f++) {
    stepSim(s);
    snapshots.push({
      ball: { ...s.ball },
      deadBalls: s.deadBalls.map(db => ({ ...db })),
      currentAttempt: s.currentAttempt,
      phase: s.phase,
      cx: s.cx, cy: s.cy, radius: s.radius,
      spikes: s.spikes,
      songName: s.song.name,
      totalNotes: s.totalNotes,
      frameCount: s.frameCount,
      totalFrames: s.totalFrames,
    });
    s.events.forEach(e => allEvents.push({ ...e, frame: f }));
  }
  return { snapshots, allEvents };
}

// ============== DRAW ==============
function drawFrame(ctx, snap) {
  const { cx, cy, radius, spikes, ball, deadBalls, currentAttempt, songName, totalNotes } = snap;
  const c = ctx;
  c.save();
  c.scale(SCALE, SCALE);

  // Black background
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);

  // Title
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.font = '900 52px Inter, sans-serif';
  c.fillText('GUESS THE SONG', W / 2, 120);

  c.font = '700 30px Inter, sans-serif';
  c.fillStyle = '#4ADE80';
  c.fillText('Commente ta reponse !', W / 2, 170);

  // Attempt counter
  c.fillStyle = '#fff';
  c.font = '800 36px Inter, sans-serif';
  c.fillText(`Essai #${currentAttempt + 1}`, W / 2, 230);

  // Note progress
  c.fillStyle = '#666';
  c.font = '600 24px Inter, sans-serif';
  c.fillText(`${Math.min(currentAttempt + 1, totalNotes)} / ${totalNotes} notes`, W / 2, 270);

  // Progress bar
  const barX = 150, barY = 285, barW = W - 300, barH = 8;
  c.fillStyle = '#333';
  c.fillRect(barX, barY, barW, barH);
  c.fillStyle = '#4ADE80';
  c.fillRect(barX, barY, barW * Math.min(1, (currentAttempt + 1) / totalNotes), barH);

  // Circle arena — white glow
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.5)';
  c.shadowBlur = 20;
  c.strokeStyle = '#fff';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // Spikes — colored triangles pointing inward
  spikes.forEach(spike => {
    const baseX = cx + Math.cos(spike.angle) * radius;
    const baseY = cy + Math.sin(spike.angle) * radius;
    const tipX = cx + Math.cos(spike.angle) * (radius - spike.len);
    const tipY = cy + Math.sin(spike.angle) * (radius - spike.len);
    const perpAngle = spike.angle + Math.PI / 2;
    const halfWidth = 10;
    const lx = baseX + Math.cos(perpAngle) * halfWidth;
    const ly = baseY + Math.sin(perpAngle) * halfWidth;
    const rx = baseX - Math.cos(perpAngle) * halfWidth;
    const ry = baseY - Math.sin(perpAngle) * halfWidth;

    c.fillStyle = spike.color;
    c.beginPath();
    c.moveTo(lx, ly);
    c.lineTo(tipX, tipY);
    c.lineTo(rx, ry);
    c.closePath();
    c.fill();
  });

  // Dead balls (grey corpses)
  deadBalls.forEach(db => {
    c.fillStyle = db.color;
    c.beginPath();
    c.arc(db.x, db.y, db.r, 0, Math.PI * 2);
    c.fill();
  });

  // Active ball
  if (ball.alive) {
    c.save();
    c.shadowColor = ball.color;
    c.shadowBlur = 15;
    c.fillStyle = ball.color;
    c.beginPath();
    c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    c.fill();
    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    c.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.35, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Bottom text
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.textAlign = 'center';
  c.font = '600 22px Inter, sans-serif';
  c.fillText('Quelle est cette chanson ?', W / 2, H - 120);

  // Scrolling ticker
  const tickerY = H - 70;
  c.fillStyle = '#4ADE80';
  c.font = '800 26px Inter, sans-serif';
  c.textAlign = 'left';
  const tickerText = 'COMMENTE TA REPONSE !     \u{1F3B5}     COMMENTE TA REPONSE !     \u{1F3B5}     ';
  const tickerW = c.measureText(tickerText).width;
  const tickerOff = -((snap.frameCount * 4) % tickerW);
  for (let tx = tickerOff; tx < W; tx += tickerW) {
    c.fillText(tickerText, tx, tickerY);
  }

  c.restore();
}

// ============== AUDIO — pre-generated WAV files ==============
function getNoteUrl(freq) {
  return new URL(`./audio/notes/note_${freq}.wav`, import.meta.url).href;
}

// ============== COMPONENT ==============
export const GuessTheSong = ({ songId = 'twinkle', seed = 42 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  const { snapshots, allEvents } = useMemo(
    () => simulateAll(seed, songId, durationInFrames),
    [seed, songId, durationInFrames]
  );

  // Map note frequencies to pre-generated WAV file URLs
  const noteAudioMap = useMemo(() => {
    const song = SONGS[songId] || SONGS.twinkle;
    const uniqueFreqs = [...new Set(song.notes)];
    const map = {};
    uniqueFreqs.forEach(freq => { map[freq] = getNoteUrl(freq); });
    return map;
  }, [songId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (snapshots[frame]) drawFrame(ctx, snapshots[frame]);
  }, [frame, width, height, snapshots]);

  const noteEvents = allEvents.filter(e => e.type === 'note' && e.freq && noteAudioMap[e.freq]);

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      {noteEvents.map((e, i) => (
        <Sequence key={`note-${i}`} from={e.frame} durationInFrames={12}>
          <Audio src={noteAudioMap[e.freq]} volume={0.6} />
        </Sequence>
      ))}
    </>
  );
};
