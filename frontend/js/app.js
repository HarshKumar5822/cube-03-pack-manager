/* Hash router + shared state. Each view module exports render(root, ctx) and may return a cleanup function. */
import { h, clear, icon } from './ui.js';
import { api } from './api.js';
import { destroyCharts } from './charts.js';

const VIEWS = [
  { id: 'bench', label: 'Bench', icon: 'scan', load: () => import('./bench.js') },
  { id: 'insights', label: 'Insights', icon: 'chart', load: () => import('./insights.js') },
  { id: 'orders', label: 'Orders', icon: 'box', load: () => import('./orders.js') },
  { id: 'audit', label: 'Audit', icon: 'list', load: () => import('./audit.js') },
  { id: 'library', label: 'Library', icon: 'tag', load: () => import('./library.js') },
  { id: 'labels', label: 'Label desk', icon: 'image', load: () => import('./labels.js') },
  { id: 'benchmark', label: 'Benchmark', icon: 'flask', load: () => import('./benchmark.js') },
  { id: 'system', label: 'System', icon: 'server', load: () => import('./system.js') },
];

const OPERATORS = [['op_amira', 'Amira'], ['op_ben', 'Ben'], ['op_dana', 'Dana']];
const ORGS = [['org_demo_alpha', 'Demo Alpha'], ['org_demo_bravo', 'Demo Bravo']];
const store = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const state = {
  orgId: store('pm.org', ORGS[0][0]),
  operator: store('pm.op', OPERATORS[0][0]),
  health: null,
  _cat: null,
};
export const operators = OPERATORS;
export async function getCatalogue(force) {
  if (!state._cat || force) state._cat = (await api.catalogue()).catalogue;
  return state._cat;
}
export async function refreshHealth() {
  try { state.health = await api.health(); } catch { state.health = null; }
  paintAi();
  return state.health;
}

function paintAi() {
  const el = document.getElementById('ai-dot');
  const h0 = state.health;
  el.className = `ai-dot ${h0 && h0.configured ? 'on' : 'off'}`;
  const label = !h0 ? 'Server offline' : h0.configured ? `AI: ${h0.provider}` : 'AI not configured';
  el.lastChild.textContent = label;
  el.title = !h0 ? 'Cannot reach the server' : h0.configured ? `Models: ${h0.models.join(' → ')}` : 'Add GROQ_API_KEY or ANTHROPIC_API_KEY to backend/.env. Until then boxes are held for manual check; nothing is faked.';
}

let cleanup = null;
let token = 0;
async function route() {
  const id = (location.hash.replace('#/', '') || 'bench').split('?')[0];
  const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
  const mine = ++token;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  destroyCharts();
  document.querySelectorAll('.rail-item').forEach((a) => (a.getAttribute('href') === `#/${view.id}` ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const root = document.getElementById('main');
  clear(root).append(h('div', { class: 'skeleton', style: { height: '220px' } }));
  try {
    const mod = await view.load();
    if (mine !== token) return;
    clear(root);
    root.classList.remove('fade');
    cleanup = (await mod.render(root, { state, api, getCatalogue, refreshHealth, go })) || null;
    document.title = `${view.label} - Pack Manager`;
  } catch (e) {
    if (mine !== token) return;
    clear(root).append(h('div', { class: 'banner bad' }, icon('alert'), h('div', null, h('b', null, 'This page could not load. '), e.message)));
    console.error(e);
  }
}
export const go = (id) => { location.hash = `#/${id}`; };

function init() {
  document.getElementById('brand-mark').append(icon('box', 24));
  const nav = document.getElementById('nav');
  VIEWS.forEach((v) => nav.append(h('a', { class: 'rail-item', href: `#/${v.id}` }, icon(v.icon, 20), h('span', { class: 'nav-text' }, v.label))));
  const org = document.getElementById('org');
  ORGS.forEach(([v, l]) => org.append(h('option', { value: v, selected: v === state.orgId }, l)));
  org.addEventListener('change', () => { state.orgId = org.value; keep('pm.org', org.value); route(); });
  const op = document.getElementById('operator');
  OPERATORS.forEach(([v, l]) => op.append(h('option', { value: v, selected: v === state.operator }, l)));
  op.addEventListener('change', () => { state.operator = op.value; keep('pm.op', op.value); });
  window.addEventListener('hashchange', route);
  refreshHealth().then(route);
}
init();
