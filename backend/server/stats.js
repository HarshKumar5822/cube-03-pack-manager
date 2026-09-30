'use strict';

/** Pure aggregation over records. Nothing here invents data: empty in -> empty out. */

function computeStats(records, { costPerDefect = 35 } = {}) {
  const byVerdict = { SEAL: 0, STOP_AND_FIX: 0, UNCERTAIN: 0, PENDING_REVIEW: 0 };
  const defects = { WRONG_ITEM: 0, MISSING_ITEM: 0, SHORT_QUANTITY: 0, EXTRA_ITEM: 0, VISUAL_AMBIGUITY: 0, NETWORK_TIMEOUT: 0 };
  const skuDefects = {};
  const daily = {};
  const channels = {};
  const hist = [0, 0, 0, 0, 0];
  const latencies = [];
  let overrides = 0;

  records.forEach((r) => {
    if (byVerdict[r.agent_verdict] !== undefined) byVerdict[r.agent_verdict]++;
    (r.discrepancy_types || []).forEach((d) => { defects[d] = (defects[d] || 0) + 1; });
    ((r._meta && r._meta.line_items) || []).forEach((l) => {
      if (l.status && l.status !== 'MATCH') {
        const k = (skuDefects[l.sku] = skuDefects[l.sku] || { sku: l.sku, name: l.name || l.sku, count: 0 });
        k.count++;
      }
    });
    const day = (r.captured_at || '').slice(0, 10) || 'unknown';
    const d = (daily[day] = daily[day] || { date: day, seal: 0, stop: 0, uncertain: 0, total: 0 });
    d.total++;
    if (r.agent_verdict === 'SEAL') d.seal++;
    else if (r.agent_verdict === 'STOP_AND_FIX') d.stop++;
    else d.uncertain++;

    const c = (channels[r.channel] = channels[r.channel] || { channel: r.channel, seal: 0, stop: 0, uncertain: 0 });
    if (r.agent_verdict === 'SEAL') c.seal++;
    else if (r.agent_verdict === 'STOP_AND_FIX') c.stop++;
    else c.uncertain++;

    if (typeof r.confidence_score === 'number' && r.agent_verdict !== 'PENDING_REVIEW') {
      hist[Math.min(4, Math.floor(r.confidence_score * 5))]++;
    }
    if (r._meta && typeof r._meta.latency_ms === 'number' && !r._meta.synthetic) latencies.push(r._meta.latency_ms);
    if (r.operator_override) overrides++;
  });

  const total = records.length;
  const dailyList = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  let runSeal = 0;
  let runTotal = 0;
  dailyList.forEach((d) => {
    runSeal += d.seal;
    runTotal += d.total;
    d.fpy = Math.round((d.seal / d.total) * 100);
    d.cumulativeFpy = Math.round((runSeal / runTotal) * 100);
  });

  latencies.sort((a, b) => a - b);
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : null;
  const confSum = records.filter((r) => typeof r.confidence_score === 'number' && r.agent_verdict !== 'PENDING_REVIEW');

  return {
    total,
    byVerdict,
    sealRate: total ? Math.round((byVerdict.SEAL / total) * 100) : 0,
    avgConfidence: confSum.length ? Math.round((confSum.reduce((a, r) => a + r.confidence_score, 0) / confSum.length) * 100) / 100 : null,
    overrideCount: overrides,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    latencySamples: latencies.length,
    defects,
    topSkus: Object.values(skuDefects).sort((a, b) => b.count - a.count).slice(0, 6),
    daily: dailyList,
    channels: Object.values(channels).sort((a, b) => a.channel.localeCompare(b.channel)),
    confidenceHistogram: [
      { bin: '0-20%', count: hist[0] }, { bin: '20-40%', count: hist[1] }, { bin: '40-60%', count: hist[2] },
      { bin: '60-80%', count: hist[3] }, { bin: '80-100%', count: hist[4] },
    ],
    // An estimate from an ASSUMED cost per wrong shipment (COST_PER_WRONG_SHIPMENT), not a measurement.
    estimatedSavings: byVerdict.STOP_AND_FIX * costPerDefect,
    assumptions: { costPerDefect },
  };
}

module.exports = { computeStats };
