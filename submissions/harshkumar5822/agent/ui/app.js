// Pack Manager Bench UI Interactive Controller

let allUnits = [];
let activeUnit = null;
let currentTenant = 'org_demo_alpha';

// Synthetic Dataset Fixtures loaded directly in UI
const sampleFixtures = [
  { record_id: "PCK-0006", unit_id: "UNIT-0006", org_id: "org_demo_bravo", order_id: "ORD-50006", channel: "shopify", order_lines: "SKU-CABLE-USBC:1", observed_in_box: "SKU-CABLE-USBC:1", operator_verdict: "seal" },
  { record_id: "PCK-0008", unit_id: "UNIT-0008", org_id: "org_demo_alpha", order_id: "ORD-50008", channel: "shopify", order_lines: "SKU-BOTTLE-750:1", observed_in_box: "SKU-BOTTLE-750:1", operator_verdict: "seal" },
  { record_id: "PCK-0009", unit_id: "UNIT-0009", org_id: "org_demo_bravo", order_id: "ORD-50009", channel: "amazon_mfn", order_lines: "SKU-PUZZLE-500:1;SKU-BOTTLE-750:1", observed_in_box: "SKU-PUZZLE-500:1;SKU-BOTTLE-750:1", operator_verdict: "seal" },
  { record_id: "PCK-0016", unit_id: "UNIT-0016", org_id: "org_demo_alpha", order_id: "ORD-50016", channel: "shopify", order_lines: "SKU-TOWEL-BLU:2", observed_in_box: "SKU-TOWEL-BLU:2", operator_verdict: "seal" },
  { record_id: "PCK-0027", unit_id: "UNIT-0027", org_id: "org_demo_bravo", order_id: "ORD-50027", channel: "amazon_mfn", order_lines: "SKU-PUZZLE-500:1", observed_in_box: "SKU-PUZZLE-500:1;SKU-CABLE-USBC:1", operator_verdict: "stop_and_fix" },
  { record_id: "PCK-0034", unit_id: "UNIT-0034", org_id: "org_demo_alpha", order_id: "ORD-50034", channel: "amazon_mfn", order_lines: "SKU-CANDLE-3:2;SKU-BOTTLE-750:1", observed_in_box: "SKU-CANDLE-3:2;SKU-BOTTLE-750:1;SKU-CABLE-USBC:1", operator_verdict: "seal" },
  { record_id: "PCK-0044", unit_id: "UNIT-0044", org_id: "org_demo_alpha", order_id: "ORD-50044", channel: "shopify", order_lines: "SKU-CANDLE-3:1", observed_in_box: "SKU-BOTTLE-750:1", operator_verdict: "seal" },
  { record_id: "PCK-0056", unit_id: "UNIT-0056", org_id: "org_demo_alpha", order_id: "ORD-50056", channel: "amazon_mfn", order_lines: "SKU-SERUM-30:1;SKU-PROT-1KG:1", observed_in_box: "SKU-SERUM-30:1;SKU-PROT-1KG:1", operator_verdict: "seal" },
  { record_id: "PCK-0078", unit_id: "UNIT-0078", org_id: "org_demo_bravo", order_id: "ORD-50078", channel: "3pl_client", order_lines: "SKU-CANDLE-3:2", observed_in_box: "SKU-CANDLE-3:2;SKU-CABLE-USBC:1", operator_verdict: "stop_and_fix" }
];

document.addEventListener('DOMContentLoaded', () => {
  initUI();
});

function initUI() {
  allUnits = [...sampleFixtures];
  renderUnitList();

  document.getElementById('tenantSelect').addEventListener('change', (e) => {
    currentTenant = e.target.value;
    renderUnitList();
  });

  document.getElementById('unitSearch').addEventListener('input', (e) => {
    renderUnitList(e.target.value.toLowerCase());
  });

  document.getElementById('btnCapture').addEventListener('click', runAudit);
  document.getElementById('btnSimulateFailOpen').addEventListener('click', () => runAudit({ forceFailOpen: true }));
  document.getElementById('btnSimulateAmbiguity').addEventListener('click', () => runAudit({ forceAmbiguity: true }));
  document.getElementById('btnSubmitOverride').addEventListener('click', submitOverride);
  document.getElementById('btnCopyJson').addEventListener('click', copyJsonToClipboard);
}

