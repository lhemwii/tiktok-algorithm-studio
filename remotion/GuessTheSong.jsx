import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';
import { MARIO_SONG } from './mario-song';

// Piano sample imports
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

const W = 1080, H = 1920, SCALE = 2;
const SONGS = { mario: { notes: MARIO_SONG } };

// ============== MUSIC-DRIVEN SIMULATION ==============
// The music decides everything. Each note = a "hit" (spike or dead ball).
// The ball animates BETWEEN hits with smooth arcs.
// Timing is based on the tempo of the song.

function simulateAll(seed, songId, totalFrames) {
  const song = SONGS[songId] || SONGS.mario;
  const totalNotes = song.notes.length;
  const cx = W / 2, cy = H * 0.48, radius = 400;

  // Spikes
  const numSpikes = 40;
  const spikeLen = 70;
  const spikes = [];
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;
    const hue = (i * 360 / numSpikes) % 360;
    spikes.push({ angle, len: spikeLen, color: `hsl(${hue}, 85%, 55%)` });
  }

  // Ball colors
  const ballColors = [];
  for (let i = 0; i < 100; i++) ballColors.push(`hsl(${(i * 31 + 10) % 360}, 90%, 58%)`);

  const br = 36; // ball radius

  // Seeded random for choosing death spikes
  let rngSeed = seed || 42;
  const rand = () => { rngSeed = (rngSeed * 16807) % 2147483647; return (rngSeed - 1) / 2147483646; };

  // Spike tip position (where dead balls sit — ON the tip)
  function spikeTip(si) {
    const s = spikes[si % numSpikes];
    const tipDist = radius - spikeLen + br * 0.3; // ball sits right on the tip
    return { x: cx + Math.cos(s.angle) * tipDist, y: cy + Math.sin(s.angle) * tipDist };
  }

  // Choose death spikes — random left/right alternating, never same twice
  const usedSpikes = new Set();
  function pickDeathSpike() {
    // Pick from bottom half (pi/4 to 3pi/4 range = spikes 5-15 roughly)
    // and alternate left/right randomly
    for (let tries = 0; tries < 100; tries++) {
      const idx = Math.floor(rand() * numSpikes);
      if (!usedSpikes.has(idx)) {
        usedSpikes.add(idx);
        return idx;
      }
    }
    // Fallback
    for (let i = 0; i < numSpikes; i++) if (!usedSpikes.has(i)) { usedSpikes.add(i); return i; }
    return 0;
  }

  const deadBalls = [];
  const snapshots = [];
  const allEvents = [];
  let frame = 0;
  let attempt = 0;

  // Timing
  const bpm = 150;
  const framesPerNote = Math.floor(30 * 60 / bpm); // ~12 frames
  const deathPause = 10;

  // Start position — center
  const startX = cx, startY = cy;

  while (frame < totalFrames && attempt < 50) {
    const notesThisAttempt = attempt + 1;
    const color = ballColors[attempt % ballColors.length];
    const deathSpikeIdx = pickDeathSpike();
    const deathPos = spikeTip(deathSpikeIdx);

    // Build trajectory points:
    // start → deadBall[0] → deadBall[1] → ... → deathSpike
    // Each segment is a parabolic arc with gravity feel
    const waypoints = [{ x: startX, y: startY }];

    // Bounce off each previous dead ball in order
    for (let h = 0; h < notesThisAttempt - 1 && h < deadBalls.length; h++) {
      waypoints.push({ x: deadBalls[h].x, y: deadBalls[h].y });
    }

    // Final destination: spike tip (death)
    waypoints.push({ x: deathPos.x, y: deathPos.y });

    // Animate each segment with parabolic arc
    let noteIdx = 0;
    for (let seg = 0; seg < waypoints.length - 1; seg++) {
      const from = waypoints[seg];
      const to = waypoints[seg + 1];

      for (let f = 0; f < framesPerNote && frame < totalFrames; f++) {
        const t = f / framesPerNote;

        // Parabolic arc: ball goes UP first then DOWN (gravity feel)
        // Height of arc depends on distance between points
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const arcH = Math.min(150, dist * 0.4 + 40); // bigger arc for longer distances

        const bx = from.x + dx * t;
        // Gravity parabola: y = start + t*dy - arcH * 4*t*(1-t)
        const by = from.y + dy * t - arcH * 4 * t * (1 - t);

        snapshots.push({
          cx, cy, radius, spikes,
          ball: { x: bx, y: by, r: br, alive: true, color },
          deadBalls: deadBalls.map(d => ({ ...d })),
          attempt, notesThisAttempt, noteCount: seg + 1, totalNotes,
        });
        frame++;
      }

      // Note plays at arrival
      const songNoteIdx = noteIdx % totalNotes;
      allEvents.push({ type: 'note', noteFile: song.notes[songNoteIdx].file, frame: frame - 1 });
      noteIdx++;
    }

    // Ball dies on spike tip — freeze
    deadBalls.push({ x: deathPos.x, y: deathPos.y, r: br, color: '#555' });

    for (let f = 0; f < deathPause && frame < totalFrames; f++) {
      snapshots.push({
        cx, cy, radius, spikes,
        ball: { x: deathPos.x, y: deathPos.y, r: br, alive: false, color: '#555' },
        deadBalls: deadBalls.map(d => ({ ...d })),
        attempt, notesThisAttempt, noteCount: notesThisAttempt, totalNotes,
      });
      frame++;
    }

    attempt++;
  }

  // Fill remaining frames
  const lastSnap = snapshots[snapshots.length - 1];
  while (frame < totalFrames) { snapshots.push(lastSnap); frame++; }

  return { snapshots, allEvents };
}

