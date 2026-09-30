'use strict';

/**
 * Headless Agent Runner - Pack Manager
 * Loads eval set fixtures and runs deterministic matcher rules.
 */

const fs = require('fs');
const path = require('path');
const { evaluatePacking } = require('../../../backend/server/matcher');

const fixturePath = process.argv[2] || path.join(__dirname, '../../../backend/data/eval_set.json');

console.log(`[PackManager Agent] Reading evaluation fixtures from: ${fixturePath}\n`);

try {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const scenarios = JSON.parse(raw);

  let passCount = 0;
  let failCount = 0;
  let unsafeSeals = 0;

  scenarios.forEach((unit, idx) => {
    const res = evaluatePacking(
      unit.order_lines,
      unit.detected_items,
      unit.image_quality_flags || []
    );

    const matchesExpected = res.verdict === unit.expected_verdict;
    const isUnsafe = unit.expected_verdict !== 'SEAL' && res.verdict === 'SEAL';

    if (matchesExpected) passCount++;
    else failCount++;
    if (isUnsafe) unsafeSeals++;

    const icon = matchesExpected ? '✅' : '❌';
    console.log(`${icon} [${unit.unit_id}] Scenario: ${unit.scenario.padEnd(20)} | Expected: ${unit.expected_verdict.padEnd(12)} | Got: ${res.verdict.padEnd(12)} | Score: ${res.confidence_score}`);
  });

  console.log('\n================ Evaluation Summary ================');
  console.log(`Total Fixtures : ${scenarios.length}`);
  console.log(`Matches        : ${passCount}`);
  console.log(`Discrepancies  : ${failCount}`);
  console.log(`Unsafe Seals   : ${unsafeSeals}`);
  console.log(`Agreement Rate : ${((passCount / scenarios.length) * 100).toFixed(1)}%`);
  console.log('====================================================\n');

  if (unsafeSeals > 0) {
    console.error('CRITICAL: Kill condition triggered due to unsafe seal!');
    process.exit(1);
  }
} catch (err) {
  console.error('[PackManager Agent Error]:', err.message);
  process.exit(1);
}
