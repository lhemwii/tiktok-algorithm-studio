#!/usr/bin/env node
// Render a specific World Cup match
// Usage: node render-match.js FRA SEN
//    or: node render-match.js all

import { execSync } from 'child_process';
import { GROUP_MATCHES } from './remotion/teams.js';

const args = process.argv.slice(2);

function renderMatch(home, away, seed, matchInfo, outFile) {
  const props = JSON.stringify({ homeTeam: home, awayTeam: away, seed, matchInfo });
  const cmd = `npx remotion render remotion/index.jsx WorldCup ${outFile} --codec h264 --crf 18 --props '${props}'`;
  execSync(cmd, { stdio: 'inherit', shell: true });
}

if (args[0] === 'all') {
  console.log(`Rendering all ${GROUP_MATCHES.length} group stage matches...`);
  GROUP_MATCHES.forEach((match, i) => {
    const outFile = `out/${match.home}_vs_${match.away}_G${match.group}.mp4`;
    const info = `Group ${match.group} | ${match.date} | ${match.venue}`;
    console.log(`\n[${i + 1}/${GROUP_MATCHES.length}] ${match.home} vs ${match.away} (Group ${match.group})`);
    try {
      renderMatch(match.home, match.away, i * 7 + 13, info, outFile);
    } catch (e) {
      console.error(`Failed: ${match.home} vs ${match.away}`);
    }
  });
  console.log('\nDone!');
} else if (args.length >= 2) {
  const home = args[0].toUpperCase();
  const away = args[1].toUpperCase();
  const match = GROUP_MATCHES.find(m => m.home === home && m.away === away);
  const info = match ? `Group ${match.group} | ${match.date} | ${match.venue}` : '';
  const seed = match ? GROUP_MATCHES.indexOf(match) * 7 + 13 : 42;
  const outFile = `out/${home}_vs_${away}.mp4`;
  console.log(`Rendering ${home} vs ${away}...`);
  renderMatch(home, away, seed, info, outFile);
  console.log(`Done! ${outFile}`);
} else {
  console.log('FIFA World Cup 2026 Match Renderer');
  console.log('==================================');
  console.log('Usage:');
  console.log('  node render-match.js FRA SEN     — render one match');
  console.log('  node render-match.js all          — render all group matches');
  console.log('\nAll group stage matches:');
  GROUP_MATCHES.forEach(m => {
    console.log(`  ${m.home} vs ${m.away}  (Group ${m.group}, ${m.date}, ${m.venue})`);
  });
}
