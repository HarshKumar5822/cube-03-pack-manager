'use strict';

const express = require('express');
const db = require('../db');
const { getConfig } = require('../config');
const { computeStats } = require('../stats');

const router = express.Router();

router.get('/stats', (req, res) => {
  const { org_id, mode } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id query param is required' });
  try {
    const synthetic = mode === 'demo' ? 'only' : 'exclude';
    const records = db.listRecordsForOrg(org_id, { synthetic, limit: 100000 });
    res.json({ mode: mode === 'demo' ? 'demo' : 'live', counts: db.countsForOrg(org_id), stats: computeStats(records, { costPerDefect: getConfig().costPerDefect }) });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

module.exports = router;
