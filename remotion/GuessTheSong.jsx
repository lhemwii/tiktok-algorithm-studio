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

  // Circle arena — centered vertically
  const cx = W / 2, cy = H * 0.48, radius = 400;

  // Spikes ALL around the inside of the circle — big, thick, colorful
  const numSpikes = 40;
  const spikes = [];
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;
    const spikeLen = 70; // all same height, wider
    const hue = (i * 360 / numSpikes) % 360;
    spikes.push({ angle, len: spikeLen, color: `hsl(${hue}, 85%, 55%)` });
  }

  // Ball colors — bright, each attempt different
  const ballColors = [];
  for (let i = 0; i < totalNotes + 5; i++) {
    const hue = (i * 31 + 10) % 360;
    ballColors.push(`hsl(${hue}, 90%, 58%)`);
  }

  return {
    rand, cx, cy, radius, spikes, song, totalNotes, ballColors,
    currentAttempt: 0,
    noteIndex: 0,
    // Ball spawns at CENTER of circle
    ball: { x: cx, y: cy, vx: (rand() - 0.5) * 4, vy: -3, r: 36, alive: true, color: ballColors[0] },
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
    ball.vy += 0.8; // strong gravity — falls fast
    ball.vx += (rand() - 0.5) * 0.3; // slight random wobble
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off circle walls — BUT check spike zones first
    const dx = ball.x - cx, dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ballAngle = Math.atan2(dy, dx);

    if (dist + ball.r > radius - 5) {
      // Ball is near the wall — check if it's in a spike zone
      let hitSpike = false;
      if (s.phaseTimer > 20) { // immune first 20 frames
        const spikeAngleWidth = (2 * Math.PI / spikes.length) * 0.7; // angular width of spike zone
        for (const spike of spikes) {
          let angleDiff = ballAngle - spike.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) < spikeAngleWidth / 2) {
            // IN SPIKE ZONE — die!
            hitSpike = true;
            s.phase = 'dead';
            s.phaseTimer = 0;
            ball.alive = false;
            const noteIdx = Math.min(s.currentAttempt, song.notes.length - 1);
            s.events.push({ type: 'note', freq: song.notes[noteIdx] });
            s.events.push({ type: 'death' });
            // Place dead ball INSIDE the circle (away from spikes)
            const deadDist = radius - spike.len - ball.r - 5;
            const deadX = cx + Math.cos(spike.angle) * deadDist;
            const deadY = cy + Math.sin(spike.angle) * deadDist;
            deadBalls.push({ x: deadX, y: deadY, r: ball.r, color: '#555' });
            break;
          }
        }
      }

      if (!hitSpike) {
        // Safe wall bounce (between spikes)
        const nx = dx / dist, ny = dy / dist;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx * 0.75;
        ball.vy -= 2 * dot * ny * 0.75;
        ball.x = cx + nx * (radius - ball.r - 2);
        ball.y = cy + ny * (radius - ball.r - 2);
        s.events.push({ type: 'bounce' });
      }
    }

    // Bounce off dead balls
    deadBalls.forEach(db => {
      const dbx = ball.x - db.x, dby = ball.y - db.y;
      const dbd = Math.sqrt(dbx * dbx + dby * dby);
      if (dbd < ball.r + db.r) {
        const dnx = dbx / dbd, dny = dby / dbd;
        const ddot = ball.vx * dnx + ball.vy * dny;
        if (ddot < 0) {
          ball.vx -= 2 * ddot * dnx * 0.65;
          ball.vy -= 2 * ddot * dny * 0.65;
          ball.x = db.x + dnx * (ball.r + db.r + 1);
          ball.y = db.y + dny * (ball.r + db.r + 1);
          s.events.push({ type: 'bounce' });
        }
      }
    });

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
      // Respawn at CENTER with random direction
      ball.x = cx + (rand() - 0.5) * 40;
      ball.y = cy + (rand() - 0.5) * 40;
      ball.vx = (rand() - 0.5) * 5;
      ball.vy = (rand() - 0.5) * 5;
      ball.r = 36;
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

  // Text positioned just above the circle (circle top = cy - radius)
  const textBase = cy - radius - 20; // 20px gap above circle

  // Progress bar
  const barX = 150, barY = textBase - 15, barW = W - 300, barH = 8;
  c.fillStyle = '#333';
  c.fillRect(barX, barY, barW, barH);
  c.fillStyle = '#4ADE80';
  c.fillRect(barX, barY, barW * Math.min(1, (currentAttempt + 1) / totalNotes), barH);

  // Note progress
  c.fillStyle = '#666';
  c.textAlign = 'center';
  c.font = '600 24px Inter, sans-serif';
  c.fillText(`${Math.min(currentAttempt + 1, totalNotes)} / ${totalNotes} notes`, W / 2, barY - 12);

  // Attempt counter
  c.fillStyle = '#fff';
  c.font = '800 36px Inter, sans-serif';
  c.fillText(`Essai #${currentAttempt + 1}`, W / 2, barY - 48);

  // Subtitle
  c.font = '700 30px Inter, sans-serif';
  c.fillStyle = '#4ADE80';
  c.fillText('Commente ta reponse !', W / 2, barY - 92);

  // Title
  c.fillStyle = '#fff';
  c.font = '900 52px Inter, sans-serif';
  c.fillText('GUESS THE SONG', W / 2, barY - 132);

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
    const halfWidth = 26; // very thick spikes
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

  // (bottom area left clean)

  c.restore();
}

// ============== AUDIO — static imports for each note ==============
import note_392 from './audio/notes/note_392.wav';
import note_415 from './audio/notes/note_415.wav';
import note_440 from './audio/notes/note_440.wav';
import note_466 from './audio/notes/note_466.wav';
import note_554 from './audio/notes/note_554.wav';
import note_587 from './audio/notes/note_587.wav';
import note_622 from './audio/notes/note_622.wav';
import note_659 from './audio/notes/note_659.wav';
import note_698 from './audio/notes/note_698.wav';
import note_784 from './audio/notes/note_784.wav';
import note_831 from './audio/notes/note_831.wav';
import note_880 from './audio/notes/note_880.wav';
import note_932 from './audio/notes/note_932.wav';
import note_1109 from './audio/notes/note_1109.wav';
import note_1175 from './audio/notes/note_1175.wav';
import note_1245 from './audio/notes/note_1245.wav';

const NOTE_FILES = {
  392: note_392, 415: note_415, 440: note_440, 466: note_466,
  554: note_554, 587: note_587, 622: note_622, 659: note_659,
  698: note_698, 784: note_784, 831: note_831, 880: note_880,
  932: note_932, 1109: note_1109, 1175: note_1175, 1245: note_1245,
};

function getNoteUrl(freq) {
  return NOTE_FILES[freq] || null;
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
  const bounceEvents = allEvents.filter(e => e.type === 'bounce');
  const bounceSrc = new URL('./audio/bounce.wav', import.meta.url).href;

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      {noteEvents.map((e, i) => (
        <Sequence key={`note-${i}`} from={e.frame} durationInFrames={12}>
          <Audio src={noteAudioMap[e.freq]} volume={0.7} />
        </Sequence>
      ))}
      {bounceEvents.filter((_, i) => i % 2 === 0).map((e, i) => (
        <Sequence key={`bnc-${i}`} from={e.frame} durationInFrames={5}>
          <Audio src={bounceSrc} volume={0.2} />
        </Sequence>
      ))}
    </>
  );
};
