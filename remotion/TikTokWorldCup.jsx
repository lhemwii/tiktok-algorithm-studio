import { useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { useEffect, useRef, useMemo } from 'react';
import { TEAMS } from './teams';
import '../tiktok-app/src/style.css'; // Inject TikTok styles

const PITCH_LEFT = 20, PITCH_RIGHT = 430;
const PITCH_TOP = 172, PITCH_BOTTOM = 522;
const GOAL_LEFT = 155, GOAL_RIGHT = 295; // 140px wide net

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function initState(seed, homeCode, awayCode) {
  const rand = seededRandom(seed);
  const homeTeamInfo = TEAMS[homeCode] || { color: '#002395', altColor: '#ED2939', name: 'FRANCE' };
  const awayTeamInfo = TEAMS[awayCode] || { color: '#00853F', altColor: '#EF3340', name: 'SENEGAL' };
  
  const state = {
    rand,
    homeScore: 0,
    awayScore: 0,
    phase: 'play',
    timerFrames: 0,
    events: [],
    lastTouchTeam: 0,
    touches1: 50,
    touches2: 50,
    ballZoneX: 225,
    ballZoneY: 365,
    ballStuckFrames: 0,
    goalCelebrationTimer: 0,
    homeTeamInfo,
    awayTeamInfo,
    matchInfo: ''
  };

  const ball = { x: 225, y: 347, vx: 0, vy: 0, r: 10 };
  const players = [];

  const resetPositions = () => {
    players.length = 0;
    const centerY = (PITCH_TOP + PITCH_BOTTOM) / 2;
    players.push({ x: 225, y: PITCH_BOTTOM - 20, vx: 0, vy: 0, r: 22, type: 'gk', team: 1, baseColor: homeTeamInfo.color, hasCard: false });
    players.push({ x: 130, y: centerY + 60, vx: 0, vy: 0, r: 19, type: 'field', team: 1, baseColor: homeTeamInfo.color, hasCard: false });
    players.push({ x: 320, y: centerY + 60, vx: 0, vy: 0, r: 19, type: 'field', team: 1, baseColor: homeTeamInfo.color, hasCard: false });
    players.push({ x: 225, y: PITCH_TOP + 20, vx: 0, vy: 0, r: 22, type: 'gk', team: 2, baseColor: awayTeamInfo.color, hasCard: false });
    players.push({ x: 130, y: centerY - 60, vx: 0, vy: 0, r: 19, type: 'field', team: 2, baseColor: awayTeamInfo.color, hasCard: false });
    players.push({ x: 320, y: centerY - 60, vx: 0, vy: 0, r: 19, type: 'field', team: 2, baseColor: awayTeamInfo.color, hasCard: false });
    players.push({ x: 225 - 80, y: centerY, vx: 0, vy: 0, r: 17, type: 'ref', team: 0, baseColor: '#222', hasCard: false });
    
    ball.x = 225; ball.y = centerY; ball.vx = 0; ball.vy = 0;
    state.ballZoneX = ball.x; state.ballZoneY = ball.y; state.ballStuckFrames = 0;
  };
  
  resetPositions();
  state.resetPositions = resetPositions;
  return { state, ball, players };
}

function physicsStep(state, ball, players) {
  state.events = [];
  if (state.phase === 'end') return;

  if (state.phase === 'goal_celebration') {
    state.goalCelebrationTimer--;
    if (state.goalCelebrationTimer <= 0) {
      state.phase = 'play';
      state.resetPositions();
    }
  }

  // Ball physics
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= 0.98; ball.vy *= 0.98;

  // Stuck logic
  if (dist({x: ball.x, y: ball.y}, {x: state.ballZoneX, y: state.ballZoneY}) > 50) {
    state.ballZoneX = ball.x;
    state.ballZoneY = ball.y;
    state.ballStuckFrames = 0;
  } else {
    state.ballStuckFrames++;
  }

  if (state.ballStuckFrames > 300) {
    let closestP = null; let minDist = 9999;
    for (const p of players) {
      if (p.type === 'field' && !p.hasCard) {
        let d = dist(p, ball);
        if (d < minDist) { minDist = d; closestP = p; }
      }
    }
    if (closestP) {
      closestP.hasCard = true;
      state.events.push({ type: 'card', title: 'YELLOW CARD (Stalling)', teamName: closestP.team === 1 ? state.homeTeamInfo.name : state.awayTeamInfo.name });
    }
    state.ballStuckFrames = 0;
    ball.vx += (state.rand()-0.5)*25;
    ball.vy += (state.rand()-0.5)*25;
    state.events.push({ type: 'whistle' });
  }

  // Pitch boundary bounces
  if (ball.x - ball.r < PITCH_LEFT) { ball.x = PITCH_LEFT + ball.r; ball.vx *= -1; state.events.push({ type: 'bounce' }); }
  if (ball.x + ball.r > PITCH_RIGHT) { ball.x = PITCH_RIGHT - ball.r; ball.vx *= -1; state.events.push({ type: 'bounce' }); }
  
  // Goals logic (stuck inside net)
  if (ball.y < PITCH_TOP) {
    if (ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT) {
      if (state.phase === 'play') {
        state.homeScore++;
        state.phase = 'goal_celebration';
        state.goalCelebrationTimer = 150; // 2.5 seconds at 60fps
        state.events.push({ type: 'goal', title: 'GOAL!', teamName: state.homeTeamInfo.name });
      }
      ball.vy *= 0.7; ball.vx *= 0.7;
      if (ball.y < PITCH_TOP - 25) { ball.y = PITCH_TOP - 25; ball.vy *= -0.3; } // back of net
    } else {
      ball.y = PITCH_TOP + ball.r; ball.vy *= -1; state.events.push({ type: 'bounce' });
    }
  }
  
  if (ball.y > PITCH_BOTTOM) {
    if (ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT) {
      if (state.phase === 'play') {
        state.awayScore++;
        state.phase = 'goal_celebration';
        state.goalCelebrationTimer = 150;
        state.events.push({ type: 'goal', title: 'GOAL!', teamName: state.awayTeamInfo.name });
      }
      ball.vy *= 0.7; ball.vx *= 0.7;
      if (ball.y > PITCH_BOTTOM + 25) { ball.y = PITCH_BOTTOM + 25; ball.vy *= -0.3; } // back of net
    } else {
      ball.y = PITCH_BOTTOM - ball.r; ball.vy *= -1; state.events.push({ type: 'bounce' });
    }
  }

  // Player physics and basic AI
  for (const p of players) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.9; p.vy *= 0.9;

    if (p.x - p.r < PITCH_LEFT) p.x = PITCH_LEFT + p.r;
    if (p.x + p.r > PITCH_RIGHT) p.x = PITCH_RIGHT - p.r;
    if (p.y - p.r < PITCH_TOP) p.y = PITCH_TOP + p.r;
    if (p.y + p.r > PITCH_BOTTOM) p.y = PITCH_BOTTOM - p.r;

    if (state.phase !== 'play') continue;

    if (p.type === 'field') {
      const d = dist(p, ball);
      if (d > 0) {
        const ax = (ball.x - p.x) / d;
        const ay = (ball.y - p.y) / d;
        const speed = p.hasCard ? 0.2 : 0.45;
        p.vx += ax * speed;
        p.vy += ay * speed;
      }
    }

    if (p.type === 'gk') {
      const targetX = Math.max(GOAL_LEFT+10, Math.min(GOAL_RIGHT-10, ball.x));
      const targetY = p.team === 1 ? 800 - 80 : 80;
      p.vx += (targetX - p.x) * 0.05;
      p.vy += (targetY - p.y) * 0.05;
    }

    if (p.type === 'ref') {
      const targetX = ball.x + 80 * Math.cos(state.timerFrames * 0.02);
      const targetY = ball.y + 80 * Math.sin(state.timerFrames * 0.02);
      p.vx += (targetX - p.x) * 0.02;
      p.vy += (targetY - p.y) * 0.02;
    }

    const db = dist(p, ball);
    if (db < p.r + ball.r) {
      if (p.type !== 'ref') {
         if (p.team === 1) state.touches1++;
         else if (p.team === 2) state.touches2++;
      }
      
      const nx = (ball.x - p.x) / db;
      const ny = (ball.y - p.y) / db;
      const impulse = 3;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
      p.vx -= nx * impulse * 0.5;
      p.vy -= ny * impulse * 0.5;
      state.events.push({ type: 'kick' });
    }
  }

  for(let i=0; i<players.length; i++){
    for(let j=i+1; j<players.length; j++){
      const p1 = players[i], p2 = players[j];
      if (p1.type === 'ref' || p2.type === 'ref') continue;
      
      const d = dist(p1, p2);
      if (d < p1.r + p2.r) {
        const nx = (p2.x - p1.x)/d;
        const ny = (p2.y - p1.y)/d;
        const overlap = (p1.r+p2.r)-d;
        p1.x -= nx * overlap*0.5; p1.y -= ny * overlap*0.5;
        p2.x += nx * overlap*0.5; p2.y += ny * overlap*0.5;
      }
    }
  }
}

