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

// ============== SIMULATION ==============
// Key concept: each attempt replays the EXACT same physics from frame 0.
// The only difference is more dead balls from previous attempts.
// Each bounce/collision = play next note. When noteCount for this attempt
// is reached = ball dies on that spike.

function simulateAll(seed, songId, totalFrames) {
  const song = SONGS[songId] || SONGS.mario;
  const totalNotes = song.notes.length;

  const cx = W / 2, cy = H * 0.48, radius = 400;

  // Spikes — uniform, all around
  const numSpikes = 40;
  const spikeLen = 70;
  const spikeAngleWidth = (2 * Math.PI / numSpikes) * 0.7;
  const spikes = [];
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;
    const hue = (i * 360 / numSpikes) % 360;
    spikes.push({ angle, len: spikeLen, color: `hsl(${hue}, 85%, 55%)` });
  }

  // Ball colors
  const ballColors = [];
  for (let i = 0; i < totalNotes + 5; i++) {
    ballColors.push(`hsl(${(i * 31 + 10) % 360}, 90%, 58%)`);
  }

  // State
  const deadBalls = []; // permanent across attempts
  const snapshots = [];
  const allEvents = [];
  let attempt = 0;
  let globalNoteIndex = 0; // which note of the song we're at globally

  // Drop point — center top, ball falls straight to bottom wall first
  const dropX = cx;
  const dropY = cy - 50; // center-ish, slightly above middle

  let frame = 0;

  while (frame < totalFrames && attempt < totalNotes) {
    const notesThisAttempt = attempt + 1;
    let noteCount = 0;
    let ballAlive = true;

    // Ball starts at drop point, falls straight down
    let bx = dropX, by = dropY, bvx = 0, bvy = 0;
    const br = 36;
    let immunity = 12;
    let physFrames = 0;

    // Spawn pause (8 frames)
    for (let p = 0; p < 8 && frame < totalFrames; p++) {
      snapshots.push({
        cx, cy, radius, spikes,
        ball: { x: bx, y: by, r: br, alive: true, color: ballColors[attempt % ballColors.length] },
        deadBalls: deadBalls.map(d => ({ ...d })),
        attempt, notesThisAttempt, noteCount, totalNotes,
      });
      frame++;
    }

    while (ballAlive && frame < totalFrames) {
      bvy += 0.8; // gravity
      bx += bvx; by += bvy;
      if (immunity > 0) immunity--;
      physFrames++;

      // --- CIRCLE WALL COLLISION ---
      const dx = bx - cx, dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist + br > radius - 2 && immunity <= 0) {
        const ballAngle = Math.atan2(dy, dx);

        // Check if in a spike zone
        let hitSpike = null;
        for (const spike of spikes) {
          let ad = ballAngle - spike.angle;
          while (ad > Math.PI) ad -= Math.PI * 2;
          while (ad < -Math.PI) ad += Math.PI * 2;
          if (Math.abs(ad) < spikeAngleWidth / 2) { hitSpike = spike; break; }
        }

        if (hitSpike) {
          // HIT A SPIKE — play note, then die or bounce
          if (globalNoteIndex < totalNotes) {
            allEvents.push({ type: 'note', noteFile: song.notes[globalNoteIndex].file, frame });
            globalNoteIndex++;
          }
          noteCount++;

          if (noteCount >= notesThisAttempt) {
            // *** DIE INSTANTLY on spike TIP — freeze at tip position ***
            const tipDist = radius - spikeLen + br; // ball center sits right at tip
            bx = cx + Math.cos(hitSpike.angle) * tipDist;
            by = cy + Math.sin(hitSpike.angle) * tipDist;
            bvx = 0; bvy = 0;
            ballAlive = false;
            deadBalls.push({ x: bx, y: by, r: br, color: '#555' });
            // Push snapshot with dead ball immediately
            snapshots.push({
              cx, cy, radius, spikes,
              ball: { x: bx, y: by, r: br, alive: false, color: '#555' },
              deadBalls: deadBalls.map(d => ({ ...d })),
              attempt, notesThisAttempt, noteCount, totalNotes,
            });
            frame++;
            break; // exit physics loop immediately
          } else {
            // Bounce off spike with velocity — goes sideways
            const nx = dx / dist, ny = dy / dist;
            const dot = bvx * nx + bvy * ny;
            bvx -= 2 * dot * nx * 0.75;
            bvy -= 2 * dot * ny * 0.75;
            // Add sideways kick so ball doesn't just go straight
            const perpX = -ny, perpY = nx;
            const kick = (ballAngle > hitSpike.angle ? 1 : -1) * 3;
            bvx += perpX * kick;
            bvy += perpY * kick;
            bx = cx + (dx / dist) * (radius - br - 5);
            by = cy + (dy / dist) * (radius - br - 5);
          }
        } else {
          // Safe wall (between spikes) — just bounce, play note
          const nx = dx / dist, ny = dy / dist;
          const dot = bvx * nx + bvy * ny;
          bvx -= 2 * dot * nx * 0.78;
          bvy -= 2 * dot * ny * 0.78;
          bx = cx + (dx / dist) * (radius - br - 3);
          by = cy + (dy / dist) * (radius - br - 3);

          if (globalNoteIndex < totalNotes) {
            allEvents.push({ type: 'note', noteFile: song.notes[globalNoteIndex].file, frame });
            globalNoteIndex++;
          }
          noteCount++;
          // *** NEVER die on safe wall — keep bouncing ***
        }
      }

      // --- DEAD BALL COLLISION --- play note, bounce with kick, NEVER die
      if (ballAlive) {
        for (const db of deadBalls) {
          const dbx = bx - db.x, dby = by - db.y;
          const dbd = Math.sqrt(dbx * dbx + dby * dby);
          if (dbd < br + db.r && dbd > 0) {
            // Always bounce off dead balls
            const dnx = dbx / dbd, dny = dby / dbd;
            const ddot = bvx * dnx + bvy * dny;
            // Reflect + strong sideways kick
            bvx -= 2 * ddot * dnx * 0.7;
            bvy -= 2 * ddot * dny * 0.7;
            // Kick sideways so ball goes left or right
            const perpX = -dny, perpY = dnx;
            const kickDir = (bx > db.x) ? 1 : -1;
            bvx += perpX * kickDir * 4;
            bvy += perpY * kickDir * 4;
            // Separate
            bx = db.x + dnx * (br + db.r + 3);
            by = db.y + dny * (br + db.r + 3);

            if (globalNoteIndex < totalNotes) {
              allEvents.push({ type: 'note', noteFile: song.notes[globalNoteIndex].file, frame });
              globalNoteIndex++;
            }
            noteCount++;
            break;
          }
        }
      }

      // Speed limit
      const spd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (spd > 18) { bvx = (bvx / spd) * 18; bvy = (bvy / spd) * 18; }

      snapshots.push({
        cx, cy, radius, spikes,
        ball: { x: bx, y: by, r: br, alive: ballAlive, color: ballColors[attempt % ballColors.length] },
        deadBalls: deadBalls.map(d => ({ ...d })),
        attempt, notesThisAttempt, noteCount, totalNotes,
      });
      frame++;

      // Safety: if ball is truly stuck for 3 seconds, force it toward a spike
      if (ballAlive && spd < 0.5 && physFrames > 90) {
        // Nudge toward nearest spike
        let nearestSpike = spikes[0];
        let nearestDist = Infinity;
        for (const sp of spikes) {
          const tipX = cx + Math.cos(sp.angle) * (radius - spikeLen);
          const tipY = cy + Math.sin(sp.angle) * (radius - spikeLen);
          const d2 = (bx - tipX) ** 2 + (by - tipY) ** 2;
          if (d2 < nearestDist) { nearestDist = d2; nearestSpike = sp; }
        }
        const tipX = cx + Math.cos(nearestSpike.angle) * (radius - spikeLen);
        const tipY = cy + Math.sin(nearestSpike.angle) * (radius - spikeLen);
        bvx = (tipX - bx) * 0.1;
        bvy = (tipY - by) * 0.1;
        physFrames = 0;
      }
    }

    // Reset note index for next attempt (melody replays)
    globalNoteIndex = 0;
    attempt++;

    // Death pause (5 frames)
    for (let p = 0; p < 5 && frame < totalFrames; p++) {
      snapshots.push({
        cx, cy, radius, spikes,
        ball: { x: bx, y: by, r: br, alive: false, color: '#555' },
        deadBalls: deadBalls.map(d => ({ ...d })),
        attempt, notesThisAttempt: attempt + 1, noteCount: 0, totalNotes,
      });
      frame++;
    }
  }

  // Fill remaining frames
  while (frame < totalFrames) {
    snapshots.push(snapshots[snapshots.length - 1]);
    frame++;
  }

  return { snapshots, allEvents };
}

