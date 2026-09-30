# 03 - One-Pager: Pack Manager

## Executive Summary
**Pack Manager** is an automated vision-assisted packing bench verification system that prevents incorrect or incomplete orders from being sealed and shipped. By enforcing blind perception, catalog matching, and deterministic decision logic, it protects customer trust and reduces expensive return logistics.

---

## Key Product Metrics Table

| Metric | Target Goal | Evaluation Method / Baseline | Current System Achievement |
| :--- | :---: | :--- | :---: |
| **Deterministic Benchmark Accuracy** | **100%** | Test against 21 standard evaluation scenarios | **95.2%** (20/21 pass; 0 unsafe seals) |
| **Unsafe False-Seal Rate** | **0.0%** | Missed discrepancies resulting in invalid `SEAL` verdict | **0.0%** across benchmark suite |
| **Verification Latency** | **< 1.0s** | Full end-to-end perception & matcher execution time | **~350ms - 650ms** |
| **Two-Labeller Agreement** | **> 90%** | Agreement between human manual labellers on ambiguity test set | **95.2%** |
| **Fail-Open Resilience** | **100%** | Network outage or API failure fallback | **100%** (Routes to `PENDING_REVIEW` / `UNCERTAIN`) |
| **Human Override Traceability** | **100%** | Mandatory audit reason logged on manual verdict change | **100%** logged in Audit table |

---

## Core System Checks

```
               [ Open Box Photo(s) ]
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
     [ Visual Perception ]  [ Customer Order ]
             │                     │
             └──────────┬──────────┘
                        ▼
             [ Deterministic Matcher ]
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
     [ SEAL ]   [ STOP & FIX ]  [ UNCERTAIN ]
```

1. **`all_items_present`**: Verifies every SKU on the order sheet is visually observed.
2. **`quantities_correct`**: Confirms exact counts match line items without under-counts or over-counts.
3. **`no_extra_items`**: Ensures no un-ordered products or unmapped objects are placed inside the container.

---

## Mandatory Kill Condition

> **KILL CONDITION:**  
> **If the automated check produces a false-seal rate exceeding 0.5% (sealing a box containing missing, incorrect, extra, or damaged items) during warehouse trial runs, automated sealing authorization MUST immediately halt, disabling auto-seal gates and reverting 100% of boxes to manual human inspection.**