function renderUnitList(filterText = '') {
  const container = document.getElementById('unitList');
  container.innerHTML = '';

  // Rule 1: Filter units strictly by Tenant Isolation RLS
  const filtered = allUnits.filter(u => u.org_id === currentTenant && 
    (u.unit_id.toLowerCase().includes(filterText) || u.order_lines.toLowerCase().includes(filterText))
  );

  document.getElementById('unitCount').textContent = `${filtered.length} Units (${currentTenant})`;

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:1rem; color:#9ca3af; font-size:0.8rem; text-align:center;">No units found for ${currentTenant}</div>`;
    return;
  }

  filtered.forEach(unit => {
    const item = document.createElement('div');
    item.className = `unit-item ${activeUnit && activeUnit.unit_id === unit.unit_id ? 'active' : ''}`;
    item.innerHTML = `
      <div class="unit-item-header">
        <span class="unit-item-id">${unit.unit_id}</span>
        <span class="unit-item-badge badge-seal">${unit.channel}</span>
      </div>
      <div class="unit-item-sub">Manifest: ${unit.order_lines}</div>
    `;
    item.addEventListener('click', () => selectUnit(unit));
    container.appendChild(item);
  });
}

function selectUnit(unit) {
  activeUnit = unit;
  renderUnitList(document.getElementById('unitSearch').value.toLowerCase());

  document.getElementById('activeUnitId').textContent = unit.unit_id;
  document.getElementById('activeChannel').textContent = unit.channel;
  document.getElementById('activeOrderId').textContent = unit.order_id;

  // Reset stage
  const banner = document.getElementById('verdictBanner');
  banner.className = 'verdict-banner banner-ready';
  banner.innerHTML = `<span class="verdict-icon">⌛</span><span class="verdict-title">READY FOR CAPTURE</span>`;

  renderManifestLists(unit.order_lines, '');
  resetChecks();
}

function parseSkuMap(str) {
  const map = {};
  if (!str) return map;
  str.split(';').forEach(token => {
    const [sku, qty] = token.split(':');
    if (sku) map[sku.trim()] = parseInt(qty || 1, 10);
  });
  return map;
}

function renderManifestLists(expectedStr, observedStr) {
  const expectedMap = parseSkuMap(expectedStr);
  const observedMap = parseSkuMap(observedStr);

  const expContainer = document.getElementById('expectedSkuList');
  expContainer.innerHTML = '';
  Object.entries(expectedMap).forEach(([sku, qty]) => {
    expContainer.innerHTML += `<div class="sku-tag match"><span>${sku}</span><strong>x${qty}</strong></div>`;
  });

  const obsContainer = document.getElementById('observedSkuList');
  obsContainer.innerHTML = '';
  if (!observedStr) {
    obsContainer.innerHTML = `<div style="color:#9ca3af; font-size:0.8rem; font-style:italic;">Awaiting camera capture...</div>`;
    return;
  }

  Object.entries(observedMap).forEach(([sku, qty]) => {
    const isExpected = sku in expectedMap;
    const tagClass = isExpected ? 'match' : 'extra';
    obsContainer.innerHTML += `<div class="sku-tag ${tagClass}"><span>${sku}</span><strong>x${qty}</strong></div>`;
  });
}

function resetChecks() {
  document.getElementById('chkPresent').textContent = '--';
  document.getElementById('chkQty').textContent = '--';
  document.getElementById('chkNoExtra').textContent = '--';
  document.getElementById('discrepancyTags').innerHTML = `<span class="tag tag-none">No Discrepancies</span>`;
  document.getElementById('jsonViewer').textContent = 'Select unit and click CAPTURE to generate evidence JSON...';
}

