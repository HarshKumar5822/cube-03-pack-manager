# Pack Manager: evaluation report

Generated: 2026-09-30T15:47:13.435Z

> **Read this first.** The "Logic only" run feeds hand-written detections straight into the matcher, so it measures the decision rules and nothing else. It cannot show that the AI sees a box correctly. Only the "Vision in the loop" run, with real photos and independent labels, supports that claim. The labels in `data/eval_set.json` were written by the project author, not by an independent labeller.

## Logic only (perception skipped)

- Units scored: **21**
- Verdict agreement with labels: **95.2%**
- **Unsafe seals** (should hold, got SEAL): **0**
- False stops (should seal, got STOP_AND_FIX): 0
- UNCERTAIN verdicts: 5 (24%)

### Per-check confusion (rows = label, columns = agent)

**all_items_present**

| label \ agent | PASS | FAIL | UNCERTAIN |
|---|---|---|---|
| PASS | 11 | 0 | 0 |
| FAIL | 0 | 6 | 0 |
| UNCERTAIN | 1 | 0 | 3 |

FAIL precision 100%, recall 100% (tp 6, fp 0, fn 0).

**quantities_correct**

| label \ agent | PASS | FAIL | UNCERTAIN |
|---|---|---|---|
| PASS | 13 | 0 | 1 |
| FAIL | 0 | 4 | 0 |
| UNCERTAIN | 0 | 0 | 3 |

FAIL precision 100%, recall 100% (tp 4, fp 0, fn 0).

**no_extra_items**

| label \ agent | PASS | FAIL | UNCERTAIN |
|---|---|---|---|
| PASS | 16 | 0 | 0 |
| FAIL | 0 | 2 | 1 |
| UNCERTAIN | 0 | 0 | 2 |

FAIL precision 100%, recall 66.7% (tp 2, fp 0, fn 1).

### Disagreements with labels (2)

- **UNIT-9060** (visually_similar): label STOP_AND_FIX, agent UNCERTAIN; checks differing: all_items_present, no_extra_items. Possible extra item: Red Cap (SKU-CAP-RED) seen with low confidence. Count unconfirmed: Blue Cap (SKU-CAP-BLU) - expected 2, counted 1, but the count is not reliable enough to call it short.
- **UNIT-9061** (visually_similar): label UNCERTAIN, agent UNCERTAIN; checks differing: quantities_correct. Low confidence on 750ml Steel Water Bottle (SKU-BOTTLE-750): 58%.

## Vision in the loop

_Skipped: Run `npm run eval:vision` with photos in fixtures/eval to score the real AI pipeline._

