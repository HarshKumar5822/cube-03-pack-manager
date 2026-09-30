'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = require('../db');
const { getConfig } = require('../config');
const { getCatalogue } = require('../catalogue');
const { perceiveBox, usableCatalogue } = require('../ai/perception');
const { evaluatePacking, parseLineString } = require('../matcher');
const { validateEvidenceRecord } = require('../evidenceContract');
const { sniffImage } = require('../images');

const router = express.Router();
const CHANNELS = ['amazon_mfn', 'shopify', 'walmart', '3pl_client'];
const uploadDir = () => path.join(getConfig().dataDir, 'uploads');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 3 } }).array('photos', 3);

function bad(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}

router.post('/analyze', (req, res) => {
  upload(req, res, async (mErr) => {
    if (mErr) return bad(res, mErr.code === 'LIMIT_FILE_SIZE' ? 'A photo is larger than 10 MB.' : mErr.code === 'LIMIT_UNEXPECTED_FILE' ? 'Send at most 3 photos in the "photos" field.' : mErr.message, mErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    const started = Date.now();
    try {
      const cfg = getConfig();
      const { org_id, unit_id, order_id, channel, order_lines, operator_id } = req.body;
      if (!org_id || !unit_id || !order_id || !channel || !order_lines) return bad(res, 'org_id, unit_id, order_id, channel and order_lines are required.');
      try { db.assertValidOrg(org_id); } catch (e) { return bad(res, e.message); }
      if (!/^UNIT-[0-9]{4}$/.test(unit_id)) return bad(res, 'unit_id must look like UNIT-1234.');
      if (!CHANNELS.includes(channel)) return bad(res, `channel must be one of ${CHANNELS.join(', ')}.`);

      const expected = parseLineString(order_lines);
      const catalogue = getCatalogue();
      const unknown = Object.keys(expected).filter((s) => !catalogue.some((c) => c.sku === s));
      if (!Object.keys(expected).length) return bad(res, 'order_lines is empty.');
      if (unknown.length) return bad(res, `Order contains SKUs that are not in the catalogue: ${unknown.join(', ')}.`);

      const files = req.files || [];
      if (!files.length) return bad(res, 'Attach at least one photo of the open box (field "photos").');
      const photos = [];
      for (const f of files) {
        const kind = sniffImage(f.buffer);
        if (!kind) return bad(res, `"${f.originalname}" is not a JPEG, PNG or WebP image.`);
        photos.push({ buffer: f.buffer, mime: kind.mime, ext: kind.ext });
      }

      // Persist evidence first, so a failed AI call never loses the capture (fail-open).
      const recordId = `PCK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuid().slice(0, 8)}`;
      fs.mkdirSync(uploadDir(), { recursive: true });
      const photoRefs = photos.map((p, i) => {
        const name = `${recordId}_${i + 1}.${p.ext}`; // extension comes from the real bytes, never the client
        fs.writeFileSync(path.join(uploadDir(), name), p.buffer);
        return `evidence/${name}`;
      });

      const usable = new Set(usableCatalogue(cfg, catalogue).map((c) => c.sku));
      const unverifiable = Object.keys(expected).filter((s) => !usable.has(s));
      const base = { record_id: recordId, unit_id, org_id, order_id, channel, captured_at: new Date().toISOString(), photo_refs: photoRefs, order_lines };
      let record;
      try {
        const p = await perceiveBox({ cfg, photos });
        const ev = evaluatePacking(order_lines, p.items.map((i) => ({ sku: i.sku, quantity: i.quantity, confidence: i.confidence })), p.flags, {
          confidenceThreshold: cfg.confidenceThreshold, catalogue, unmapped: p.unmapped, unverifiable,
        });
        record = {
          ...base,
          observed_in_box: ev.observed_in_box,
          agent_verdict: ev.verdict,
          discrepancy_types: ev.discrepancy_types,
          checks: ev.checks,
          confidence_score: ev.confidence_score,
          _meta: {
            operator_id: operator_id || null, issues: ev.issues, findings: ev.findings, line_items: ev.lineItems,
            detections: p.items, unmapped_detections: p.unmapped, vision_notes: p.notes, image_quality_flags: p.flags,
            provider: p.provider, model_used: p.model, reference_images: p.reference_images, usage: p.usage || null,
            photo_count: photos.length, ai_latency_ms: p.latency_ms, latency_ms: Date.now() - started,
          },
        };
      } catch (err) {
        // FAIL OPEN: no fabricated perception. The box is held for a human and the photo is kept.
        record = {
          ...base,
          observed_in_box: '',
          agent_verdict: 'PENDING_REVIEW',
          discrepancy_types: ['NETWORK_TIMEOUT'],
          checks: { all_items_present: 'UNCERTAIN', quantities_correct: 'UNCERTAIN', no_extra_items: 'UNCERTAIN' },
          confidence_score: 0,
          _meta: {
            operator_id: operator_id || null, findings: [], line_items: [], detections: [], unmapped_detections: [], image_quality_flags: [],
            issues: [`AI check did not run: ${err.message}. The photo is saved. Hold the box for a manual check.`],
            provider: cfg.activeProvider, model_used: null, error: err.message, photo_count: photos.length, latency_ms: Date.now() - started,
          },
        };
      }

      const { valid, errors } = validateEvidenceRecord(record);
      if (!valid) record._meta.contract_validation_errors = errors;
      db.insertRecord(record);
      db.updateOrderByUnit(org_id, unit_id, {
        status: record.agent_verdict === 'SEAL' ? 'sealed-ok' : record.agent_verdict === 'STOP_AND_FIX' ? 'held' : 'review',
        record_id: recordId,
      });
      return res.json({ record, contract_valid: valid, contract_errors: errors });
    } catch (err) {
      console.error('analyze failure', err);
      return bad(res, err.message || 'Internal error', 500);
    }
  });
});

module.exports = router;
