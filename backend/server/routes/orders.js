'use strict';

const express = require('express');
const db = require('../db');
const { getCatalogue } = require('../catalogue');
const { toLineString } = require('../matcher');

const router = express.Router();
const CHANNELS = ['amazon_mfn', 'shopify', 'walmart', '3pl_client'];
const fail = (res, e) => res.status(e.status || 400).json({ error: e.message });

router.get('/orders', (req, res) => {
  try { res.json({ orders: db.listOrders(req.query.org_id) }); } catch (e) { fail(res, e); }
});

router.post('/orders', (req, res) => {
  const { org_id, channel, lines, order_id } = req.body || {};
  try {
    db.assertValidOrg(org_id);
    if (!CHANNELS.includes(channel)) return res.status(400).json({ error: `channel must be one of ${CHANNELS.join(', ')}` });
    if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ error: 'Add at least one line.' });
    const known = new Set(getCatalogue().map((c) => c.sku));
    const map = {};
    for (const l of lines) {
      const qty = parseInt(l.qty, 10);
      if (!known.has(l.sku)) return res.status(400).json({ error: `Unknown SKU ${l.sku}` });
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: 'Quantity must be 1-99.' });
      map[l.sku] = (map[l.sku] || 0) + qty;
    }
    const clean = order_id && /^[A-Za-z0-9-]{3,40}$/.test(order_id) ? order_id : undefined;
    res.json({ order: db.createOrder(org_id, { order_id: clean, channel, order_lines: toLineString(map) }) });
  } catch (e) { fail(res, e); }
});

router.delete('/orders/:id', (req, res) => {
  try { return db.deleteOrder(req.query.org_id, req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Order not found' }); } catch (e) { fail(res, e); }
});

module.exports = router;
