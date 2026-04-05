// Generate WAV files for each unique note frequency used in songs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARIO_NOTES } from './mario-notes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(__dirname, 'audio', 'notes');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const SAMPLE_RATE = 44100;

function generateNoteWav(freq, duration = 0.35) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.008);
    const release = Math.exp(-(t - 0.008) * 6);
    const envelope = Math.min(attack, release);
    // Piano-like tone with harmonics
    const sample =
      Math.sin(2 * Math.PI * freq * t) * 0.45 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.15 +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.05;
    const val = Math.max(-1, Math.min(1, sample * envelope));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  return buffer;
}

// Get all unique frequencies
const allNotes = [...new Set(MARIO_NOTES)];
console.log(`Generating ${allNotes.length} unique note WAV files...`);

allNotes.forEach(freq => {
  const filename = `note_${freq}.wav`;
  const filepath = path.join(audioDir, filename);
  const wav = generateNoteWav(freq);
  fs.writeFileSync(filepath, wav);
});

console.log(`Done! Files in ${audioDir}`);
