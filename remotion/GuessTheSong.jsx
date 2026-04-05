import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';
import { MARIO_SONG } from './mario-song';

// Piano imports
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

// ============== REAL PHYSICS SIMULATION ==============
function simulateAll(seed, songId, totalFrames) {
  const song = SONGS[songId] || SONGS.mario;
  const totalNotes = song.notes.length;
  let rng = seed || 42;
  const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };

  const cx = W / 2, cy = H * 0.48, radius = 400;
  const numSpikes = 40, spikeLen = 70;
  const spikeAngleWidth = (2 * Math.PI / numSpikes) * 0.65;
  const spikes = [];
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;
    const hue = (i * 360 / numSpikes) % 360;
    spikes.push({ angle, len: spikeLen, color: `hsl(${hue}, 85%, 55%)`, covered: false });
  }

  const ballColors = [];
  for (let i = 0; i < 200; i++) ballColors.push(`hsl(${(i * 31 + 10) % 360}, 90%, 58%)`);

  const br = 32;
  const deadBalls = [];
  const snapshots = [];
  const allEvents = [];
  let frame = 0;
  let attempt = 0;
  let globalNoteIdx = 0;
  let noteCooldown = 0; // prevent double notes

  while (frame < totalFrames) {
    // New ball at center
    let bx = cx, by = cy - 20;
    let bvx = 0, bvy = 0;
    let alive = true;
    let immunity = 10;
    let noteCount = 0;
    const color = ballColors[attempt % ballColors.length];

    // Spawn pause
    for (let p = 0; p < 6 && frame < totalFrames; p++) {
      snapshots.push({ cx, cy, radius, spikes: spikes.map(s => ({...s})), ball: { x: bx, y: by, r: br, alive: true, color }, deadBalls: deadBalls.map(d => ({ ...d })), attempt, noteCount, totalNotes, globalNoteIdx });
      frame++;
    }

    // Physics loop
    while (alive && frame < totalFrames) {
      // Gravity
      bvy += 0.6;
      bx += bvx;
      by += bvy;
      if (immunity > 0) immunity--;
      if (noteCooldown > 0) noteCooldown--;

      // Check SPIKE collision first — hitbox at spike TIP level
      const dx = bx - cx, dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const tipRadius = radius - spikeLen; // distance from center to spike tips

      if (immunity <= 0) {
        // Check each spike: is ball touching the spike tip zone?
        for (const spike of spikes) {
          if (spike.covered) continue;
          // Spike tip position
          const tipX = cx + Math.cos(spike.angle) * tipRadius;
          const tipY = cy + Math.sin(spike.angle) * tipRadius;
          const tipDist = Math.sqrt((bx - tipX) ** 2 + (by - tipY) ** 2);

          if (tipDist < br + 10) { // ball touches spike tip area
            // DIE RIGHT HERE — no teleportation
            if (noteCooldown <= 0) {
              const ni = globalNoteIdx % totalNotes;
              allEvents.push({ type: 'note', noteFile: song.notes[ni].file, frame });
              globalNoteIdx++;
              noteCount++;
            }
            bvx = 0; bvy = 0;
            alive = false;
            spike.covered = true;
            deadBalls.push({ x: bx, y: by, r: br, color: '#555' });
            snapshots.push({ cx, cy, radius, spikes: spikes.map(s => ({...s})), ball: { x: bx, y: by, r: br, alive: false, color: '#555' }, deadBalls: deadBalls.map(d => ({ ...d })), attempt, noteCount, totalNotes, globalNoteIdx });
            frame++;
            break;
          }
        }
        if (!alive) continue; // skip rest of physics, go to death pause
      }

      // Circle WALL collision (between spikes = safe bounce)
      if (dist + br > radius - 3) {
        const nx = dx / dist, ny = dy / dist;
        // Bounce off wall — strong rebound + sideways kick
        const dot = bvx * nx + bvy * ny;
        bvx -= 2 * dot * nx * 0.92;
        bvy -= 2 * dot * ny * 0.92;
        // Consistent sideways kick (NOT random — same trajectory each time)
        const perpX = -ny, perpY = nx;
        const kickDir = (nx * bvy - ny * bvx) > 0 ? 1 : -1; // deterministic based on velocity
        bvx += perpX * kickDir * 3;
        bvy += perpY * kickDir * 3;
        bx = cx + nx * (radius - br - 2);
        by = cy + ny * (radius - br - 2);
        // Play note
        if (noteCooldown <= 0) {
          const ni = globalNoteIdx % totalNotes;
          allEvents.push({ type: 'note', noteFile: song.notes[ni].file, frame });
          globalNoteIdx++;
          noteCount++;
          noteCooldown = 4;
        }
      }

      // Dead ball collisions — check ALL, enforce separation, bounce off EDGE
      if (alive) {
        for (const db of deadBalls) {
          const dbx = bx - db.x, dby = by - db.y;
          const dbd = Math.sqrt(dbx * dbx + dby * dby);
          const minDist = br + db.r;
          if (dbd < minDist && dbd > 0.1) {
            const dnx = dbx / dbd, dny = dby / dbd;
            // FORCE separate — ball edge touches dead ball edge, no overlap
            bx = db.x + dnx * (minDist + 2);
            by = db.y + dny * (minDist + 2);
            // Strong rebound
            const ddot = bvx * dnx + bvy * dny;
            if (ddot < 0) { // only if approaching
              bvx -= 2 * ddot * dnx * 0.9;
              bvy -= 2 * ddot * dny * 0.9;
              // Deterministic sideways kick (same trajectory every time)
              const dperpX = -dny, dperpY = dnx;
              const dkickDir = (dnx * bvy - dny * bvx) > 0 ? 1 : -1;
              bvx += dperpX * dkickDir * 3;
              bvy += dperpY * dkickDir * 3;
              // Upward boost
              bvy -= 3;
              // Play note
              if (noteCooldown <= 0) {
                const ni = globalNoteIdx % totalNotes;
                allEvents.push({ type: 'note', noteFile: song.notes[ni].file, frame });
                globalNoteIdx++;
                noteCount++;
                noteCooldown = 4;
              }
            }
            // DON'T break — check all dead balls for overlap
          }
        }
      }

      // Speed limit
      const spd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (spd > 18) { bvx = (bvx / spd) * 18; bvy = (bvy / spd) * 18; }
      // Minimum speed — keep moving
      if (spd < 1 && alive && immunity <= 0) {
        bvx += (rand() - 0.5) * 2;
        bvy += 1;
      }

      snapshots.push({ cx, cy, radius, spikes: spikes.map(s => ({...s})), ball: { x: bx, y: by, r: br, alive, color }, deadBalls: deadBalls.map(d => ({ ...d })), attempt, noteCount, totalNotes, globalNoteIdx });
      frame++;
    }

    // Reset note index for next attempt
    globalNoteIdx = 0;
    noteCount = 0;
    attempt++;

    // Death pause
    for (let p = 0; p < 8 && frame < totalFrames; p++) {
      snapshots.push({ cx, cy, radius, spikes: spikes.map(s => ({...s})), ball: { x: bx, y: by, r: br, alive: false, color: '#555' }, deadBalls: deadBalls.map(d => ({ ...d })), attempt, noteCount: 0, totalNotes, globalNoteIdx: 0 });
      frame++;
    }
  }

  // Fill remaining
  const last = snapshots[snapshots.length - 1];
  while (snapshots.length < totalFrames) snapshots.push(last);

  return { snapshots, allEvents };
}

