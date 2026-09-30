'use strict';

/**
 * The matcher is the ONLY place a SEAL / STOP_AND_FIX / UNCERTAIN verdict is decided.
 * The AI is asked to perceive (what, how many, how sure, was the photo usable) and is never
 * asked to grade itself. Arithmetic stays deterministic and unit-testable without a model.
 *
 * Evidence principle (brief: "UNCERTAIN is valid, do not invent evidence"):
 *   - Only POSITIVE observations can FAIL a box: a different item seen, an extra item seen,
 *     more units seen than ordered, or an absence that the photo quality can actually support.
 *   - An absence or undercount claimed from a blurry / occluded / cropped photo, or from a
 *     low-confidence count, is UNCERTAIN - the item may simply be out of view.
 */

const SEVERITY = { PASS: 0, UNCERTAIN: 1, FAIL: 2 };
const raise = (cur, next) => (SEVERITY[next] > SEVERITY[cur] ? next : cur);

function parseLineString(str) {
  const map = {};
  if (!str) return map;
  String(str).split(';').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
    const idx = pair.lastIndexOf(':');
    const sku = (idx === -1 ? pair : pair.slice(0, idx)).trim();
    const qty = idx === -1 ? 1 : parseInt(pair.slice(idx + 1), 10);
    if (sku) map[sku] = (map[sku] || 0) + (Number.isFinite(qty) ? qty : 0);
  });
  return map;
}

function toLineString(map) {
  return Object.entries(map).map(([sku, qty]) => `${sku}:${qty}`).join(';');
}

// Which checks a photo-quality problem undermines when the check would otherwise PASS.
const IMAGE_FLAG_IMPACT = {
  blurry: ['all_items_present', 'quantities_correct', 'no_extra_items'],
  poor_lighting: ['all_items_present', 'quantities_correct', 'no_extra_items'],
  other: ['all_items_present', 'quantities_correct', 'no_extra_items'],
  glare: ['quantities_correct', 'no_extra_items'],
  partial_occlusion: ['all_items_present', 'quantities_correct'],
  box_partially_out_of_frame: ['no_extra_items'],
};

function entryFor(catalogue, sku) {
  return (catalogue || []).find((c) => c.sku === sku) || null;
}
function nameOf(catalogue, sku) {
  const e = entryFor(catalogue, sku);
  return e ? e.name : sku;
}

// Wrong-item pairing: "expected Blue Cap, found Red Cap". Only pair items that could plausibly be
// swapped (catalogue says they're look-alikes, or same category); otherwise report two facts.
function pairScore(catalogue, missingSku, foundSku) {
  const a = entryFor(catalogue, missingSku);
  const b = entryFor(catalogue, foundSku);
  if (!a || !b) return 0;
  const mentions = (x, sku) => (x.distinguish_from || []).some((d) => String(d).includes(sku));
  if (mentions(a, foundSku) || mentions(b, missingSku)) return 2;
  if (a.category && a.category === b.category) return 1;
  return 0;
}

function pairWrongItems(catalogue, missing, extra) {
  const cands = [];
  missing.forEach((m, mi) => extra.forEach((x, xi) => {
    const s = pairScore(catalogue, m, x);
    if (s > 0) cands.push({ m, x, s, order: mi * 100 + xi });
  }));
  cands.sort((p, q) => q.s - p.s || p.order - q.order);
  const usedM = new Set();
  const usedX = new Set();
  const pairs = [];
  cands.forEach((c) => {
    if (usedM.has(c.m) || usedX.has(c.x)) return;
    usedM.add(c.m);
    usedX.add(c.x);
    pairs.push({ expectedSku: c.m, foundSku: c.x, score: c.s });
  });
  return pairs;
}

/**
 * @param {string} orderLines   "SKU:qty;SKU:qty"
 * @param {Array<{sku,quantity,confidence}>} detectedItems  catalogue-mapped perception output
 * @param {string[]} imageQualityFlags
 * @param {{confidenceThreshold?:number, catalogue?:Array, unmapped?:Array<{name_guess:string}>}} opts
 */
