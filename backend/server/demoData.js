'use strict';

/**
 * Demo records for the dashboards. They are ALWAYS flagged _meta.synthetic and shown as
 * "Demo data" in the UI. Sources: the official pack_sample.csv and the 21 hand-written
 * benchmark scenarios. Dates for scenarios are spread deterministically (no randomness).
 */

const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config');
const { getCatalogue } = require('./catalogue');
const { evaluatePacking, parseLineString } = require('./matcher');
const { validateEvidenceRecord } = require('./evidenceContract');

const CHANNELS = ['amazon_mfn', 'shopify', 'walmart', '3pl_client'];
const OPERATORS = ['op_amira', 'op_ben', 'op_dana'];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    const row = {};
    head.forEach((h, i) => { row[h] = (c[i] || '').trim(); });
    return row;
  });
}

function build() {
  const cfg = getConfig();
  const catalogue = getCatalogue();
  const known = new Set(catalogue.map((c) => c.sku));
  const out = [];

  const make = (base, order_lines, detected, flags, source, extraMeta = {}) => {
    const ev = evaluatePacking(order_lines, detected, flags, { confidenceThreshold: cfg.confidenceThreshold, catalogue });
    const rec = {
      ...base,
      photo_refs: [],
      order_lines,
      observed_in_box: ev.observed_in_box,
      agent_verdict: ev.verdict,
      discrepancy_types: ev.discrepancy_types,
      checks: ev.checks,
      confidence_score: ev.confidence_score,
      _meta: {
        synthetic: true, demo_source: source, operator_id: base.operator_id || null, issues: ev.issues, findings: ev.findings,
        line_items: ev.lineItems, unmapped_detections: [], vision_notes: 'Demo record - no photo and no AI call.',
        image_quality_flags: flags, model_used: null, provider: null, ...extraMeta,
      },
    };
    delete rec.operator_id;
    return rec;
  };

  // 1) official sample file: real dates, observed taken as given
  parseCsv(fs.readFileSync(path.join(cfg.dataDir, 'pack_sample.csv'), 'utf8')).forEach((row) => {
    const ok = Object.keys({ ...parseLineString(row.order_lines), ...parseLineString(row.observed_in_box) }).every((s) => known.has(s));
    if (!ok) return;
    const detected = Object.entries(parseLineString(row.observed_in_box)).map(([sku, quantity]) => ({ sku, quantity, confidence: 0.9 }));
    out.push(make({
      record_id: row.record_id, unit_id: row.unit_id, org_id: row.org_id, order_id: row.order_id,
      channel: row.channel, captured_at: row.captured_at, operator_id: row.operator_id,
    }, row.order_lines, detected, [], 'sample_csv'));
  });

  // 2) benchmark scenarios, spread over the 14 days before "now"
  const scenarios = JSON.parse(fs.readFileSync(path.join(cfg.dataDir, 'eval_set.json'), 'utf8'));
  const now = Date.now();
  scenarios.forEach((s, i) => {
    const t = new Date(now - ((i * 5) % 14) * 86400000 - ((i * 37) % 9) * 3600000).toISOString();
    const rec = make({
      record_id: `PCK-DEMO-${String(i + 1).padStart(4, '0')}`, unit_id: s.unit_id, org_id: i % 3 === 2 ? 'org_demo_bravo' : 'org_demo_alpha',
      order_id: `ORD-DEMO-${60000 + i}`, channel: CHANNELS[i % 4], captured_at: t, operator_id: OPERATORS[i % 3],
    }, s.order_lines, s.detected_items, s.image_quality_flags || [], 'benchmark_scenario', { scenario: s.scenario });
    rec._meta.latency_ms = null;
    if (i === 10) {
      rec.operator_override = { original_verdict: rec.agent_verdict, new_verdict: 'SEAL', operator_id: 'op_ben', override_reason: 'Demo: supervisor confirmed the missing item was a free gift.', override_at: t };
    }
    out.push(rec);
  });

  // 3) two "AI unreachable" demo records so the pending state is visible in charts
  [0, 1].forEach((k) => {
    out.push({
      record_id: `PCK-DEMO-P${k + 1}`, unit_id: `UNIT-70${k + 1}0`, org_id: 'org_demo_alpha', order_id: `ORD-DEMO-7${k}`, channel: 'shopify',
      captured_at: new Date(now - (k + 1) * 86400000).toISOString(), photo_refs: [], order_lines: 'SKU-MUG-11:1', observed_in_box: '',
      agent_verdict: 'PENDING_REVIEW', discrepancy_types: ['NETWORK_TIMEOUT'],
      checks: { all_items_present: 'UNCERTAIN', quantities_correct: 'UNCERTAIN', no_extra_items: 'UNCERTAIN' }, confidence_score: 0,
      _meta: { synthetic: true, demo_source: 'pending', issues: ['AI unavailable: demo of fail-open. Box held for manual review.'], findings: [], line_items: [], unmapped_detections: [], image_quality_flags: [], model_used: null },
    });
  });

  return out.filter((r) => validateEvidenceRecord(r).valid);
}

module.exports = { build };
