/* System: what is configured, which models the provider really serves, how the pipeline works, tenancy check. */
import { h, clear, icon, toast, authorBadge } from './ui.js';

export async function render(root, { state, api, refreshHealth }) {
  const health = await refreshHealth();
  const modelsBox = h('div', { class: 'stack' });
  const leakBox = h('div');

  async function checkModels() {
    clear(modelsBox).append(h('div', { class: 'row' }, h('span', { class: 'spin' }), 'Asking the provider which models it serves\u2026'));
    try {
      const m = await api.models();
      clear(modelsBox);
      if (!m.provider) { modelsBox.append(h('p', { class: 'muted' }, 'No provider configured, so there is nothing to check.')); return; }
      if (m.error) { modelsBox.append(h('div', { class: 'banner bad', style: { marginBottom: 0 } }, icon('alert'), h('div', null, h('b', null, 'Could not list models: '), m.error))); return; }
      modelsBox.append(h('dl', { class: 'kv' }, m.configured.map((c) => [h('dt', { class: 'mono' }, c.id), h('dd', null, c.available === false ? h('span', { class: 'chip stop' }, 'Not served by provider. Retired or misspelled; change it in .env') : c.available ? h('span', { class: 'chip seal' }, 'Available') : h('span', { class: 'chip plain' }, 'Unknown'))])),
        h('p', { class: 'faint', style: { fontSize: '.8rem' } }, `${m.models.length} models listed by ${m.provider}.`));
    } catch (e) { clear(modelsBox).append(h('div', { class: 'banner bad', style: { marginBottom: 0 } }, e.message)); }
  }

  async function leak() {
    const { records } = await api.records(state.orgId, 'all');
    const other = state.orgId === 'org_demo_alpha' ? 'org_demo_bravo' : 'org_demo_alpha';
    const theirs = (await api.records(other, 'all')).records[0];
    if (!theirs) { clear(leakBox).append(h('p', { class: 'muted' }, `The other workspace has no records to test against. Load demo data in Insights first. (${records.length} here.)`)); return; }
    const r = await api.leakTest({ record_id: theirs.record_id, requesting_org_id: state.orgId });
    clear(leakBox).append(h('div', { class: `banner ${r.isolation_held ? '' : 'bad'}`, style: { marginBottom: 0 } }, icon(r.isolation_held ? 'shield' : 'alert'), h('div', null, h('b', null, r.isolation_held ? 'Isolation held. ' : 'LEAK. '), `Asked for ${r.record_id} (owned by ${r.actual_owner_org}) as ${r.requesting_org_id}: ${r.scoped_result_returned ? 'record was returned' : 'nothing returned'}.`)));
  }

  const step = (cls, t, d) => h('li', { class: cls }, h('b', null, t), d);
  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'System'), h('p', null, 'What is configured, and how a verdict is produced.')), h('div', { class: 'page-tools' }, authorBadge())),
    h('div', { class: 'stack' },
      h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'How a verdict is made')), h('div', { class: 'panel-body stack' },
        h('ol', { class: 'steps', style: { padding: 0, margin: 0 } },
          step('', '1. Photos', 'Up to 3, checked as real images'),
          step('ai', '2. AI sees', 'Blind: it is never shown the order'),
          step('', '3. Validate', 'Unknown SKU \u2192 unmapped; no evidence \u2192 low confidence'),
          step('rules', '4. Code decides', 'Matcher compares with the order'),
          step('', '5. Record', 'Photo, evidence and verdict saved')),
        h('p', { class: 'muted' }, 'Only things actually seen can trigger STOP & FIX. Not seeing something in a blurry or partial photo gives UNCERTAIN, never a guess. If the AI is unreachable the box is held for a person; the app never invents a detection.'))),
      h('div', { class: 'lab' },
        h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'AI provider')), h('div', { class: 'panel-body stack' },
          health ? h('dl', { class: 'kv' }, h('dt', null, 'Status'), h('dd', null, health.configured ? h('span', { class: 'chip seal' }, `Active: ${health.provider}`) : h('span', { class: 'chip stop' }, 'Not configured')),
            h('dt', null, 'Model chain'), h('dd', { class: 'mono' }, health.models.join(' \u2192 ') || '\u2014'),
            h('dt', null, 'Confidence floor'), h('dd', null, health.confidenceThreshold), h('dt', null, 'Max photos'), h('dd', null, health.maxPhotos),
            h('dt', null, 'Reference photos'), h('dd', null, health.referenceImageLimit || 'none (Claude only)'),
            h('dt', null, 'Cost per wrong shipment'), h('dd', null, `$${health.costPerDefect} (assumption)`),
            health.forceFailure ? [h('dt', null, 'Failure drill'), h('dd', null, h('span', { class: 'chip unsure' }, 'FORCE_VISION_FAILURE is on'))] : null)
            : h('div', { class: 'banner bad', style: { marginBottom: 0 } }, 'Cannot reach the server.'),
          !health || !health.configured ? h('p', { class: 'muted' }, 'Copy ', h('span', { class: 'mono' }, 'backend/.env.example'), ' to ', h('span', { class: 'mono' }, 'backend/.env'), ', add a key, restart.') : null,
          h('button', { class: 'btn', onclick: checkModels }, icon('refresh'), 'Check models with provider'), modelsBox)),
        h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Workspace isolation')), h('div', { class: 'panel-body stack' },
          h('p', { class: 'muted' }, 'Tries to read the other workspace\u2019s record from this one.'), h('button', { class: 'btn', onclick: () => leak().catch((e) => toast(e.message, 'bad')) }, icon('shield'), 'Run isolation check'), leakBox,
          h('p', { class: 'faint', style: { fontSize: '.8rem' } }, 'Demo-grade: there is no sign-in, so the workspace comes from the browser. Add real authentication before putting real customer data here.')))),
      h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Demo data')), h('div', { class: 'panel-body row' },
        h('button', { class: 'btn', onclick: async () => { const r = await api.seedDemo(); toast(`Loaded ${r.inserted} demo records.`, 'ok'); } }, icon('plus'), 'Load demo data'),
        h('button', { class: 'btn btn-danger', onclick: async () => { const r = await api.clearDemo(); toast(`Removed ${r.removed} demo records.`, 'ok'); } }, icon('trash'), 'Remove demo data'),
        h('span', { class: 'faint' }, 'Demo records are always labelled and never mixed into Live numbers.')))));
}
