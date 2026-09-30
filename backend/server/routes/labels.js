'use strict';

/** Label desk: stores a human labeller's answers for the product photo set. */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');

const router = express.Router();
const file = () => path.join(getConfig().dataDir, 'labels.json');
const Q1 = ['yes', 'no', 'not sure'];
const Q2 = ['yes', 'no', 'not sure'];
const Q3 = ['like new', 'very good', 'good', 'acceptable', 'not sure'];

function load() { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; } }
function save(o) { const t = `${file()}.tmp`; fs.writeFileSync(t, JSON.stringify(o, null, 2)); fs.renameSync(t, file()); }

router.get('/labels', (req, res) => res.json({ labels: load() }));

router.put('/labels/:product', (req, res) => {
  const id = req.params.product;
  if (!/^[A-Za-z0-9-]{2,40}$/.test(id)) return res.status(400).json({ error: 'Bad product id' });
  const b = req.body || {};
  if (b.q1 && !Q1.includes(b.q1)) return res.status(400).json({ error: 'q1 must be yes, no or not sure' });
  if (b.q2 && !Q2.includes(b.q2)) return res.status(400).json({ error: 'q2 must be yes, no or not sure' });
  if (b.q3 && !Q3.includes(b.q3)) return res.status(400).json({ error: `q3 must be one of ${Q3.join(', ')}` });
  const all = load();
  all[id] = { q1: b.q1 || null, q2: b.q2 || null, q3: b.q3 || null, sku_asin: String(b.sku_asin || 'UNKNOWN').trim() || 'UNKNOWN', updated_at: new Date().toISOString() };
  save(all);
  res.json({ label: all[id] });
});

router.get('/labels.csv', (req, res) => {
  const all = load();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['product,sku_or_asin,matches_details,parts_visible,visible_condition'];
  Object.keys(all).sort().forEach((k) => rows.push([k, all[k].sku_asin, all[k].q1, all[k].q2, all[k].q3].map(esc).join(',')));
  res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="product-labels.csv"').send(rows.join('\n'));
});

module.exports = router;
