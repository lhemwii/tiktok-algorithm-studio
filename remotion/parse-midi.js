// Parse MIDI file and extract note frequencies for GuessTheSong
import fs from 'fs';
import MidiParser from 'midi-parser-js';

const midiFile = process.argv[2] || 'C:\\Users\\PC\\Downloads\\Super Mario 64 - Medley.mid';
const data = fs.readFileSync(midiFile);
const base64 = Buffer.from(data).toString('base64');
const midi = MidiParser.parse(base64);

// MIDI note number to frequency
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Extract note-on events from the first melody track
const notes = [];
let maxNotes = 80; // limit for a 65 second video

// Find the track with the most note-on events (likely melody)
let bestTrack = 0;
let bestCount = 0;
midi.track.forEach((track, i) => {
  const count = track.event.filter(e => e.type === 9 && e.data && e.data[1] > 0).length;
  if (count > bestCount) { bestCount = count; bestTrack = i; }
});

console.log(`Found ${midi.track.length} tracks. Using track ${bestTrack} (${bestCount} notes)`);

const track = midi.track[bestTrack];
let time = 0;
for (const event of track.event) {
  time += event.deltaTime || 0;
  // Note-on event (type 9) with velocity > 0
  if (event.type === 9 && event.data && event.data[1] > 0) {
    const noteNum = event.data[0];
    const freq = Math.round(midiToFreq(noteNum));
    notes.push(freq);
    if (notes.length >= maxNotes) break;
  }
}

console.log(`\nExtracted ${notes.length} notes:`);
console.log(`const MARIO_NOTES = [${notes.join(', ')}];`);

// Write to a file for easy import
const output = `// Super Mario 64 Medley — extracted from MIDI
// ${notes.length} notes
export const MARIO_NOTES = [${notes.join(', ')}];
`;
fs.writeFileSync('remotion/mario-notes.js', output);
console.log('\nSaved to remotion/mario-notes.js');
