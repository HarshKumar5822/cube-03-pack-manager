'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { getConfig } = require('../config');
const { ask, ruleBasedBriefing } = require('../ai/copilot');

const router = express.Router();
const fail = (res, e) => res.status(e.status || 400).json({ error: e.message });

router.get('/records', (req, res) => {
  const { org_id, scope } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id query param is required' });
  try {
    const synthetic = scope === 'demo' ? 'only' : scope === 'all' ? 'all' : 'exclude';
    res.json({ records: db.listRecordsForOrg(org_id, { synthetic }), counts: db.countsForOrg(org_id) });
  } catch (e) { fail(res, e); }
});

router.get('/records/:id', (req, res) => {
  try {
    const record = db.getRecordScoped(req.params.id, req.query.org_id);
    if (!record) return res.status(404).json({ error: 'Record not found for this org' });
    res.json({ record, briefing: ruleBasedBriefing(record) });
  } catch (e) { fail(res, e); }
});

router.post('/records/:id/override', (req, res) => {
  const { org_id, operator_id, new_verdict, override_reason } = req.body;
  if (!org_id || !operator_id || !new_verdict || !override_reason) return res.status(400).json({ error: 'org_id, operator_id, new_verdict and override_reason are required' });
  if (!['SEAL', 'STOP_AND_FIX', 'UNCERTAIN'].includes(new_verdict)) return res.status(400).json({ error: 'new_verdict must be SEAL, STOP_AND_FIX or UNCERTAIN' });
  if (String(override_reason).trim().length < 8) return res.status(400).json({ error: 'Give a reason of at least 8 characters so the override can be audited.' });
  try {
    const rec = db.applyOverride(req.params.id, org_id, { operator_id, new_verdict, override_reason: String(override_reason).trim() });
    if (!rec) return res.status(404).json({ error: 'Record not found for this org' });
    res.json({ record: rec });
  } catch (e) { fail(res, e); }
});

router.post('/copilot', async (req, res) => {
  const { org_id, record_id, question, history } = req.body;
  try {
    const record = db.getRecordScoped(record_id, org_id);
    if (!record) return res.status(404).json({ error: 'Record not found for this org' });
    res.json(await ask(getConfig(), record, question, Array.isArray(history) ? history : []));
  } catch (e) { fail(res, e); }
});

// Evidence photos are served only to the org that owns the record, with nosniff.
router.get('/evidence/:file', (req, res) => {
  try {
    const file = path.basename(req.params.file);
    if (!db.recordReferencingPhoto(file, req.query.org_id)) return res.status(404).json({ error: 'Not found' });
    const full = path.join(getConfig().dataDir, 'uploads', file);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Photo file is missing' });
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(full);
  } catch (e) { fail(res, e); }
});

router.get('/overrides', (req, res) => {
  try { res.json({ overrides: db.listOverridesForOrg(req.query.org_id) }); } catch (e) { fail(res, e); }
});

module.exports = router;