// ============== DRAW ==============
function drawFrame(ctx, snap) {
  const { cx, cy, radius, spikes, ball, deadBalls, attempt, notesThisAttempt, noteCount, totalNotes } = snap;
  const c = ctx;
  c.save();
  c.scale(SCALE, SCALE);

  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);

  const textBase = cy - radius - 20;
  const barX = 150, barY = textBase - 12, barW = W - 300, barH = 8;
  c.fillStyle = '#333'; c.fillRect(barX, barY, barW, barH);
  c.fillStyle = '#4ADE80'; c.fillRect(barX, barY, barW * Math.min(1, notesThisAttempt / totalNotes), barH);

  c.fillStyle = '#666'; c.textAlign = 'center'; c.font = '600 24px Inter, sans-serif';
  c.fillText(`${notesThisAttempt} / ${totalNotes} notes`, W / 2, barY - 10);

  c.fillStyle = '#fff'; c.font = '800 40px Inter, sans-serif';
  c.fillText(`Essai #${attempt + 1}`, W / 2, barY - 48);

  c.font = '700 30px Inter, sans-serif'; c.fillStyle = '#4ADE80';
  c.fillText('Commente ta reponse !', W / 2, barY - 92);
  c.fillStyle = '#fff'; c.font = '900 52px Inter, sans-serif';
  c.fillText('GUESS THE SONG', W / 2, barY - 130);

  // Circle
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 20;
  c.strokeStyle = '#fff'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.stroke();
  c.restore();

  // Spikes
  const spikeLen = 70, hw = 26;
  spikes.forEach(spike => {
    const baseX = cx + Math.cos(spike.angle) * radius;
    const baseY = cy + Math.sin(spike.angle) * radius;
    const tipX = cx + Math.cos(spike.angle) * (radius - spikeLen);
    const tipY = cy + Math.sin(spike.angle) * (radius - spikeLen);
    const perpAngle = spike.angle + Math.PI / 2;
    c.fillStyle = spike.color;
    c.beginPath();
    c.moveTo(baseX + Math.cos(perpAngle) * hw, baseY + Math.sin(perpAngle) * hw);
    c.lineTo(tipX, tipY);
    c.lineTo(baseX - Math.cos(perpAngle) * hw, baseY - Math.sin(perpAngle) * hw);
    c.closePath();
    c.fill();
  });

  // Dead balls
  deadBalls.forEach(db => {
    c.fillStyle = db.color;
    c.beginPath(); c.arc(db.x, db.y, db.r, 0, Math.PI * 2); c.fill();
  });

  // Active ball
  if (ball.alive) {
    c.save();
    c.shadowColor = ball.color; c.shadowBlur = 15;
    c.fillStyle = ball.color;
    c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.35, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  c.restore();
}

// ============== COMPONENT ==============
export const GuessTheSong = ({ songId = 'mario', seed = 42 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  const { snapshots, allEvents } = useMemo(
    () => simulateAll(seed, songId, durationInFrames),
    [seed, songId, durationInFrames]
  );

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
        <Sequence key={`n${i}`} from={e.frame} durationInFrames={14}>
          <Audio src={PIANO[e.noteFile]} volume={0.8} />
        </Sequence>
      ))}
    </>
  );
};
