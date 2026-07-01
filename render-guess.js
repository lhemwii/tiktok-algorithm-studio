#!/usr/bin/env node
// Render a GuessTheSong video, auto-cropped to the last note
// Usage: node render-guess.js queen  (or pirates, mario)

import { execSync } from 'child_process';
import fs from 'fs';

const songId = process.argv[2] || 'queen';
const compositionMap = {
  queen: 'GuessTheSongQueen',
  pirates: 'GuessTheSongPirates',
  mario: 'GuessTheSong',
};
const compId = compositionMap[songId] || 'GuessTheSongQueen';
const outFile = `out/guess_${songId}.mp4`;

console.log(`🎬 Rendering ${compId} (song: ${songId})...`);
console.log(`   Output: ${outFile}`);

// Render full video
const cmd = `npx remotion render remotion/index.jsx ${compId} ${outFile} --codec h264 --crf 18`;
console.log(`   Command: ${cmd}`);
execSync(cmd, { stdio: 'inherit', shell: true });

console.log(`\n✅ Done! Video saved to ${outFile}`);
console.log(`\n💡 If the video is too long (frozen frames at the end), trim it:`);
console.log(`   Use Remotion studio to find the exact end frame, then:`);
console.log(`   npx remotion render remotion/index.jsx ${compId} ${outFile} --codec h264 --crf 18 --frames=0-XXXX`);
