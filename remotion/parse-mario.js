// Parse Mario Bros MIDI and output JSON for GuessTheSong
import fs from 'fs';
import MidiParser from 'midi-parser-js';

const midiFile = process.argv[2] || 'C:\\Users\\PC\\Downloads\\Mario Bros. - Super Mario Bros. Theme.mid';
const data = fs.readFileSync(midiFile);
const base64 = Buffer.from(data).toString('base64');
const midi = MidiParser.parse(base64);

function midiToNoteName(n) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return names[n % 12] + (Math.floor(n / 12) - 1);
}

// Find best track
let bestTrack = 0, bestCount = 0;
midi.track.forEach((track, i) => {
  const count = track.event.filter(e => e.type === 9 && e.data && e.data[1] > 0).length;
  console.log(`Track ${i}: ${count} noteOn events`);
  if (count > bestCount) { bestCount = count; bestTrack = i; }
});

console.log(`Using track ${bestTrack} (${bestCount} notes)`);

const notes = [];
const track = midi.track[bestTrack];
for (const event of track.event) {
  if (event.type === 9 && event.data && event.data[1] > 0) {
    const noteNum = event.data[0];
    // Clamp to our piano range (48-84)
    const clamped = Math.max(48, Math.min(84, noteNum));
    notes.push({
      note: clamped,
      name: midiToNoteName(clamped),
      file: `note_${clamped}.wav`,
    });
  }
}

// Deduplicate consecutive identical notes
const cleaned = notes.filter((n, i) => i === 0 || n.note !== notes[i-1].note);

// Limit to ~80 notes for 65 second video
const limited = cleaned.slice(0, 80);

console.log(`${limited.length} notes extracted`);
console.log('First 20:', limited.slice(0, 20).map(n => n.name).join(' '));

// Save as JS module for Remotion import
const jsOutput = `// Super Mario Bros Theme — extracted from MIDI
// ${limited.length} notes (MIDI note numbers)
export const MARIO_SONG = ${JSON.stringify(limited, null, 2)};
`;
fs.writeFileSync('remotion/mario-song.js', jsOutput);
console.log('Saved to remotion/mario-song.js');
