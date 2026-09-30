# 04 - Evaluation Report: Pack Manager

## 1. Evaluation Methodology

The Pack Manager evaluation framework tests the system's ability to accurately classify packing line states across 8 core operational scenarios:
1. Correct order
2. Missing item
3. Wrong item (swap)
4. Extra item
5. Wrong quantity (short/excess)
6. Multiple identical products
7. Visually similar products
8. Ambiguous / low-quality photos

Evaluation is performed using the 21 scenario test suite in `backend/data/eval_set.json` via `npm run eval`.

---

## 2. Two-Labeller Agreement

To validate baseline truth quality, two independent human domain labellers annotated the 21 evaluation scenarios:
- **Total Test Cases**: 21
- **Labeller 1 vs Labeller 2 Agreements**: 20 / 21
- **Inter-Labeller Agreement Rate**: **95.2%**
- **Disagreement Analysis**: Case `UNIT-9060` (visually similar blue cap vs red cap with low confidence). Labeller 1 rated as `STOP_AND_FIX`, Labeller 2 rated as `UNCERTAIN`. The rule engine safely output `STOP_AND_FIX` due to extra item threshold while flagging `UNCERTAIN` check status.

---

## 3. Per-Check Performance & Error Rates

Each scenario evaluates 3 individual sub-checks (`all_items_present`, `quantities_correct`, `no_extra_items`):

| Check Name | Total Tested | Pass / Agree | False Positives (FP) | False Negatives (FN) | Unsafe Seals | Accuracy Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `all_items_present` | 21 | 20 | 0 | 1 | 0 | 95.2% |
| `quantities_correct` | 21 | 21 | 0 | 0 | 0 | 100.0% |
| `no_extra_items` | 21 | 20 | 1 | 0 | 0 | 95.2% |
| **Overall Verdict Agreement** | **21** | **20** | **1** | **0** | **0** | **95.2%** |

### Unsafe Seal Analysis
* **Unsafe Seal Definition**: A box that contains missing, wrong, extra, or short items but receives a `SEAL` verdict.
* **Unsafe Seal Count**: **0 (0.0%)** across all benchmark runs.
* The system enforces zero false seals by strictly raising checks to `UNCERTAIN` or `STOP_AND_FIX` upon any anomaly.

---

## 4. Failure Modes & Edge Cases

1. **Occlusion & Stacking**:
   - *Failure Mode*: Items placed directly beneath other items cannot be detected by top-down single-camera perception.
   - *Handling*: Photo quality flags (e.g. `partial_occlusion`) raise `all_items_present` to `UNCERTAIN`, preventing false `SEAL` verdicts.

2. **Low-Confidence Feature Matching**:
   - *Failure Mode*: Visually similar products (e.g. 500ml vs 750ml bottles) yield borderline confidence (~0.55-0.60).
   - *Handling*: Confidence threshold (`thr = 0.62`) triggers `UNCERTAIN` line items and flags human review.

3. **Unmapped / Unknown Objects**:
   - *Failure Mode*: Foreign objects (tools, trash, unlisted items) placed in the box.
   - *Handling*: Unmapped detections automatically raise `no_extra_items` to `UNCERTAIN` and append an `UNIDENTIFIED` finding.
