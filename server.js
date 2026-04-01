import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Serve rendered videos
app.use('/out', express.static(path.join(__dirname, 'out')));

// Ensure output dir exists
if (!fs.existsSync(path.join(__dirname, 'out'))) {
  fs.mkdirSync(path.join(__dirname, 'out'));
}

// Cache the bundle URL
let bundleUrl = null;

// Render status tracking
const renderJobs = {};

app.post('/api/render', async (req, res) => {
  const { compositionId = 'WorldCup', props = {} } = req.body;
  const jobId = `${compositionId}_${Date.now()}`;
  const outputFile = path.join(__dirname, 'out', `${jobId}.mp4`);

  renderJobs[jobId] = { status: 'bundling', progress: 0, file: null };
  res.json({ jobId });

  // Run render in background
  (async () => {
    try {
      // Bundle (cached after first time)
      if (!bundleUrl) {
        console.log('Bundling Remotion project...');
        bundleUrl = await bundle({
          entryPoint: path.join(__dirname, 'remotion', 'index.jsx'),
          webpackOverride: (config) => config,
        });
        console.log('Bundle ready (cached for next renders)');
      }

      renderJobs[jobId].status = 'composing';

      // Get composition
      const composition = await selectComposition({
        serveUrl: bundleUrl,
        id: compositionId,
        inputProps: props,
      });

      renderJobs[jobId].status = 'rendering';

      // Render
      await renderMedia({
        composition,
        serveUrl: bundleUrl,
        codec: 'h264',
        crf: 18,
        outputLocation: outputFile,
        inputProps: props,
        onProgress: ({ progress }) => {
          renderJobs[jobId].progress = Math.round(progress * 100);
        },
      });

      renderJobs[jobId].status = 'done';
      renderJobs[jobId].file = `/out/${jobId}.mp4`;
      console.log(`Render complete: ${outputFile}`);
    } catch (err) {
      console.error('Render error:', err);
      renderJobs[jobId].status = 'error';
      renderJobs[jobId].error = err.message;
    }
  })();
});

// Check render progress
app.get('/api/render/:jobId', (req, res) => {
  const job = renderJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// List available compositions
app.get('/api/compositions', (req, res) => {
  res.json({
    compositions: [
      { id: 'WorldCup', name: 'World Cup Match', params: ['homeTeam', 'awayTeam', 'seed', 'matchInfo'] },
    ],
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Render server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('  POST /api/render        — Start a render job');
  console.log('  GET  /api/render/:jobId — Check render progress');
  console.log('  GET  /api/compositions  — List available compositions');
});