function evaluatePacking(orderLines, detectedItems, imageQualityFlags = [], opts = {}) {
  const thr = opts.confidenceThreshold ?? 0.62;
  const catalogue = opts.catalogue || [];
  const unmapped = opts.unmapped || [];
  const unverifiable = new Set(opts.unverifiable || []); // SKUs the AI was given no description/photo for
  const flags = imageQualityFlags || [];
  const hasImageIssue = flags.length > 0;

  const expected = parseLineString(orderLines);
  const detected = {};
  (detectedItems || []).forEach((it) => {
    if (!it || !it.sku) return;
    const qty = Number.isFinite(it.quantity) ? Math.max(0, Math.round(it.quantity)) : 0;
    const d = (detected[it.sku] = detected[it.sku] || { qty: 0, conf: [] });
    d.qty += qty;
    d.conf.push(typeof it.confidence === 'number' ? it.confidence : 0.5);
  });
  // a perceived quantity of 0 is "not seen"
  Object.keys(detected).forEach((k) => { if (detected[k].qty === 0) delete detected[k]; });

  const minConf = (sku) => (detected[sku] ? Math.min(...detected[sku].conf) : null);
  const confident = (sku) => minConf(sku) !== null && minConf(sku) >= thr;

  const skus = Array.from(new Set([...Object.keys(expected), ...Object.keys(detected)]));
  const lineItems = [];
  const missing = [];
  const extra = [];
  const short = [];
  const excess = [];
  const lowConfMatch = [];

  skus.forEach((sku) => {
    const e = expected[sku] || 0;
    const d = detected[sku] ? detected[sku].qty : 0;
    let status = 'MATCH';
    if (e > 0 && d === 0) { status = 'MISSING'; missing.push(sku); }
    else if (e === 0 && d > 0) { status = 'EXTRA'; extra.push(sku); }
    else if (d < e) { status = 'SHORT'; short.push(sku); }
    else if (d > e) { status = 'EXCESS'; excess.push(sku); }
    else if (minConf(sku) !== null && minConf(sku) < thr) lowConfMatch.push(sku);
    lineItems.push({ sku, name: nameOf(catalogue, sku), expectedQty: e, detectedQty: d, status, confidence: minConf(sku) });
  });

  const pairs = pairWrongItems(catalogue, missing, extra);
  const pairedM = new Set(pairs.map((p) => p.expectedSku));
  const pairedX = new Set(pairs.map((p) => p.foundSku));

  let allPresent = 'PASS';
  let qtyOk = 'PASS';
  let noExtra = 'PASS';
  const findings = [];
  const add = (f) => findings.push(f);

  pairs.forEach((p) => {
    const sure = confident(p.foundSku);
    add({
      type: 'WRONG_ITEM', confirmed: sure, expectedSku: p.expectedSku, foundSku: p.foundSku,
      expected: expected[p.expectedSku], found: detected[p.foundSku].qty,
      text: sure
        ? `Wrong item: expected ${nameOf(catalogue, p.expectedSku)} (${p.expectedSku}) but saw ${nameOf(catalogue, p.foundSku)} (${p.foundSku}) instead.`
        : `Possible wrong item: expected ${nameOf(catalogue, p.expectedSku)} but the AI saw ${nameOf(catalogue, p.foundSku)} with low confidence - recheck by hand.`,
    });
    // A swap is counted once, under all_items_present. Only units beyond the swapped quantity are "extra".
    allPresent = raise(allPresent, sure ? 'FAIL' : 'UNCERTAIN');
    const surplus = detected[p.foundSku].qty - expected[p.expectedSku];
    if (surplus > 0) {
      add({ type: 'EXTRA', confirmed: sure, foundSku: p.foundSku, expected: 0, found: surplus, text: `${surplus} more ${nameOf(catalogue, p.foundSku)} (${p.foundSku}) than the swap explains.` });
      noExtra = raise(noExtra, sure ? 'FAIL' : 'UNCERTAIN');
    }
  });

  missing.filter((s) => !pairedM.has(s)).forEach((sku) => {
    const blind = unverifiable.has(sku);
    const sure = !hasImageIssue && !blind;
    add({
      type: 'MISSING', confirmed: sure, expectedSku: sku, expected: expected[sku], found: 0,
      text: blind
        ? `Cannot verify ${nameOf(catalogue, sku)} (${sku}): the AI has no description or reference photo for this product. Add one in the Library, or check it by hand.`
        : sure
        ? `Missing: ${nameOf(catalogue, sku)} (${sku}) - expected ${expected[sku]}, saw none.`
        : `Not seen: ${nameOf(catalogue, sku)} (${sku}) - expected ${expected[sku]}. The photo (${flags.join(', ')}) cannot prove it is absent.`,
    });
    allPresent = raise(allPresent, sure ? 'FAIL' : 'UNCERTAIN');
  });

  extra.filter((s) => !pairedX.has(s)).forEach((sku) => {
    const sure = confident(sku);
    add({
      type: 'EXTRA', confirmed: sure, foundSku: sku, expected: 0, found: detected[sku].qty,
      text: sure
        ? `Unexpected extra item: ${nameOf(catalogue, sku)} (${sku}) x${detected[sku].qty}.`
        : `Possible extra item: ${nameOf(catalogue, sku)} (${sku}) seen with low confidence.`,
    });
    noExtra = raise(noExtra, sure ? 'FAIL' : 'UNCERTAIN');
  });

  short.forEach((sku) => {
    const sure = confident(sku) && !hasImageIssue;
    add({
      type: 'SHORT', confirmed: sure, expectedSku: sku, expected: expected[sku], found: detected[sku].qty,
      text: sure
        ? `Short quantity: ${nameOf(catalogue, sku)} (${sku}) - expected ${expected[sku]}, counted ${detected[sku].qty}.`
        : `Count unconfirmed: ${nameOf(catalogue, sku)} (${sku}) - expected ${expected[sku]}, counted ${detected[sku].qty}, but the count is not reliable enough to call it short.`,
    });
    qtyOk = raise(qtyOk, sure ? 'FAIL' : 'UNCERTAIN');
  });

  excess.forEach((sku) => {
    const sure = confident(sku);
    add({
      type: 'EXCESS', confirmed: sure, expectedSku: sku, expected: expected[sku], found: detected[sku].qty,
      text: sure
        ? `Excess quantity: ${nameOf(catalogue, sku)} (${sku}) - expected ${expected[sku]}, counted ${detected[sku].qty}.`
        : `Count unconfirmed: ${nameOf(catalogue, sku)} (${sku}) - counted ${detected[sku].qty} vs expected ${expected[sku]} with low confidence.`,
    });
    qtyOk = raise(qtyOk, sure ? 'FAIL' : 'UNCERTAIN');
  });

  unmapped.forEach((u) => {
    add({ type: 'UNIDENTIFIED', confirmed: false, found: u.quantity || 1, text: `Unidentified item in box: "${u.name_guess || 'unknown object'}". It is not in the catalogue, so the box cannot be confirmed free of extras.` });
    noExtra = raise(noExtra, 'UNCERTAIN');
  });

  // PASS -> UNCERTAIN when the evidence behind the pass is weak. A FAIL is never softened.
  const affected = new Set();
  flags.forEach((f) => (IMAGE_FLAG_IMPACT[f] || IMAGE_FLAG_IMPACT.other).forEach((c) => affected.add(c)));
  if (lowConfMatch.length) {
    lowConfMatch.forEach((sku) => add({ type: 'LOW_CONFIDENCE', confirmed: false, expectedSku: sku, text: `Low confidence on ${nameOf(catalogue, sku)} (${sku}): ${Math.round(minConf(sku) * 100)}%.` }));
    allPresent = raise(allPresent, 'UNCERTAIN');
    qtyOk = raise(qtyOk, 'UNCERTAIN');
  }
  if (affected.has('all_items_present')) allPresent = raise(allPresent, 'UNCERTAIN');
  if (affected.has('quantities_correct')) qtyOk = raise(qtyOk, 'UNCERTAIN');
  if (affected.has('no_extra_items')) noExtra = raise(noExtra, 'UNCERTAIN');

  // Nothing identified at all: the photo told us nothing, so nothing can be concluded.
  const nothingSeen = (detectedItems || []).filter((i) => i && i.sku && i.quantity > 0).length === 0 && unmapped.length === 0;
  if (nothingSeen) {
    allPresent = qtyOk = noExtra = 'UNCERTAIN';
    findings.length = 0;
    add({ type: 'NOTHING_SEEN', confirmed: false, text: 'No products could be identified in the photo(s). Nothing can be confirmed either way - retake the photo.' });
  }

  if (hasImageIssue) add({ type: 'IMAGE_QUALITY', confirmed: false, text: `Photo quality issue: ${flags.join(', ')}.` });

  const checks = { all_items_present: allPresent, quantities_correct: qtyOk, no_extra_items: noExtra };
  const vals = Object.values(checks);
  const verdict = vals.includes('FAIL') ? 'STOP_AND_FIX' : vals.includes('UNCERTAIN') ? 'UNCERTAIN' : 'SEAL';

  const discrepancy_types = [];
  const has = (t, c = true) => findings.some((f) => f.type === t && f.confirmed === c);
  if (has('WRONG_ITEM')) discrepancy_types.push('WRONG_ITEM');
  if (has('MISSING')) discrepancy_types.push('MISSING_ITEM');
  if (has('SHORT') || has('EXCESS')) discrepancy_types.push('SHORT_QUANTITY');
  if (has('EXTRA')) discrepancy_types.push('EXTRA_ITEM');
  if (hasImageIssue || vals.includes('UNCERTAIN')) discrepancy_types.push('VISUAL_AMBIGUITY');

  const issues = findings.map((f) => f.text);
  if (!issues.length) issues.push('Every expected line item was seen at the correct quantity, with nothing extra.');

  const confs = Object.values(detected).flatMap((d) => d.conf);
  let confidence_score;
  if (!confs.length) confidence_score = hasImageIssue ? 0.2 : 0.35;
  else {
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
    confidence_score = hasImageIssue ? Math.min(avg, 0.55) : avg;
  }
  confidence_score = Math.round(confidence_score * 100) / 100;

  return {
    checks, discrepancy_types, issues, findings, lineItems, confidence_score, verdict,
    observed_in_box: toLineString(Object.fromEntries(Object.entries(detected).map(([s, d]) => [s, d.qty]))),
  };
}

module.exports = { evaluatePacking, parseLineString, toLineString };
