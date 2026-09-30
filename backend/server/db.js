'use strict';

const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config');

const VALID_ORGS = ['org_demo_alpha', 'org_demo_bravo'];
const storePath = () => path.join(getConfig().dataDir, 'store.json');
const emptyState = () => ({ records: [], overrideLog: [], orders: [] });

function load() {
  try {
    const sp = storePath();
    if (!fs.existsSync(sp)) {
      const seed = path.join(__dirname, '..', 'data', 'store.json');
      if (fs.existsSync(seed)) {
        return { ...emptyState(), ...JSON.parse(fs.readFileSync(seed, 'utf8')) };
      }
    }
    const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
    return { ...emptyState(), ...s };
  } catch {
    return emptyState();
  }
}

function save(state) {
  try {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    const tmp = `${storePath()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, storePath()); // atomic: a crash mid-write cannot corrupt the store
  } catch (err) {
    console.warn('[DB Save Warning]: Could not save store:', err.message);
  }
}


/**
 * Every read/write takes org_id and filters by it here, in one place - the app-layer stand-in
 * for Postgres row-level security. NOTE: org_id is still supplied by the client; real
 * authentication must bind it to a session before this is production-grade.
 */
function assertValidOrg(orgId) {
  const target = orgId || 'org_demo_alpha';
  if (!VALID_ORGS.includes(target)) {
    const err = new Error(`Unknown org_id "${orgId}"`);
    err.status = 400;
    throw err;
  }
  return target;
}


const isSynthetic = (r) => Boolean(r._meta && r._meta.synthetic);

function insertRecord(record) {
  assertValidOrg(record.org_id);
  const s = load();
  s.records.push(record);
  save(s);
  return record;
}

function insertMany(records) {
  const s = load();
  records.forEach((r) => { assertValidOrg(r.org_id); s.records.push(r); });
  save(s);
  return records.length;
}

function listRecordsForOrg(orgId, { limit = 1000, synthetic = 'exclude' } = {}) {
  const org = assertValidOrg(orgId);
  return load().records
    .filter((r) => r.org_id === org)
    .filter((r) => synthetic === 'all' || (synthetic === 'only' ? isSynthetic(r) : !isSynthetic(r)))
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
    .slice(0, limit);
}

function countsForOrg(orgId) {
  const org = assertValidOrg(orgId);
  const mine = load().records.filter((r) => r.org_id === org);
  const demo = mine.filter(isSynthetic).length;
  return { live: mine.length - demo, demo };
}

// Returns null for both "missing" and "someone else's" so callers cannot tell the difference.
function getRecordScoped(recordId, orgId) {
  const org = assertValidOrg(orgId);
  const r = load().records.find((x) => x.record_id === recordId);
  return r && r.org_id === org ? r : null;
}

// Used only by the tenancy demo to show the gate working.
function unsafeGetRecordAnyOrg(recordId) {
  return load().records.find((r) => r.record_id === recordId) || null;
}

function recordReferencingPhoto(file, orgId) {
  const org = assertValidOrg(orgId);
  return load().records.find((r) => r.org_id === org && (r.photo_refs || []).some((p) => path.basename(p) === file)) || null;
}

function applyOverride(recordId, orgId, override) {
  const org = assertValidOrg(orgId);
  if (!getRecordScoped(recordId, org)) return null;
  const s = load();
  const target = s.records.find((r) => r.record_id === recordId);
  const entry = {
    original_verdict: target.agent_verdict,
    new_verdict: override.new_verdict,
    operator_id: override.operator_id,
    override_reason: override.override_reason,
    override_at: new Date().toISOString(),
  };
  // The AI verdict is never overwritten - an override is additional data with a reason.
  target.operator_override = entry;
  s.overrideLog.push({ record_id: recordId, org_id: org, ...entry });
  save(s);
  return target;
}

function listOverridesForOrg(orgId) {
  const org = assertValidOrg(orgId);
  return load().overrideLog.filter((o) => o.org_id === org);
}

function deleteSynthetic() {
  const s = load();
  const before = s.records.length;
  s.records = s.records.filter((r) => !isSynthetic(r));
  s.overrideLog = s.overrideLog.filter((o) => s.records.some((r) => r.record_id === o.record_id));
  save(s);
  return before - s.records.length;
}

/* ------------------------------ orders ------------------------------ */

function listOrders(orgId) {
  const org = assertValidOrg(orgId);
  return load().orders.filter((o) => o.org_id === org).sort((a, b) => b.created_at.localeCompare(a.created_at));
}


function nextUnitId(s) {
  const used = new Set([...s.orders.map((o) => o.unit_id), ...s.records.map((r) => r.unit_id)]);
  for (let n = 1001; n < 9000; n++) {
    const id = `UNIT-${n}`;
    if (!used.has(id)) return id;
  }
  throw new Error('No free unit ids');
}

function createOrder(orgId, { order_id, channel, order_lines }) {
  assertValidOrg(orgId);
  const s = load();
  const n = s.orders.length + 1;
  const order = {
    order_id: order_id || `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(n).padStart(3, '0')}`,
    unit_id: nextUnitId(s),
    org_id: orgId,
    channel,
    order_lines,
    status: 'open',
    record_id: null,
    created_at: new Date().toISOString(),
  };
  s.orders.push(order);
  save(s);
  return order;
}

function updateOrderByUnit(orgId, unitId, patch) {
  assertValidOrg(orgId);
  const s = load();
  const o = s.orders.find((x) => x.org_id === orgId && x.unit_id === unitId);
  if (!o) return null;
  Object.assign(o, patch);
  save(s);
  return o;
}

function deleteOrder(orgId, orderId) {
  assertValidOrg(orgId);
  const s = load();
  const n = s.orders.length;
  s.orders = s.orders.filter((o) => !(o.org_id === orgId && o.order_id === orderId));
  save(s);
  return n !== s.orders.length;
}

function reset() {
  save(emptyState());
}

module.exports = {
  VALID_ORGS, assertValidOrg, insertRecord, insertMany, listRecordsForOrg, countsForOrg, getRecordScoped,
  unsafeGetRecordAnyOrg, recordReferencingPhoto, applyOverride, listOverridesForOrg, deleteSynthetic,
  listOrders, createOrder, updateOrderByUnit, deleteOrder, reset, isSynthetic,
};
