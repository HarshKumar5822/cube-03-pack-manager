'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { runSimulated, runVision } = require('../../eval/run-eval');
const { getConfig } = require('../config');

const router = express.Router();

router.get('/eval/scenarios', (req, res) => {
  res.json({ scenarios: JSON.parse(fs.readFileSync(path.join(getConfig().dataDir, 'eval_set.json'), 'utf8')) });
});

router.post('/eval/run', async (req, res) => {
  try {
    const wantVision = req.query.vision === 'true' || (req.body && req.body.vision === true);
    const simulated = runSimulated();
    const vision = wantVision ? await runVision() : { skipped: true, reason: 'Vision-in-the-loop run not requested.' };
    res.json({ simulated, vision });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/eval/report', (req, res) => {
  const p = path.join(__dirname, '..', '..', 'eval', 'eval-report.md');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No report yet. Run npm run eval.' });
  res.type('text/markdown').send(fs.readFileSync(p, 'utf8'));
});

module.exports = router;
