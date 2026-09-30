'use strict';
// Replaces all demo (synthetic) records. Live records are never touched.
const db = require('../server/db');
const demo = require('../server/demoData');
const removed = db.deleteSynthetic();
const n = db.insertMany(demo.build());
console.log(`Removed ${removed} old demo records, inserted ${n} demo records (flagged synthetic).`);

// First-run convenience: a few open orders so the Bench is not empty. Only added when no orders exist.
const sampleOrders = [
  ['shopify', 'SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1'],
  ['amazon_mfn', 'SKU-CABLE-USBC:1'],
  ['3pl_client', 'SKU-CAP-BLU:2'],
];
if (!db.listOrders('org_demo_alpha').length) {
  sampleOrders.forEach(([channel, order_lines]) => db.createOrder('org_demo_alpha', { channel, order_lines }));
  console.log(`Created ${sampleOrders.length} open sample orders in org_demo_alpha.`);
}