function simulateAll(seed, homeTeam, awayTeam, totalFrames) {
  // TikTok app runs at 60fps logic. If Remotion renders at 30 fps, we should step twice per Remotion frame.
  const { state, ball, players } = initState(seed, homeTeam, awayTeam);
  const snapshots = [];
  const allEvents = [{ type: 'whistle', frame: 1 }];
  const actionLog = [];

  for (let f = 0; f < totalFrames; f++) {
    // 2 physics steps per visual frame to match 60fps logic on a 30fps export (or 1 step if exported at 60fps)
    // To be safe and identical to the original browser speed (65 seconds * 60 fps = 3900 logic steps)
    // If we render at 30 fps for 65 seconds, totalFrames is 1950. 
    // We step twice per frame!
    const frameEvents = [];
    for (let step = 0; step < 2; step++) {
      if (state.phase === 'play') {
        state.timerFrames++;
        if (state.timerFrames >= 3900) {
          state.phase = 'end';
        }
      }
      physicsStep(state, ball, players);
      state.events.forEach(e => {
        if (e.title) {
          actionLog.unshift({ ...e, gameMinute: Math.floor((state.timerFrames / 3900) * 90) });
        }
        frameEvents.push({ ...e, frame: f });
      });
    }

    snapshots.push({
      ball: { ...ball },
      players: players.map(p => ({ ...p })),
      phase: state.phase,
      timerFrames: state.timerFrames,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      touches1: state.touches1,
      touches2: state.touches2,
      homeTeamInfo: state.homeTeamInfo,
      awayTeamInfo: state.awayTeamInfo,
      actionLog: [...actionLog]
    });
    frameEvents.forEach(e => allEvents.push(e));
  }
  return { snapshots, allEvents };
}