function runAudit(options = {}) {
  if (!activeUnit) {
    alert("Please select a unit from the left sidebar first!");
    return;
  }

  const container = document.getElementById('photoContainer');
  container.classList.add('scanning');

  setTimeout(() => {
    container.classList.remove('scanning');

    let observedStr = activeUnit.observed_in_box;
    let visualConfidence = 0.96;
    let isFailOpen = options.forceFailOpen || false;
    let isAmbiguous = options.forceAmbiguity || false;

    if (isFailOpen) {
      observedStr = '';
      visualConfidence = 0.0;
    } else if (isAmbiguous) {
      visualConfidence = 0.65;
    }

    renderManifestLists(activeUnit.order_lines, observedStr);

    const expectedMap = parseSkuMap(activeUnit.order_lines);
    const observedMap = parseSkuMap(observedStr);

    let missing = [];
    let extra = [];
    let discrepancies = [];

    Object.entries(expectedMap).forEach(([sku, qty]) => {
      const obsQty = observedMap[sku] || 0;
      if (obsQty === 0) {
        missing.push(sku);
        discrepancies.push('MISSING_ITEM');
      } else if (obsQty < qty) {
        discrepancies.push('SHORT_QUANTITY');
      }
    });

    Object.entries(observedMap).forEach(([sku, qty]) => {
      if (!(sku in expectedMap)) {
        extra.push(sku);
        discrepancies.push('EXTRA_ITEM');
      }
    });

    if (missing.length > 0 && extra.length > 0) {
      discrepancies.push('WRONG_ITEM');
    }

    let verdict = 'SEAL';
    if (isFailOpen) {
      verdict = 'PENDING_REVIEW';
      discrepancies = ['NETWORK_TIMEOUT'];
    } else if (isAmbiguous || visualConfidence < 0.80) {
      verdict = 'UNCERTAIN';
      discrepancies.push('VISUAL_AMBIGUITY');
    } else if (discrepancies.length > 0) {
      verdict = 'STOP_AND_FIX';
    }

    // Render Verdict Banner
    const banner = document.getElementById('verdictBanner');
    if (verdict === 'SEAL') {
      banner.className = 'verdict-banner banner-seal';
      banner.innerHTML = `<span class="verdict-icon">🟩</span><span class="verdict-title">SEAL CARTON</span>`;
    } else if (verdict === 'STOP_AND_FIX') {
      banner.className = 'verdict-banner banner-stop';
      banner.innerHTML = `<span class="verdict-icon">🟥</span><span class="verdict-title">STOP & FIX</span>`;
    } else {
      banner.className = 'verdict-banner banner-uncertain';
      banner.innerHTML = `<span class="verdict-icon">🟨</span><span class="verdict-title">${verdict}</span>`;
    }

    // Update Checks
    document.getElementById('chkPresent').className = `check-status ${missing.length > 0 ? 'check-fail' : 'check-pass'}`;
    document.getElementById('chkPresent').textContent = missing.length > 0 ? 'FAIL' : 'PASS';

    document.getElementById('chkQty').className = `check-status ${discrepancies.includes('SHORT_QUANTITY') ? 'check-fail' : 'check-pass'}`;
    document.getElementById('chkQty').textContent = discrepancies.includes('SHORT_QUANTITY') ? 'FAIL' : 'PASS';

    document.getElementById('chkNoExtra').className = `check-status ${extra.length > 0 ? 'check-fail' : 'check-pass'}`;
    document.getElementById('chkNoExtra').textContent = extra.length > 0 ? 'FAIL' : 'PASS';

    // Render Discrepancy Tags
    const discContainer = document.getElementById('discrepancyTags');
    discContainer.innerHTML = '';
    if (discrepancies.length === 0) {
      discContainer.innerHTML = `<span class="tag tag-none">ALL CHECKS PASSED</span>`;
    } else {
      [...new Set(discrepancies)].forEach(d => {
        const tagClass = d === 'EXTRA_ITEM' ? 'tag-extra' : 'tag-missing';
        discContainer.innerHTML += `<span class="tag ${tagClass}">${d}</span>`;
      });
    }

    document.getElementById('latencyBadge').textContent = `Inference: ${Math.floor(Math.random() * 400 + 1200)} ms`;

    // Construct Evidence JSON Record
    const evidenceJson = {
      record_id: activeUnit.record_id,
      unit_id: activeUnit.unit_id,
      org_id: activeUnit.org_id,
      order_id: activeUnit.order_id,
      channel: activeUnit.channel,
      captured_at: new Date().toISOString(),
      photo_refs: [`storage/${activeUnit.org_id}/${activeUnit.unit_id}_open_box.jpg`],
      order_lines: activeUnit.order_lines,
      observed_in_box: observedStr,
      agent_verdict: verdict,
      confidence_score: visualConfidence,
      checks: {
        all_items_present: missing.length === 0 ? "PASS" : "FAIL",
        quantities_correct: "PASS",
        no_extra_items: extra.length === 0 ? "PASS" : "FAIL"
      },
      discrepancy_types: [...new Set(discrepancies)],
      operator_id: "OP-882",
      operator_override: null
    };

    activeUnit.latestRecord = evidenceJson;
    document.getElementById('jsonViewer').textContent = JSON.stringify(evidenceJson, null, 2);

  }, 1000);
}

function submitOverride() {
  if (!activeUnit || !activeUnit.latestRecord) {
    alert("Please select a unit and run audit capture first!");
    return;
  }

  const newVerdict = document.getElementById('overrideVerdict').value;
  const reason = document.getElementById('overrideReason').value;

  if (!reason.trim()) {
    alert("Please enter a reason for the manual override!");
    return;
  }

  activeUnit.latestRecord.operator_override = {
    original_verdict: activeUnit.latestRecord.agent_verdict,
    new_verdict: newVerdict,
    operator_id: "OP-882",
    override_reason: reason,
    override_at: new Date().toISOString()
  };

  document.getElementById('jsonViewer').textContent = JSON.stringify(activeUnit.latestRecord, null, 2);
  document.getElementById('overrideStatus').textContent = `✅ Override logged: ${activeUnit.latestRecord.agent_verdict} ➔ ${newVerdict}`;
}

function copyJsonToClipboard() {
  const text = document.getElementById('jsonViewer').textContent;
  navigator.clipboard.writeText(text);
  alert("Evidence JSON copied to clipboard!");
}
