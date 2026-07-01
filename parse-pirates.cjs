const fs = require('fs');
const MidiParser = require('midi-parser-js');

const midiFilePath = process.argv[2] || 'mario.mid';
const songName = process.argv[3] || 'PIRATES_SONG';
const songLabel = process.argv[4] || 'Song';
const outputFile = process.argv[5] || 'remotion/pirates-song.js';

const data = fs.readFileSync(midiFilePath);
const base64 = Buffer.from(data).toString('base64');
const midi = MidiParser.parse(base64);

console.log('Number of tracks:', midi.track.length);
midi.track.forEach((track, i) => {
  const noteOnCount = track.event.filter(e => e.type === 9 && e.data && e.data[1] > 0).length;
  console.log(`Track ${i}: ${noteOnCount} note-on events`);
});

// Find the track with highest average note (likely melody, not bass)
let bestTrack = 0;
let bestAvg = 0;
midi.track.forEach((track, i) => {
  const noteEvents = track.event.filter(e => e.type === 9 && e.data && e.data[1] > 0);
  if (noteEvents.length === 0) return;
  const avg = noteEvents.reduce((s, e) => s + e.data[0], 0) / noteEvents.length;
  console.log(`Track ${i}: avg note = ${avg.toFixed(1)} (${noteEvents.length} notes)`);
  if (noteEvents.length > 20 && avg > bestAvg) { bestAvg = avg; bestTrack = i; }
});

console.log(`\nBest melody track: ${bestTrack} (avg pitch: ${bestAvg.toFixed(1)})`);

// Extract note-on events, clamped to piano range 48-84
const track = midi.track[bestTrack];
const rawNotes = [];
let time = 0;
for (const event of track.event) {
  time += event.deltaTime || 0;
  if (event.type === 9 && event.data && event.data[1] > 0) {
    let noteNum = event.data[0];
    // Clamp to 48-84 range (piano samples we have)
    noteNum = Math.max(48, Math.min(84, noteNum));
    rawNotes.push({ note: noteNum, file: `note_${noteNum}.wav` });
    if (rawNotes.length >= 150) break;
  }
}

// Remove duplicate consecutive notes (MIDI often repeats same note)
const notes = [rawNotes[0]];
for (let i = 1; i < rawNotes.length; i++) {
  if (rawNotes[i].note !== rawNotes[i-1].note) {
    notes.push(rawNotes[i]);
  }
}

console.log(`\nExtracted ${notes.length} unique notes (from ${rawNotes.length} raw):`);
console.log('First 15:', notes.slice(0, 15).map(n => n.note));
console.log('Last 10:', notes.slice(-10).map(n => n.note));
console.log('Note range:', Math.min(...notes.map(n => n.note)), '-', Math.max(...notes.map(n => n.note)));

// Generate the JS file
let output = `// ${songLabel}\n// Extracted from MIDI (${notes.length} notes)\nexport const ${songName} = [\n`;
notes.forEach(n => {
  output += `  { note: ${n.note}, file: '${n.file}' },\n`;
});
output += `];\n`;

fs.writeFileSync(outputFile, output);
console.log(`\nSaved to ${outputFile}`);
