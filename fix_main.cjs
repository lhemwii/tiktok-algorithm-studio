const fs = require('fs');

const mainPath = 'h:/CODE/Dev/Code-video/src/main.js';
let content = fs.readFileSync(mainPath, 'utf8');

// The file got duplicated blocks. We want to cut it from the end of worldcup
// and append the correct new blocks.

// Quick fix for the duplicate worldcup
content = content.replace("  worldcup: {\n  worldcup: {", "  worldcup: {");

// Let's find the first "ballmultiply: {" and cut the rest.
const bmIndex = content.indexOf('  ballmultiply: {');
if (bmIndex !== -1) {
    content = content.substring(0, bmIndex);
}

// Ensure the last brace finishes ALGORITHMS correctly or we handle it in newEnd.
// Let's make sure it just appends the keys
const newEnd = `  ballmultiply: {
    type: 'simulation',
    title: 'Ball Multiplication',
    badge: 'Exponential',
    desc: 'Every bounce against the wall spawns a new ball. Watch them multiply!',
    tiktokDesc: '1 rebond = 1 nouvelle balle ! La croissance est folle. #satisfying #physics #multiply',
    tiktokTags: '#satisfying #physics #viral #exponential #simulation #balls #asmr',
    init: function () {
      const cx = WIDTH / 2, cy = HEIGHT / 2, r = 400;
      this._arena = { cx, cy, r };
      this._balls = [
        { x: cx - 50, y: cy, vx: 5, vy: 4, r: 10, color: '#EF4444' },
        { x: cx + 50, y: cy, vx: -5, vy: -4, r: 10, color: '#3B82F6' },
      ];
      this._max = 2500;
    },
    draw: function (c) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, WIDTH, HEIGHT);

      c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = 'bold 60px Inter, sans-serif';
      c.fillText('Every bounce = new ball \\ud83e\\udd2f', WIDTH / 2, 250);
      
      c.font = 'bold 40px Inter, sans-serif'; c.fillStyle = '#94A3B8';
      c.fillText(\`\${this._balls.length} Balls\`, WIDTH / 2, 330);

      const { cx, cy, r } = this._arena;
      c.strokeStyle = '#60A5FA'; c.lineWidth = 4;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();

      this._balls.forEach(b => {
        c.fillStyle = b.color;
        c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      });
    },
    run: async function (runId) {
      this.init(); initAudio();
      const { cx, cy, r } = this._arena;
      while (activeRunId === runId && this._balls.length < this._max) {
        const toAdd = [];
        for (let i = 0; i < this._balls.length; i++) {
          const b = this._balls[i];
          b.x += b.vx; b.y += b.vy;
          const dx = b.x - cx, dy = b.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist + b.r > r) {
            // Bounce
            const nx = dx / dist, ny = dy / dist;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            b.x = cx + nx * (r - b.r - 1); b.y = cy + ny * (r - b.r - 1);
            // Spawn!
            if (this._balls.length + toAdd.length < this._max) {
              toAdd.push({
                x: b.x, y: b.y,
                vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                r: b.r, color: \`hsl(\${Math.random() * 360}, 70%, 50%)\`
              });
              if (this._balls.length % 20 === 0) playNote(Math.floor(Math.random()*5)+5, 'sine', 0.05, 0.01);
            }
          }
        }
        toAdd.forEach(nb => this._balls.push(nb));
        await sleep(16);
      }
      await sleep(3000);
    }
  },

  escapeordie: {
    type: 'simulation',
    title: 'Escape or Die',
    badge: 'Hardcore',
    desc: 'Bounced inside a spiked rotating ring. Find the exit before losing all hearts.',
    tiktokDesc: 'S\\'échapper ou mourir ? Les pics ne pardonnent pas. #escapeordie #physics #hardcore',
    tiktokTags: '#simulation #hardcore #viral #satisfying #physics #escape #died #asmr',
    init: function () {
      const cx = WIDTH / 2, cy = HEIGHT / 2 + 100, r = 350;
      this._arena = { cx, cy, r, angle: 0, gap: 0.8 };
      this._ball = { x: cx, y: cy, vx: 6, vy: -4, r: 20, color: '#4ADE80', particles: [] };
      this._hearts = 10;
      this._maxHearts = 10;
      this._state = 'playing'; // 'playing' | 'won' | 'died'
    },
    draw: function (c) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, WIDTH, HEIGHT);

      c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = 'bold 70px Inter, sans-serif';
      c.fillText('Escape Before', WIDTH / 2, 200);
      c.fillText('You Die!', WIDTH / 2, 280);

      // Hearts
      const hS = 40;
      for (let i = 0; i < this._maxHearts; i++) {
        const hx = WIDTH / 2 - (this._maxHearts * hS) / 2 + i * hS + 20;
        c.font = '30px serif';
        c.fillText(i < this._hearts ? '❤️' : '🖤', hx, 350);
      }

      const { cx, cy, r, angle, gap } = this._arena;
      c.save();
      c.translate(cx, cy);
      c.rotate(angle);

      // Draw Spiked Ring
      c.strokeStyle = '#4B5563'; c.lineWidth = 10;
      c.beginPath();
      c.arc(0, 0, r, gap/2, Math.PI * 2 - gap/2);
      c.stroke();

      // Spikes
      c.fillStyle = '#1F2937';
      const numSpikes = 24;
      for (let i = 0; i < numSpikes; i++) {
        const a = gap/2 + (i / (numSpikes-1)) * (Math.PI * 2 - gap);
        const sx = Math.cos(a) * r;
        const sy = Math.sin(a) * r;
        c.save();
        c.translate(sx, sy);
        c.rotate(a + Math.PI/2);
        c.beginPath(); c.moveTo(-20, 0); c.lineTo(0, -40); c.lineTo(20, 0); c.fill();
        c.restore();
      }
      c.restore();

      // Ball Particles
      this._ball.particles.forEach(p => {
        c.fillStyle = p.color; c.globalAlpha = p.life;
        c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1.0;

      // Ball
      if (this._state === 'playing' || this._state === 'won') {
        const b = this._ball;
        c.fillStyle = b.color;
        c.shadowBlur = 20; c.shadowColor = b.color;
        c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
      }

      if (this._state === 'died') {
        c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(0, 0, WIDTH, HEIGHT);
        c.fillStyle = '#EF4444'; c.font = 'bold 120px serif';
        c.fillText('YOU DIED', WIDTH / 2, HEIGHT / 2);
      }
      if (this._state === 'won') {
        c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(0, 0, WIDTH, HEIGHT);
        c.fillStyle = '#F59E0B'; c.font = 'bold 120px Inter, sans-serif';
        c.fillText('VICTORY', WIDTH / 2, HEIGHT / 2);
      }
    },
    run: async function (runId) {
      this.init(); initAudio();
      const { cx, cy, r } = this._arena;
      const gravity = 0.2;
      
      while (activeRunId === runId && this._state === 'playing') {
        const b = this._ball;
        b.vy += gravity; b.x += b.vx; b.y += b.vy;
        
        // Particles
        b.particles.push({ x: b.x, y: b.y, life: 1.0, color: b.color });
        if (b.particles.length > 20) b.particles.shift();
        b.particles.forEach(p => p.life -= 0.05);

        const dx = b.x - cx, dy = b.y - cy, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist + b.r > r) {
          const worldAngle = Math.atan2(dy, dx);
          const localAngle = (worldAngle - this._arena.angle + Math.PI * 4) % (Math.PI * 2);
          
          if (localAngle < this._arena.gap / 2 || localAngle > Math.PI * 2 - this._arena.gap / 2) {
            // Out of the gap!
            if (dist > r + 50) { this._state = 'won'; playNote(15, 'triangle', 0.5, 0.2); }
          } else {
            // Hit spikes
            this._hearts--;
            playNoise(0.5, 0.1);
            if (this._hearts <= 0) { this._state = 'died'; break; }
            
            // Bounce
            const nx = dx / dist, ny = dy / dist;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            b.x = cx + nx * (r - b.r - 1); b.y = cy + ny * (r - b.r - 1);
          }
        }

        this._arena.angle += 0.02;
        await sleep(16);
      }
      await sleep(3000);
    }
  },

  physicscrash: {
    type: 'simulation',
    title: 'Free For All',
    badge: 'Battle',
    desc: '4 balls battle in a grid arena. Last one standing wins!',
    tiktokDesc: 'Combat épique entre 4 algorithmes ! Qui sera le dernier survivant ? #battle #physics #simulation',
    tiktokTags: '#satisfying #battle #viral #physics #simulation #oddlysatisfying #game',
    init: function () {
      const ox = 100, oy = 400, ow = WIDTH - 200, oh = 1000;
      this._arena = { ox, oy, ow, oh };
      this._balls = [
        { id: 0, x: ox + 100, y: oy + 100, vx: 8, vy: 6, r: 40, color: '#EF4444', hearts: 10, face: '>_<' },
        { id: 1, x: ox + ow - 100, y: oy + 100, vx: -8, vy: 6, r: 40, color: '#3B82F6', hearts: 10, face: "'-'" },
        { id: 2, x: ox + 100, y: oy + oh - 100, vx: 8, vy: -6, r: 40, color: '#10B981', hearts: 10, face: 'ò_ó' },
        { id: 3, x: ox + ow - 100, y: oy + oh - 100, vx: -8, vy: -6, r: 40, color: '#F59E0B', hearts: 10, face: '>:( ' },
      ];
      this._particles = [];
      this._winner = null;
    },
    draw: function (c) {
      c.fillStyle = '#0F172A';
      c.fillRect(0, 0, WIDTH, HEIGHT);

      // Grid background
      const { ox, oy, ow, oh } = this._arena;
      c.strokeStyle = 'rgba(255,255,255,0.1)';
      c.lineWidth = 1;
      for(let x = ox; x <= ox + ow; x += 50) { c.beginPath(); c.moveTo(x, oy); c.lineTo(x, oy+oh); c.stroke(); }
      for(let y = oy; y <= oy + oh; y += 50) { c.beginPath(); c.moveTo(ox, y); c.lineTo(ox+ow, y); c.stroke(); }

      // Arena Border
      c.strokeStyle = '#fff'; c.lineWidth = 8;
      c.strokeRect(ox, oy, ow, oh);

      // Hearts UI
      this._balls.forEach((b, i) => {
        const hx = 100 + (i % 2) * (WIDTH/2);
        const hy = 100 + Math.floor(i / 2) * 100;
        c.fillStyle = b.color; c.beginPath(); c.arc(hx, hy, 20, 0, Math.PI * 2); c.fill();
        for(let j=0; j<10; j++) {
          c.font = '24px serif';
          c.fillText(j < b.hearts ? '❤️' : '🖤', hx + 40 + j * 30, hy + 8);
        }
      });

      c.fillStyle = '#fff'; c.font = 'bold 50px Inter, sans-serif'; c.textAlign = 'center';
      c.fillText('Free For All', WIDTH/2, 350);

      // Particles
      this._particles.forEach(p => {
        c.fillStyle = p.color; c.globalAlpha = p.life;
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1.0;

      // Balls
      this._balls.forEach(b => {
        if (b.hearts <= 0) return;
        c.save(); c.translate(b.x, b.y);
        c.fillStyle = b.color;
        c.shadowBlur = 15; c.shadowColor = b.color;
        c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = '#fff'; c.font = 'bold 30px Inter, sans-serif';
        c.fillText(b.face, 0, 10);
        c.restore();
      });

      if (this._winner !== null) {
        c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, HEIGHT/2 - 100, WIDTH, 200);
        c.fillStyle = this._balls[this._winner].color;
        c.font = 'bold 80px Inter, sans-serif';
        c.fillText(\`\${this._balls[this._winner].color} WINS!\`, WIDTH/2, HEIGHT/2 + 30);
      }
    },
    run: async function (runId) {
      this.init(); initAudio();
      const { ox, oy, ow, oh } = this._arena;
      
      while (activeRunId === runId) {
        const alive = this._balls.filter(b => b.hearts > 0);
        if (alive.length <= 1) {
          if (alive.length === 1) this._winner = alive[0].id;
          break;
        }

        this._balls.forEach(b => {
          if (b.hearts <= 0) return;
          b.x += b.vx; b.y += b.vy;
          // Wall bounce
          if (b.x - b.r < ox || b.x + b.r > ox + ow) { b.vx *= -1; b.x = Math.max(ox+b.r, Math.min(ox+ow-b.r, b.x)); }
          if (b.y - b.r < oy || b.y + b.r > oy + oh) { b.vy *= -1; b.y = Math.max(oy+b.r, Math.min(oy+oh-b.r, b.y)); }
        });

        // Ball collisions
        for(let i=0; i<this._balls.length; i++) {
          for(let j=i+1; j<this._balls.length; j++) {
            const b1 = this._balls[i], b2 = this._balls[j];
            if (b1.hearts <= 0 || b2.hearts <= 0) continue;
            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < b1.r + b2.r) {
              // Collision!
              b1.hearts--; b2.hearts--;
              playNote(Math.floor(Math.random()*5)+1, 'square', 0.1, 0.05);
              // Physics
              const nx = dx/dist, ny = dy/dist;
              const p = b1.vx*nx + b1.vy*ny - (b2.vx*nx + b2.vy*ny);
              b1.vx -= p*nx; b1.vy -= p*ny; b2.vx += p*nx; b2.vy += p*ny;
              // Particles
              for(let k=0; k<15; k++) {
                this._particles.push({
                  x: (b1.x+b2.x)/2, y: (b1.y+b2.y)/2,
                  vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                  size: Math.random()*10+5, color: Math.random()>0.5 ? b1.color : b2.color, life: 1.0
                });
              }
            }
          }
        }

        this._particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; });
        this._particles = this._particles.filter(p => p.life > 0);
        await sleep(16);
      }
      await sleep(3000);
    }
  },
};
`;

content += newEnd;

// There is some UI code after `ALGORITHMS: { ... };` that we don't want to lose
// Actually, in our cut we deleted all UI code! We need to bring it back.
// Let's read from the original content to get the UI code.
const originalChunks = fs.readFileSync(mainPath, 'utf8').split('};');
// The ALGORITHMS block ends with '};\n\nfunction renderPresetCards()'. 
// We can find 'function renderPresetCards()' and append everything after it.
const uiCodeIndex = fs.readFileSync(mainPath, 'utf8').indexOf('function renderPresetCards()');
if(uiCodeIndex !== -1) {
   content += '\n' + fs.readFileSync(mainPath, 'utf8').substring(uiCodeIndex);
}

fs.writeFileSync(mainPath, content);
console.log('Fixed main.js successfully');
