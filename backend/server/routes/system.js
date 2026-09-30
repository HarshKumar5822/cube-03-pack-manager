'use strict';

const express = require('express');
const db = require('../db');
const { getConfig } = require('../config');
const { listModels } = require('../ai/providers');
const demo = require('../demoData');
const { evaluatePacking } = require('../matcher');
const { getCatalogue } = require('../catalogue');

const router = express.Router();

router.get('/health', (req, res) => {
  const c = getConfig();
  res.json({
    ok: true,
    provider: c.activeProvider,
    configured: Boolean(c.activeProvider),
    models: c.activeProvider ? c[c.activeProvider].models : [],
    confidenceThreshold: c.confidenceThreshold,
    maxPhotos: c.maxPhotos,
    referenceImageLimit: c.activeProvider === 'anthropic' ? c.referenceImageLimit : 0,
    costPerDefect: c.costPerDefect,
    forceFailure: c.forceFailure,
  });
});

// Asks the provider which models it really serves (flags retired model IDs).
router.get('/system/models', async (req, res) => {
  const c = getConfig();
  const out = await listModels(c);
  const configured = c.activeProvider ? c[c.activeProvider].models : [];
  res.json({ ...out, configured: configured.map((m) => ({ id: m, available: out.models.length ? out.models.includes(m) : null })) });
});

router.post('/demo/seed', (req, res) => {
  const removed = db.deleteSynthetic();
  const inserted = db.insertMany(demo.build());
  res.json({ removed, inserted });
});
router.delete('/demo', (req, res) => res.json({ removed: db.deleteSynthetic() }));

// Logic lab: run the matcher on hand-entered "what the AI saw". Nothing is saved.
router.post('/simulate', (req, res) => {
  const { order_lines, detected_items, image_quality_flags, unmapped } = req.body || {};
  if (!order_lines) return res.status(400).json({ error: 'order_lines is required' });
  res.json(evaluatePacking(order_lines, Array.isArray(detected_items) ? detected_items : [], Array.isArray(image_quality_flags) ? image_quality_flags : [], {
    confidenceThreshold: getConfig().confidenceThreshold, catalogue: getCatalogue(), unmapped: Array.isArray(unmapped) ? unmapped : [],
  }));
});

// Tenancy check: proves a record cannot be read through another org's scope.
router.post('/tenancy/leak-test', (req, res) => {
  const { record_id, requesting_org_id } = req.body || {};
  if (!record_id || !requesting_org_id) return res.status(400).json({ error: 'record_id and requesting_org_id are required' });
  try {
    const scoped = db.getRecordScoped(record_id, requesting_org_id);
    const actual = db.unsafeGetRecordAnyOrg(record_id);
    res.json({ requesting_org_id, record_id, exists: Boolean(actual), actual_owner_org: actual ? actual.org_id : null, scoped_result_returned: Boolean(scoped), isolation_held: !actual || actual.org_id === requesting_org_id || scoped === null });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
router.get('/tenancy/orgs', (req, res) => res.json({ orgs: db.VALID_ORGS }));

module.exports = router;
