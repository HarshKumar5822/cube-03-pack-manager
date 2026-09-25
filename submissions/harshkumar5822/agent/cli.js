/**
 * Command-Line Interface (CLI) Harness for Pack Manager Agent
 * Usage:
 *   node cli.js --csv ../../../data/pack_sample.csv
 *   node cli.js --unit UNIT-0027 --org org_demo_bravo --order SKU-PUZZLE-500:1 --observed SKU-PUZZLE-500:1;SKU-CABLE-USBC:1
 */

const fs = require('fs');
const path = require('path');
const { PackManagerAgent } = require('./pack-agent');
const { TenancyGuardError } = require('./tenancy');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function runCSVBenchmark(csvPath) {
  const absolutePath = path.resolve(process.cwd(), csvPath);
  console.log(`\n📦 PACK MANAGER BENCHMARK RUNNER`);
  console.log(`Reading CSV test fixtures from: ${absolutePath}\n`);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: CSV file not found at ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const headers = parseCSVLine(lines[0]);

  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    return row;
  });

  const agent = new PackManagerAgent();
  let passedCount = 0;
  let stopFixCount = 0;
  let uncertainCount = 0;
  let humanDisagreements = 0;

  console.log(`Processing ${rows.length} packing unit fixtures...\n`);
  console.log(`| Unit ID   | Tenant           | Agent Verdict | Human Verdict | Match? | Discrepancies Flagged`);
  console.log(`|-----------|------------------|---------------|---------------|--------|----------------------`);

  for (const row of rows) {
    // Process fixture with agent
    const record = await agent.processUnit({
      requestTenantId: row.org_id, // Authorised tenant context
      record_id: row.record_id,
      unit_id: row.unit_id,
      org_id: row.org_id,
      order_id: row.order_id,
      channel: row.channel,
      order_lines: row.order_lines,
      photo_refs: [row.photo_refs],
      operator_id: row.operator_id,
      fixtureData: { observed_in_box: row.observed_in_box }
    });

    const humanVerdict = (row.operator_verdict || '').toUpperCase();
    const agentVerdict = record.agent_verdict;

    let verdictIcon = '🟩 SEAL        ';
    if (agentVerdict === 'STOP_AND_FIX') {
      verdictIcon = '🟥 STOP_AND_FIX';
      stopFixCount++;
    } else if (agentVerdict === 'UNCERTAIN') {
      verdictIcon = '🟨 UNCERTAIN   ';
      uncertainCount++;
    } else {
      passedCount++;
    }

    const matchesHuman = agentVerdict === humanVerdict;
    if (!matchesHuman) humanDisagreements++;

    const matchTag = matchesHuman ? '✅ YES' : '⚠️ DIFF';
    const discStr = record.discrepancy_types.join(', ') || 'NONE';

    console.log(`| ${row.unit_id.padEnd(9)} | ${row.org_id.padEnd(16)} | ${verdictIcon.padEnd(13)} | ${humanVerdict.padEnd(13)} | ${matchTag.padEnd(6)} | ${discStr}`);
  }

  console.log(`\n======================================================`);
  console.log(`📊 BENCHMARK SUMMARY REPORT`);
  console.log(`======================================================`);
  console.log(`Total Cartons Evaluated : ${rows.length}`);
  console.log(`🟩 SEAL Verdicts         : ${passedCount}`);
  console.log(`🟥 STOP & FIX Verdicts   : ${stopFixCount}`);
  console.log(`🟨 UNCERTAIN Verdicts    : ${uncertainCount}`);
  console.log(`⚠️ Human Disagreements  : ${humanDisagreements} (Note: Sample human verdicts contain deliberate errors)`);
  console.log(`======================================================\n`);
}

async function runTenancySecurityTest() {
  console.log(`\n🔒 TENANCY ISOLATION SECURITY TEST (Engineering Rule 1)`);
  const agent = new PackManagerAgent();
  
  try {
    // Attempt cross-tenant access: org_demo_bravo requesting org_demo_alpha data
    await agent.processUnit({
      requestTenantId: 'org_demo_bravo', // Malicious or wrong tenant context
      record_id: 'PCK-0008',
      unit_id: 'UNIT-0008',
      org_id: 'org_demo_alpha', // Target record belongs to alpha
      order_id: 'ORD-DUMMY-50008',
      channel: 'shopify',
      order_lines: 'SKU-BOTTLE-750:1',
      photo_refs: ['fixtures/pack/UNIT-0008_open_box.jpg']
    });
    console.error(`❌ TEST FAILED: Cross-tenant access was NOT blocked!`);
  } catch (err) {
    if (err instanceof TenancyGuardError) {
      console.log(`✅ SECURITY TEST PASSED: Cross-tenant request blocked successfully!`);
      console.log(`   Message: ${err.message}`);
    } else {
      console.error(`❌ Unexpected error:`, err);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const csvIdx = args.indexOf('--csv');

  if (csvIdx !== -1 && args[csvIdx + 1]) {
    await runTenancySecurityTest();
    await runCSVBenchmark(args[csvIdx + 1]);
  } else {
    // Default: Run tenancy test + benchmark on pack_sample.csv
    await runTenancySecurityTest();
    const defaultCsv = path.join(__dirname, '..', '..', '..', 'data', 'pack_sample.csv');
    if (fs.existsSync(defaultCsv)) {
      await runCSVBenchmark(defaultCsv);
    } else {
      console.log(`Usage: node cli.js --csv <path-to-csv>`);
    }
  }
}

main().catch(err => {
  console.error("Fatal Agent Error:", err);
  process.exit(1);
});