// ============== DRAW ==============
function drawFrame(ctx, snap) {
  const { cx, cy, radius, spikes, ball, deadBalls, attempt, noteCount, totalNotes, globalNoteIdx } = snap;
  const c = ctx;
  c.save(); c.scale(SCALE, SCALE);

  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);

  const textBase = cy - radius - 20;
  c.fillStyle = '#fff'; c.textAlign = 'center';
  c.font = '900 52px Inter, sans-serif';
  c.fillText('GUESS THE SONG', W / 2, textBase - 100);
  c.font = '700 30px Inter, sans-serif'; c.fillStyle = '#4ADE80';
  c.fillText('Commente ta reponse !', W / 2, textBase - 60);
  c.fillStyle = '#fff'; c.font = '800 40px Inter, sans-serif';
  c.fillText(`Essai #${attempt + 1}`, W / 2, textBase - 18);
  // Real-time note counter
  c.fillStyle = '#4ADE80'; c.font = '800 28px Fira Code, monospace';
  c.fillText(`${noteCount} notes`, W / 2, textBase + 14);

  // Circle
  c.save(); c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 20;
  c.strokeStyle = '#fff'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.stroke();
  c.restore();

  // Spikes
  const hw = 26;
  spikes.forEach(spike => {
    // Always draw ALL spikes — dead balls sit on top of them
    const baseX = cx + Math.cos(spike.angle) * radius;
    const baseY = cy + Math.sin(spike.angle) * radius;
    const tipX = cx + Math.cos(spike.angle) * (radius - spike.len);
    const tipY = cy + Math.sin(spike.angle) * (radius - spike.len);
    const pa = spike.angle + Math.PI / 2;
    c.fillStyle = spike.color;
    c.beginPath();
    c.moveTo(baseX + Math.cos(pa) * hw, baseY + Math.sin(pa) * hw);
    c.lineTo(tipX, tipY);
    c.lineTo(baseX - Math.cos(pa) * hw, baseY - Math.sin(pa) * hw);
    c.closePath(); c.fill();
  });

  // Dead balls
  deadBalls.forEach(db => {
    c.fillStyle = db.color;
    c.beginPath(); c.arc(db.x, db.y, db.r, 0, Math.PI * 2); c.fill();
  });

  // Active ball
  if (ball.alive) {
    c.save(); c.shadowColor = ball.color; c.shadowBlur = 15;
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
        <Sequence key={`n${i}`} from={e.frame} durationInFrames={12}>
          <Audio src={PIANO[e.noteFile]} volume={0.8} />
        </Sequence>
      ))}
    </>
  );
};
