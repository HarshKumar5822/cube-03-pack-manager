const BASE = '/api';

async function req(path, opts = {}) {
  let res;
  try { res = await fetch(BASE + path, opts); } catch { throw new Error('Cannot reach the Pack Manager server. Is it running?'); }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const q = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const api = {
  health: () => req('/health'),
  models: () => req('/system/models'),
  catalogue: () => req('/catalogue'),
  saveProduct: (b) => req('/catalogue', json('POST', b)),
  deleteProduct: (sku) => req(`/catalogue/${encodeURIComponent(sku)}`, { method: 'DELETE' }),
  addProductPhotos: (sku, files) => { const fd = new FormData(); files.forEach((f, i) => fd.append('photo', f, f.name || `photo-${i}.jpg`)); return req(`/catalogue/${encodeURIComponent(sku)}/photos`, { method: 'POST', body: fd }); },
  deleteProductPhoto: (sku, name) => req(`/catalogue/${encodeURIComponent(sku)}/photos/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  orders: (org) => req(`/orders?${q({ org_id: org })}`),
  createOrder: (b) => req('/orders', json('POST', b)),
  deleteOrder: (org, id) => req(`/orders/${encodeURIComponent(id)}?${q({ org_id: org })}`, { method: 'DELETE' }),
  analyze: (fd) => req('/analyze', { method: 'POST', body: fd }),
  records: (org, scope) => req(`/records?${q({ org_id: org, scope })}`),
  record: (org, id) => req(`/records/${encodeURIComponent(id)}?${q({ org_id: org })}`),
  override: (id, b) => req(`/records/${encodeURIComponent(id)}/override`, json('POST', b)),
  copilot: (b) => req('/copilot', json('POST', b)),
  stats: async (org, mode) => (await req(`/stats?${q({ org_id: org, mode })}`)).stats,
  seedDemo: () => req('/demo/seed', { method: 'POST' }),
  clearDemo: () => req('/demo', { method: 'DELETE' }),
  scenarios: () => req('/eval/scenarios'),
  simulate: (b) => req('/simulate', json('POST', b)),
  runEval: (vision) => req(`/eval/run${vision ? '?vision=true' : ''}`, { method: 'POST' }),
  leakTest: (b) => req('/tenancy/leak-test', json('POST', b)),
  labels: () => req('/labels'),
  saveLabel: (id, b) => req(`/labels/${encodeURIComponent(id)}`, json('PUT', b)),
};
export const photoUrl = (ref, org) => `/api/evidence/${encodeURIComponent(String(ref).split('/').pop())}?org_id=${encodeURIComponent(org)}`;