// ============== DRAW ==============
function drawFrame(ctx, snap) {
  const { cx, cy, radius, spikes, ball, deadBalls, attempt, notesThisAttempt, noteCount, totalNotes } = snap;
  const c = ctx;
  c.save();
  c.scale(SCALE, SCALE);

  // Black background
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);

  // Text just above circle
  const textBase = cy - radius - 20;

  // Progress bar
  const barX = 150, barY = textBase - 12, barW = W - 300, barH = 8;
  c.fillStyle = '#333';
  c.fillRect(barX, barY, barW, barH);
  c.fillStyle = '#4ADE80';
  c.fillRect(barX, barY, barW * Math.min(1, notesThisAttempt / totalNotes), barH);

  // Note counter
  c.fillStyle = '#666';
  c.textAlign = 'center';
  c.font = '600 24px Inter, sans-serif';
  c.fillText(`${notesThisAttempt} / ${totalNotes} notes`, W / 2, barY - 10);

  // Attempt
  c.fillStyle = '#fff';
  c.font = '800 40px Inter, sans-serif';
  c.fillText(`Essai #${attempt + 1}`, W / 2, barY - 48);

  // Title
  c.font = '700 30px Inter, sans-serif';
  c.fillStyle = '#4ADE80';
  c.fillText('Commente ta reponse !', W / 2, barY - 92);
  c.fillStyle = '#fff';
  c.font = '900 52px Inter, sans-serif';
  c.fillText('GUESS THE SONG', W / 2, barY - 130);

  // Circle — white glow
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 20;
  c.strokeStyle = '#fff'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.stroke();
  c.restore();

  // Spikes
  spikes.forEach(spike => {
    const baseX = cx + Math.cos(spike.angle) * radius;
    const baseY = cy + Math.sin(spike.angle) * radius;
    const tipX = cx + Math.cos(spike.angle) * (radius - spike.len);
    const tipY = cy + Math.sin(spike.angle) * (radius - spike.len);
    const perpAngle = spike.angle + Math.PI / 2;
    const hw = 26;
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
