import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';

const W = 1080, H = 1920, SCALE = 2;

import { MARIO_SONG } from './mario-song';

// ============== SONG DATA ==============
const SONGS = {
  mario: {
    name: '???',
    notes: MARIO_SONG, // array of { note, file }
  },
};

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ============== SIMULATION ==============
function initState(seed, songId) {
  const rand = seededRandom(seed);
  const song = SONGS[songId] || SONGS.mario;
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
            s.events.push({ type: 'note', noteFile: song.notes[noteIdx].file });
            s.events.push({ type: 'death' });
            // Place dead ball at the spike base (just inside the spike tips)
            const deadDist = radius - spike.len + ball.r;
            const deadX = cx + Math.cos(spike.angle) * deadDist;
            const deadY = cy + Math.sin(spike.angle) * deadDist;
            // Move ball to death position and freeze it
            ball.x = deadX; ball.y = deadY;
            ball.vx = 0; ball.vy = 0;
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
      s.events.push({ type: 'note', noteFile: song.notes[noteIdx].file });
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

// ============== AUDIO — real piano samples (MIDI note numbers 48-84) ==============
import p48 from './audio/piano/note_48.wav'; import p49 from './audio/piano/note_49.wav';
import p50 from './audio/piano/note_50.wav'; import p51 from './audio/piano/note_51.wav';
import p52 from './audio/piano/note_52.wav'; import p53 from './audio/piano/note_53.wav';
import p54 from './audio/piano/note_54.wav'; import p55 from './audio/piano/note_55.wav';
import p56 from './audio/piano/note_56.wav'; import p57 from './audio/piano/note_57.wav';
import p58 from './audio/piano/note_58.wav'; import p59 from './audio/piano/note_59.wav';
import p60 from './audio/piano/note_60.wav'; import p61 from './audio/piano/note_61.wav';
import p62 from './audio/piano/note_62.wav'; import p63 from './audio/piano/note_63.wav';
import p64 from './audio/piano/note_64.wav'; import p65 from './audio/piano/note_65.wav';
import p66 from './audio/piano/note_66.wav'; import p67 from './audio/piano/note_67.wav';
import p68 from './audio/piano/note_68.wav'; import p69 from './audio/piano/note_69.wav';
import p70 from './audio/piano/note_70.wav'; import p71 from './audio/piano/note_71.wav';
import p72 from './audio/piano/note_72.wav'; import p73 from './audio/piano/note_73.wav';
import p74 from './audio/piano/note_74.wav'; import p75 from './audio/piano/note_75.wav';
import p76 from './audio/piano/note_76.wav'; import p77 from './audio/piano/note_77.wav';
import p78 from './audio/piano/note_78.wav'; import p79 from './audio/piano/note_79.wav';
import p80 from './audio/piano/note_80.wav'; import p81 from './audio/piano/note_81.wav';
import p82 from './audio/piano/note_82.wav'; import p83 from './audio/piano/note_83.wav';
import p84 from './audio/piano/note_84.wav';

const PIANO = {
  'note_48.wav': p48, 'note_49.wav': p49, 'note_50.wav': p50, 'note_51.wav': p51,
  'note_52.wav': p52, 'note_53.wav': p53, 'note_54.wav': p54, 'note_55.wav': p55,
  'note_56.wav': p56, 'note_57.wav': p57, 'note_58.wav': p58, 'note_59.wav': p59,
  'note_60.wav': p60, 'note_61.wav': p61, 'note_62.wav': p62, 'note_63.wav': p63,
  'note_64.wav': p64, 'note_65.wav': p65, 'note_66.wav': p66, 'note_67.wav': p67,
  'note_68.wav': p68, 'note_69.wav': p69, 'note_70.wav': p70, 'note_71.wav': p71,
  'note_72.wav': p72, 'note_73.wav': p73, 'note_74.wav': p74, 'note_75.wav': p75,
  'note_76.wav': p76, 'note_77.wav': p77, 'note_78.wav': p78, 'note_79.wav': p79,
  'note_80.wav': p80, 'note_81.wav': p81, 'note_82.wav': p82, 'note_83.wav': p83,
  'note_84.wav': p84,
};

// ============== COMPONENT ==============
export const GuessTheSong = ({ songId = 'twinkle', seed = 42 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  const { snapshots, allEvents } = useMemo(
    () => simulateAll(seed, songId, durationInFrames),
    [seed, songId, durationInFrames]
  );

  // Piano audio map — no computation needed, PIANO object is static

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (snapshots[frame]) drawFrame(ctx, snapshots[frame]);
  }, [frame, width, height, snapshots]);

  const noteEvents = allEvents.filter(e => e.type === 'note' && e.noteFile && PIANO[e.noteFile]);

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      {noteEvents.map((e, i) => (
        <Sequence key={`note-${i}`} from={e.frame} durationInFrames={15}>
          <Audio src={PIANO[e.noteFile]} volume={0.8} />
        </Sequence>
      ))}
    </>
  );
};
