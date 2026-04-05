// Generate WAV files with a proper synth piano sound for each MIDI note
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARIO_NOTES } from './mario-notes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(__dirname, 'audio', 'notes');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const SAMPLE_RATE = 44100;

function generatePianoNote(freq, duration = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV header
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

    // ADSR envelope — piano-like: fast attack, medium decay, sustain, release
    const attack = 0.005;
    const decay = 0.15;
    const sustainLevel = 0.4;
    const release = 0.15;
    let envelope;
    if (t < attack) {
      envelope = t / attack; // attack
    } else if (t < attack + decay) {
      envelope = 1 - ((t - attack) / decay) * (1 - sustainLevel); // decay to sustain
    } else if (t < duration - release) {
      envelope = sustainLevel; // sustain
    } else {
      envelope = sustainLevel * ((duration - t) / release); // release
    }
    envelope = Math.max(0, envelope);

    // Rich piano-like tone: fundamental + harmonics with decreasing amplitude
    // Similar to a square-ish wave but smoother — sounds like 8-bit piano
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const h2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.5; // octave
    const h3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.25; // fifth
    const h4 = Math.sin(2 * Math.PI * freq * 4 * t) * 0.12;
    const h5 = Math.sin(2 * Math.PI * freq * 5 * t) * 0.06;
    const h6 = Math.sin(2 * Math.PI * freq * 6 * t) * 0.03;

    // Slight detuning for richness
    const detune = Math.sin(2 * Math.PI * (freq * 1.002) * t) * 0.08;

    // Hammer hit transient (first few ms)
    const hammer = t < 0.008 ? Math.sin(2 * Math.PI * freq * 4 * t) * (1 - t / 0.008) * 0.3 : 0;

    const sample = (fundamental + h2 + h3 + h4 + h5 + h6 + detune + hammer) * envelope * 0.35;
    const val = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  return buffer;
}

// Get all unique frequencies from Mario notes
const allNotes = [...new Set(MARIO_NOTES)];
console.log(`Generating ${allNotes.length} piano note WAV files...`);

allNotes.forEach(freq => {
  const filename = `note_${freq}.wav`;
  const filepath = path.join(audioDir, filename);
  const wav = generatePianoNote(freq, 0.45);
  fs.writeFileSync(filepath, wav);
  console.log(`  ${filename} (${freq} Hz)`);
});

console.log('Done!');
