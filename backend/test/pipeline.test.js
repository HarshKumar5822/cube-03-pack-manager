'use strict';
/**
 * End-to-end: HTTP upload -> perception prompt -> (stub) model -> validation -> matcher -> record.
 * A local stub stands in for Groq / Anthropic so the whole pipeline runs without network or keys.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-'));
for (const f of ['catalogue.json', 'eval_set.json', 'pack_sample.csv']) fs.copyFileSync(path.join(__dirname, '..', 'data', f), path.join(tmp, f));
process.env.PACK_DATA_DIR = tmp;

let stub; let stubUrl; let app; let base;
const seen = [];
let respond = () => ({});

test.before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};
      seen.push({ url: req.url, headers: req.headers, body: parsed, raw: body });
      const out = respond(parsed, req);
      if (out && out.status) { res.writeHead(out.status, { 'content-type': 'application/json' }); return res.end(JSON.stringify(out.json || { error: 'x' })); }
      const text = typeof out === 'string' ? out : JSON.stringify(out);
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url.startsWith('/messages')) return res.end(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } }));
      res.end(JSON.stringify({ choices: [{ message: { content: text } }], usage: { total_tokens: 1 } }));
    });
  });
  await new Promise((r) => stub.listen(0, r));
  stubUrl = `http://127.0.0.1:${stub.address().port}`;
  Object.assign(process.env, { GROQ_API_KEY: 'test-key', GROQ_BASE_URL: stubUrl, VISION_PROVIDER: 'groq', VISION_TIMEOUT_MS: '3000' });
  delete process.env.ANTHROPIC_API_KEY;
  const { start } = require('../server/index.js');
  app = start(0);
  await new Promise((r) => app.on('listening', r));
  base = `http://127.0.0.1:${app.address().port}/api`;
});
test.after(() => { app.close(); stub.close(); });

const seenItem = (sku, quantity, confidence = 0.93, evidence = 'clear view') => ({ sku, name_guess: sku, quantity, confidence, evidence, box: [0.1, 0.1, 0.3, 0.3], photo: 1 });
const model = (items, flags = [], extra = {}) => ({ box_visible: true, detected_items: items, image_quality_flags: flags, notes: 'ok', ...extra });

async function analyze({ order = 'SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1', unit = 'UNIT-1001', org = 'org_demo_alpha', files = [PNG], filename = 'box.png', type = 'image/png' } = {}) {
  const fd = new FormData();
  Object.entries({ org_id: org, unit_id: unit, order_id: 'ORD-SECRET-123', channel: 'shopify', order_lines: order, operator_id: 'op_test' }).forEach(([k, v]) => fd.append(k, v));
  files.forEach((f) => fd.append('photos', new Blob([f], { type }), filename));
  const res = await fetch(`${base}/analyze`, { method: 'POST', body: fd });
  return { status: res.status, json: await res.json() };
}

test('correct order -> SEAL, and the model is blind to the order', async () => {
  seen.length = 0;
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1)]);
  const { status, json } = await analyze();
  assert.equal(status, 200);
  assert.equal(json.record.agent_verdict, 'SEAL');
  assert.equal(json.contract_valid, true);
  assert.equal(seen.length, 1, 'exactly one AI call per box');
  assert.ok(!seen[0].raw.includes('ORD-SECRET-123'), 'order id must not reach the model');
  assert.ok(!seen[0].raw.includes('SKU-TSHIRT-BLK:2'), 'order lines must not reach the model');
  const content = seen[0].body.messages[1].content;
  assert.equal(content.filter((p) => p.type === 'image_url').length, 1);
  assert.match(json.record.photo_refs[0], /^evidence\/PCK-.*\.png$/);
});

test('wrong item (blue cap ordered, red cap seen) -> STOP_AND_FIX', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-RED', 1)]);
  const { json } = await analyze({ unit: 'UNIT-1002' });
  assert.equal(json.record.agent_verdict, 'STOP_AND_FIX');
  assert.deepEqual(json.record.discrepancy_types, ['WRONG_ITEM']);
});

test('three photos go to the model in one call; a fourth is rejected', async () => {
  seen.length = 0;
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1)]);
  const ok = await analyze({ unit: 'UNIT-1003', files: [PNG, PNG, PNG] });
  assert.equal(ok.status, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].body.messages[1].content.filter((p) => p.type === 'image_url').length, 3);
  const bad = await analyze({ unit: 'UNIT-1004', files: [PNG, PNG, PNG, PNG] });
  assert.equal(bad.status, 400);
});

test('blurry photo + item not seen -> UNCERTAIN, not a confident "missing"', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2)], ['blurry']);
  const { json } = await analyze({ unit: 'UNIT-1005' });
  assert.equal(json.record.agent_verdict, 'UNCERTAIN');
  assert.ok(!json.record.discrepancy_types.includes('MISSING_ITEM'));
});

test('identification without visual evidence is not trusted -> UNCERTAIN', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2, 0.99, ''), seenItem('SKU-CAP-BLU', 1, 0.99, '')]);
  const { json } = await analyze({ unit: 'UNIT-1006' });
  assert.equal(json.record.agent_verdict, 'UNCERTAIN');
});

test('hallucinated SKU and unknown objects never become SEAL', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1), { sku: 'SKU-NOT-REAL', name_guess: 'grey gadget', quantity: 1, confidence: 0.9, evidence: 'grey box' }]);
  const { json } = await analyze({ unit: 'UNIT-1007' });
  assert.equal(json.record.agent_verdict, 'UNCERTAIN');
  assert.equal(json.record._meta.unmapped_detections.length, 1);
});

test('garbage model output fails open: PENDING_REVIEW, photo kept, nothing invented', async () => {
  respond = () => 'I am sorry, I cannot help with that.';
  const { status, json } = await analyze({ unit: 'UNIT-1008' });
  assert.equal(status, 200);
  assert.equal(json.record.agent_verdict, 'PENDING_REVIEW');
  assert.equal(json.record.observed_in_box, '');
  assert.equal(json.record.photo_refs.length, 1);
  assert.ok(fs.existsSync(path.join(tmp, 'uploads', path.basename(json.record.photo_refs[0]))));
});

test('retired primary model (404) falls back to the second model', async () => {
  seen.length = 0;
  respond = (body) => (body.model === 'qwen/qwen3.6-27b' ? { status: 404, json: { error: { message: 'model not found' } } } : model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1)]));
  const { json } = await analyze({ unit: 'UNIT-1009' });
  assert.equal(json.record.agent_verdict, 'SEAL');
  assert.equal(json.record._meta.model_used, 'qwen/qwen3.8-27b');
  assert.equal(seen.length, 2);
});

test('every model failing also fails open (no fabricated SEAL)', async () => {
  respond = () => ({ status: 500, json: { error: 'boom' } });
  const { json } = await analyze({ unit: 'UNIT-1010' });
  assert.equal(json.record.agent_verdict, 'PENDING_REVIEW');
});

test('HTML disguised as a photo is rejected and never stored', async () => {
  const before = fs.readdirSync(path.join(tmp, 'uploads')).length;
  const { status, json } = await analyze({ unit: 'UNIT-1011', files: [Buffer.from('<html><script>alert(1)</script></html>')], filename: 'box.jpg', type: 'image/jpeg' });
  assert.equal(status, 400);
  assert.match(json.error, /not a JPEG, PNG or WebP/);
  assert.equal(fs.readdirSync(path.join(tmp, 'uploads')).length, before);
});

test('order with an unknown SKU is rejected', async () => {
  const { status } = await analyze({ unit: 'UNIT-1012', order: 'SKU-DOES-NOT-EXIST:1' });
  assert.equal(status, 400);
});

test('evidence photos are only served to the owning org', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1)]);
  const { json } = await analyze({ unit: 'UNIT-1013' });
  const file = path.basename(json.record.photo_refs[0]);
  assert.equal((await fetch(`${base}/evidence/${file}?org_id=org_demo_alpha`)).status, 200);
  assert.equal((await fetch(`${base}/evidence/${file}?org_id=org_demo_bravo`)).status, 404);
  const rec = await fetch(`${base}/records/${json.record.record_id}?org_id=org_demo_bravo`);
  assert.equal(rec.status, 404);
});

test('co-pilot answers from the record via the model, and falls back to rules', async () => {
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-RED', 1)]);
  const { json } = await analyze({ unit: 'UNIT-1014' });
  respond = () => 'Swap the red cap for the blue cap, then rescan.';
  const a = await (await fetch(`${base}/copilot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: 'org_demo_alpha', record_id: json.record.record_id, question: 'what now?' }) })).json();
  assert.equal(a.source, 'ai');
  respond = () => ({ status: 500, json: {} });
  const b = await (await fetch(`${base}/copilot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: 'org_demo_alpha', record_id: json.record.record_id, question: 'why?' }) })).json();
  assert.equal(b.source, 'rules');
  assert.match(b.answer, /Hold the box/);
});

test('Anthropic provider: native request shape', async () => {
  seen.length = 0;
  Object.assign(process.env, { ANTHROPIC_API_KEY: 'ak-test', ANTHROPIC_BASE_URL: stubUrl, VISION_PROVIDER: 'anthropic' });
  respond = () => model([seenItem('SKU-TSHIRT-BLK', 2), seenItem('SKU-CAP-BLU', 1)]);
  const { json } = await analyze({ unit: 'UNIT-1015' });
  assert.equal(json.record.agent_verdict, 'SEAL');
  assert.equal(seen[0].url, '/messages');
  assert.equal(seen[0].headers['x-api-key'], 'ak-test');
  assert.equal(seen[0].headers['anthropic-version'], '2023-06-01');
  assert.equal(seen[0].body.model, 'claude-sonnet-5-5');
  assert.ok(seen[0].body.messages[0].content.some((p) => p.type === 'image' && p.source.type === 'base64'));
  assert.equal(typeof seen[0].body.system, 'string');
  delete process.env.ANTHROPIC_API_KEY; process.env.VISION_PROVIDER = 'groq';
});

test('no provider configured -> PENDING_REVIEW with a clear reason', async () => {
  delete process.env.GROQ_API_KEY;
  const { json } = await analyze({ unit: 'UNIT-1016' });
  assert.equal(json.record.agent_verdict, 'PENDING_REVIEW');
  assert.match(json.record._meta.issues[0], /No AI provider configured/);
  process.env.GROQ_API_KEY = 'test-key';
});
