// Generate synthetic WAV audio files for the World Cup simulation
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

const SAMPLE_RATE = 44100;

// WAV file writer
function writeWav(filename, samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);       // chunk size
  buffer.writeUInt16LE(1, 20);        // PCM
  buffer.writeUInt16LE(1, 22);        // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);        // block align
  buffer.writeUInt16LE(16, 34);       // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  const filepath = path.join(audioDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated: ${filepath} (${(numSamples / sampleRate).toFixed(2)}s)`);
}

// --- WHISTLE (referee) ---
function generateWhistle() {
  const duration = 0.8;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    // High pitched whistle with vibrato
    const freq = 3200 + Math.sin(t * 30) * 200;
    const envelope = t < 0.05 ? t / 0.05 : t > 0.6 ? (0.8 - t) / 0.2 : 1;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.5 * envelope;
  }
  writeWav('whistle.wav', samples);
}

// --- GOAL HORN ---
function generateGoalHorn() {
  const duration = 2.5;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = t < 0.1 ? t / 0.1 : t > 2.0 ? (2.5 - t) / 0.5 : 1;
    // Deep horn with harmonics
    const f1 = Math.sin(2 * Math.PI * 220 * t) * 0.4;
    const f2 = Math.sin(2 * Math.PI * 277 * t) * 0.3;
    const f3 = Math.sin(2 * Math.PI * 330 * t) * 0.2;
    samples[i] = (f1 + f2 + f3) * envelope;
  }
  writeWav('goal.wav', samples);
}

// --- KICK (ball hit) ---
function generateKick() {
  const duration = 0.15;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 40);
    // Short percussive hit — low thud + high click
    const low = Math.sin(2 * Math.PI * 80 * t * Math.exp(-t * 20)) * 0.6;
    const click = Math.sin(2 * Math.PI * 1500 * t) * 0.3 * Math.exp(-t * 80);
    samples[i] = (low + click) * envelope;
  }
  writeWav('kick.wav', samples);
}

// --- WALL BOUNCE ---
function generateBounce() {
  const duration = 0.1;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 50);
    samples[i] = Math.sin(2 * Math.PI * 400 * t) * 0.3 * envelope;
  }
  writeWav('bounce.wav', samples);
}

// --- CROWD AMBIANCE (loopable, 10 seconds) ---
function generateCrowdAmbiance() {
  const duration = 10;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  // Multiple noise bands filtered to sound like a crowd
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    // Base crowd noise (filtered white noise)
    let noise = (Math.random() * 2 - 1) * 0.08;
    // Add some slow undulation (crowd waves)
    noise *= 0.7 + 0.3 * Math.sin(t * 0.5) * Math.sin(t * 0.3);
    // Occasional louder moments
    if (Math.sin(t * 1.7) > 0.95) noise *= 2;
    samples[i] = noise;
  }
  // Simple low-pass filter (running average)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < samples.length; i++) {
      samples[i] = samples[i] * 0.3 + samples[i - 1] * 0.7;
    }
  }
  writeWav('crowd.wav', samples);
}

// --- BACKGROUND MUSIC (simple energetic beat, 65 seconds) ---
function generateBGM() {
  const duration = 65;
  const samples = new Float32Array(SAMPLE_RATE * duration);
  const bpm = 128;
  const beatLen = 60 / bpm;

  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const beatPos = (t % beatLen) / beatLen;

    // Kick drum on beats
    let kick = 0;
    if (beatPos < 0.1) {
      const kt = beatPos / 0.1;
      kick = Math.sin(2 * Math.PI * 60 * kt * (1 - kt * 0.5)) * (1 - kt) * 0.35;
    }

    // Hi-hat on off-beats
    let hihat = 0;
    const halfBeatPos = (t % (beatLen / 2)) / (beatLen / 2);
    if (halfBeatPos < 0.03) {
      hihat = (Math.random() * 2 - 1) * (1 - halfBeatPos / 0.03) * 0.12;
    }

    // Bass line (simple pattern)
    const barPos = (t % (beatLen * 4)) / (beatLen * 4);
    const bassNote = barPos < 0.25 ? 55 : barPos < 0.5 ? 65 : barPos < 0.75 ? 73 : 55;
    const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.15;

    // Pad (sustained chord)
    const padEnv = 0.5 + 0.5 * Math.sin(t * 0.2);
    const pad = (
      Math.sin(2 * Math.PI * 220 * t) * 0.03 +
      Math.sin(2 * Math.PI * 277 * t) * 0.02 +
      Math.sin(2 * Math.PI * 330 * t) * 0.02
    ) * padEnv;

    // Fade in/out
    let masterVol = 0.8;
    if (t < 2) masterVol *= t / 2;
    if (t > 62) masterVol *= (65 - t) / 3;

    samples[i] = (kick + hihat + bass + pad) * masterVol;
  }

  writeWav('bgm.wav', samples);
}

// Generate all
console.log('Generating audio files...');
generateWhistle();
generateGoalHorn();
generateKick();
generateBounce();
generateCrowdAmbiance();
generateBGM();
console.log('All audio files generated!');
