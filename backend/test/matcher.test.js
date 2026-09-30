'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluatePacking } = require('../server/matcher');
const { getCatalogue } = require('../server/catalogue');

const cat = getCatalogue();
const ev = (order, det, flags = [], extra = {}) => evaluatePacking(order, det, flags, { catalogue: cat, ...extra });
const d = (sku, quantity, confidence = 0.92) => ({ sku, quantity, confidence });

test('correct order seals', () => {
  const r = ev('SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1', [d('SKU-TSHIRT-BLK', 2), d('SKU-CAP-BLU', 1)]);
  assert.equal(r.verdict, 'SEAL');
});

test('brief example: blue cap expected, red cap seen -> STOP with wrong item', () => {
  const r = ev('SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1', [d('SKU-TSHIRT-BLK', 2), d('SKU-CAP-RED', 1)]);
  assert.equal(r.verdict, 'STOP_AND_FIX');
  assert.deepEqual(r.discrepancy_types, ['WRONG_ITEM']);
  assert.match(r.issues[0], /expected Blue Cap.*Red Cap/i);
  assert.equal(r.checks.no_extra_items, 'PASS'); // a swap is counted once
});

test('missing item, clear photo -> STOP', () => {
  const r = ev('SKU-TSHIRT-BLK:1;SKU-MUG-11:1', [d('SKU-TSHIRT-BLK', 1)]);
  assert.equal(r.verdict, 'STOP_AND_FIX');
  assert.ok(r.discrepancy_types.includes('MISSING_ITEM'));
});

test('missing item but photo is blurry -> UNCERTAIN, never a confident "missing"', () => {
  const r = ev('SKU-TSHIRT-BLK:1;SKU-MUG-11:1', [d('SKU-TSHIRT-BLK', 1)], ['blurry']);
  assert.equal(r.verdict, 'UNCERTAIN');
  assert.ok(!r.discrepancy_types.includes('MISSING_ITEM'));
});

test('short count from an occluded photo is UNCERTAIN, excess is still a failure', () => {
  assert.equal(ev('SKU-TOWEL-BLU:3', [d('SKU-TOWEL-BLU', 2)], ['partial_occlusion']).verdict, 'UNCERTAIN');
  assert.equal(ev('SKU-TOWEL-BLU:1', [d('SKU-TOWEL-BLU', 2)], ['partial_occlusion']).verdict, 'STOP_AND_FIX');
});

test('extra item seen clearly -> STOP; seen weakly -> UNCERTAIN', () => {
  assert.equal(ev('SKU-MUG-11:1', [d('SKU-MUG-11', 1), d('SKU-CABLE-USBC', 1)]).verdict, 'STOP_AND_FIX');
  assert.equal(ev('SKU-MUG-11:1', [d('SKU-MUG-11', 1), d('SKU-CABLE-USBC', 1, 0.4)]).verdict, 'UNCERTAIN');
});

test('an unidentified object stops a box being sealed on "nothing extra"', () => {
  const r = ev('SKU-MUG-11:1', [d('SKU-MUG-11', 1)], [], { unmapped: [{ name_guess: 'grey gadget' }] });
  assert.equal(r.checks.no_extra_items, 'UNCERTAIN');
  assert.equal(r.verdict, 'UNCERTAIN');
});

test('nothing detected at all is UNCERTAIN, not "everything is missing"', () => {
  const r = ev('SKU-MUG-11:1', []);
  assert.equal(r.verdict, 'UNCERTAIN');
  assert.deepEqual(Object.values(r.checks), ['UNCERTAIN', 'UNCERTAIN', 'UNCERTAIN']);
});

test('multiple identical products are counted', () => {
  assert.equal(ev('SKU-MUG-11:4', [d('SKU-MUG-11', 4)]).verdict, 'SEAL');
  assert.equal(ev('SKU-MUG-11:4', [d('SKU-MUG-11', 3)]).verdict, 'STOP_AND_FIX');
});

test('unrelated missing + extra are reported separately, not as a swap', () => {
  const r = ev('SKU-TSHIRT-BLK:1', [d('SKU-LEASH-6FT', 1)]);
  assert.equal(r.verdict, 'STOP_AND_FIX');
  assert.ok(r.discrepancy_types.includes('MISSING_ITEM') && r.discrepancy_types.includes('EXTRA_ITEM'));
});

test('a confirmed defect is never softened by a flag elsewhere', () => {
  const r = ev('SKU-MUG-11:1', [d('SKU-MUG-11', 1), d('SKU-CABLE-USBC', 1)], ['glare']);
  assert.equal(r.verdict, 'STOP_AND_FIX');
});

test('a product the AI has no description for is "cannot verify", never a confident missing', () => {
  const r = ev('SKU-MUG-11:1', [d('SKU-TSHIRT-BLK', 1)], [], { unverifiable: ['SKU-MUG-11'] });
  assert.ok(!r.discrepancy_types.includes('MISSING_ITEM'));
  assert.match(r.issues.join(' '), /Cannot verify/);
});