// ============== COMPONENT ==============
export const TikTokWorldCup = ({ homeTeam = 'FRA', awayTeam = 'SEN', seed = 42 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig(); // expect 1080x1920
  const canvasRef = useRef(null);

  const { snapshots, allEvents } = useMemo(
    () => simulateAll(seed, homeTeam, awayTeam, durationInFrames),
    [seed, homeTeam, awayTeam, durationInFrames]
  );

  const snap = snapshots[frame] || snapshots[snapshots.length - 1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 450, 800);

    // Draw Players
    for (const p of snap.players) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 10;
      
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI*2);
      ctx.clip();
      
      if (p.team === 2) {
        ctx.fillStyle = snap.awayTeamInfo.color;
        ctx.fillRect(-p.r, -p.r, (p.r*2)/3, p.r*2);
        ctx.fillStyle = '#FDEF42'; // SEN yellow fallback
        ctx.fillRect(-p.r + (p.r*2)/3, -p.r, (p.r*2)/3, p.r*2);
        ctx.fillStyle = snap.awayTeamInfo.altColor;
        ctx.fillRect(-p.r + ((p.r*2)/3)*2, -p.r, (p.r*2)/3, p.r*2);
      } else if (p.team === 1) {
        ctx.fillStyle = snap.homeTeamInfo.color;
        ctx.fillRect(-p.r, -p.r, (p.r*2)/3, p.r*2);
        ctx.fillStyle = '#fff';      // FRA white fallback
        ctx.fillRect(-p.r + (p.r*2)/3, -p.r, (p.r*2)/3, p.r*2);
        ctx.fillStyle = snap.homeTeamInfo.altColor;
        ctx.fillRect(-p.r + ((p.r*2)/3)*2, -p.r, (p.r*2)/3, p.r*2);
      } else {
        ctx.fillStyle = '#131313';
        ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
        if (p.type === 'ref') {
           ctx.fillStyle = '#ffd54a';
           ctx.fillRect(-p.r, -4, p.r*2, 8);
        }
      }
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI*2);
      ctx.stroke();

      if (p.type === 'gk') {
        ctx.strokeStyle = '#ffd54a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 4, 0, Math.PI*2);
        ctx.stroke();
      }

      const eyeAngle = Math.atan2(snap.ball.y - p.y, snap.ball.x - p.x);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-7, -4, 8, 10, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, -4, 8, 10, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(-7 + Math.cos(eyeAngle)*2.6, -4 + Math.sin(eyeAngle)*2.6, 3.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(7 + Math.cos(eyeAngle)*2.6, -4 + Math.sin(eyeAngle)*2.6, 3.4, 0, Math.PI*2); ctx.fill();

      if (p.hasCard) {
        ctx.fillStyle = '#FFD100';
        ctx.fillRect(-6, -p.r - 20, 12, 16);
        ctx.strokeRect(-6, -p.r - 20, 12, 16);
      }
      ctx.restore();
    }

    // Draw Ball
    ctx.save();
    ctx.translate(snap.ball.x, snap.ball.y);
    ctx.beginPath();
    ctx.arc(0, 0, snap.ball.r, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, 0, snap.ball.r*0.4, 0, Math.PI*2); ctx.fill();
    ctx.restore();

  }, [frame, snap]);

  let gameMinute = Math.min(90, Math.floor((snap.timerFrames / 3900) * 90));
  const totalPos = snap.touches1 + snap.touches2;
  const p1Pct = Math.round((snap.touches1 / totalPos) * 100);
  const p2Pct = 100 - p1Pct;

  // Audio Processing (Copied from WorldCup)
  function normalizeAudioEvents(events, duration) {
    const rules = { whistle: { cooldown: 10 }, goal: { cooldown: 20 }, kick: { cooldown: 2 }, bounce: { cooldown: 3 } };
    const last = new Map();
    const norm = [];
    events.slice().sort((a,b) => a.frame - b.frame).forEach(e => {
        if (!e.type) return;
        const r = rules[e.type] || { cooldown: 0 };
        const prev = last.get(e.type);
        if (prev !== undefined && e.frame - prev < r.cooldown) return;
        last.set(e.type, e.frame);
        norm.push(e);
    });
    return norm;
  }
  
  const crowdSrc = new URL('./audio/clean-stadium-loop.mp3', import.meta.url).href;
  const goalSrc = new URL('./audio/goal-cheer.mp3', import.meta.url).href;
  const goalNetSrc = new URL('./audio/goal-net-impact.mp3', import.meta.url).href;
  const whistleShortSrc = new URL('./audio/whistle-short.mp3', import.meta.url).href;
  const whistleLongSrc = new URL('./audio/whistle-long.mp3', import.meta.url).href;
  const kickSrc = new URL('./audio/realistic-kick.mp3', import.meta.url).href;
  const bounceSrc = new URL('./audio/bounce.wav', import.meta.url).href;
  const normEvents = useMemo(() => normalizeAudioEvents(allEvents, durationInFrames), [allEvents, durationInFrames]);

  return (
    <div style={{ width: 1080, height: 1920, backgroundColor: '#131e18', overflow: 'hidden' }}>
      <div style={{ transform: 'scale(2.4)', transformOrigin: 'top left', width: 450, height: 800 }}>
        
        {/* TikTok DOM Layout */}
        <div className="tiktok-frame">
          <div className="pitch-bg-elements">
            <div className="pitch-outline">
              <div className="net top"></div>
              <div className="penalty-area top"></div>
              <div className="mid-line"></div>
              <div className="mid-circle"></div>
              <div className="net bottom"></div>
              <div className="penalty-area bottom"></div>
            </div>
          </div>

          <canvas ref={canvasRef} width={450} height={800} style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }} />

          <div id="ui-overlay" style={{ zIndex: 20 }}>
            {/* SCOREBOARD */}
            <div className="scoreboard glass-ui" id="scoreboard">
              <div className="sb-team">
                <div className="sb-flag-block fra"></div>
                <span className="sb-score">{snap.homeScore}</span>
              </div>
              <div className="sb-center">
                <div className="sb-timer-box">
                  <span className="sb-timer">{gameMinute >= 90 ? '90' : gameMinute.toString().padStart(2, '0')}:00</span>
                </div>
                <span className="sb-half">{snap.phase === 'end' ? 'FULL TIME' : gameMinute >= 45 ? '2ND HALF' : '1ST HALF'}</span>
              </div>
              <div className="sb-team">
                <div className="sb-flag-block sen"></div>
                <span className="sb-score">{snap.awayScore}</span>
              </div>
            </div>

            {/* ACTION PANEL */}
            <div className="action-panel glass-ui">
              <div className="action-header">
                <span>Timeline & Events</span>
                <span>⏱️</span>
              </div>

              <div className="possession-box" style={{ marginBottom: 14, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', marginBottom: 6 }}>
                  <span>{snap.homeTeamInfo.name.substring(0,3)} ({p1Pct}%)</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Possession</span>
                  <span>{snap.awayTeamInfo.name.substring(0,3)} ({p2Pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${p1Pct}%`, background: '#002395', transition: 'width 0.3s' }}></div>
                  <div style={{ width: `${p2Pct}%`, background: '#00853F', transition: 'width 0.3s' }}></div>
                </div>
              </div>

              <div className="action-list">
                {snap.actionLog.slice(0, 5).map((act, i) => (
                  <div key={i} className={`action-item ${act.type === 'goal' ? 'goal' : 'yellow-card'}`}>
                    <span className="act-time">{act.gameMinute}'</span>
                    <span className="act-icon">{act.type === 'goal' ? '⚽' : '🟨'}</span>
                    <div className="act-desc">
                      <span className="act-title">{act.title}</span>
                      <span className="act-team">{act.teamName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* AUDIO */}
      {Array.from({ length: Math.ceil(durationInFrames / 900) }).map((_, i) => (
        <Sequence key={`crowd-${i}`} from={i * 900} durationInFrames={Math.min(900, durationInFrames - i * 900)}>
          <Audio src={crowdSrc} volume={0.14} />
        </Sequence>
      ))}
      {normEvents.filter(e => e.type === 'kick').map((e, i) => (
        <Sequence key={`k${i}`} from={e.frame} durationInFrames={6}>
          <Audio src={kickSrc} volume={0.3} />
        </Sequence>
      ))}
      {normEvents.filter(e => e.type === 'bounce').map((e, i) => (
        <Sequence key={`b${i}`} from={e.frame} durationInFrames={6}>
          <Audio src={bounceSrc} volume={0.25} />
        </Sequence>
      ))}
      {normEvents.filter(e => e.type === 'whistle').map((e, i) => (
        <Sequence key={`w${i}`} from={e.frame} durationInFrames={60}>
          <Audio src={i === 0 ? whistleLongSrc : whistleShortSrc} volume={0.2} />
        </Sequence>
      ))}
      {normEvents.filter(e => e.type === 'goal').map((e, i) => (
        <Sequence key={`g${i}`} from={e.frame} durationInFrames={90}>
          <Audio src={goalNetSrc} volume={0.5} />
          <Audio src={goalSrc} volume={0.8} />
        </Sequence>
      ))}
    </div>
  );
};
