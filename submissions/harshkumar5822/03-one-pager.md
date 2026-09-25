# 03 · Executive One-Pager: Pack Manager

> **Project:** Pack Manager (Step 03 of 5 · Commerce Context Stream)  
> **Author:** Harsh Kumar (`harshkumar5822`)  
> **Repository Branch:** `harshkumar5822`  

---

## 🎯 Problem Statement & Core Value Proposition

In e-commerce fulfillment, **mis-shipments** (missing items, wrong quantities, wrong SKUs, or unauthorized extra items) cost merchants 1.5%–3.5% of total revenue in reshipments, customer support overhead, and unearned refunds. Existing industrial pack-verification hardware is cost-prohibitive for SMB sellers and dynamic 3PL pack benches.

**Pack Manager** provides a zero-hardware vision AI agent that audits open shipping cartons against order manifests using ordinary mobile/webcam photos taken before box sealing. It issues instant verdicts (`SEAL`, `STOP_AND_FIX`, `UNCERTAIN`) and registers immutable visual evidence for downstream claim recovery.

---

## 🏗️ System Architecture & Data Flow

```text
               PACKING BENCH (OPERATOR)
                          │
            [ Photograph of Open Carton ]
                          │
                          ▼
            ┌───────────────────────────┐
            │   Pack Manager API Node   │ ──(Tenant Auth & RLS check: org_id)
            └─────────────┬─────────────┘
                          │
          Single-Pass Batched Vision Inference (Rule 2)
                          │
                          ▼
            ┌───────────────────────────┐
            │  Structured Vision LLM    │ ──(Extracts observed SKUs & qtys)
            └─────────────┬─────────────┘
                          │
           Deterministic Order Line Matcher
                          │
                          ▼
         ┌─────────────────────────────────┐
         │       VERDICT GENERATOR         │
         ├─────────────────────────────────┤
         │  PASS      ──▶  SEAL            │
         │  FAIL      ──▶  STOP_AND_FIX    │
         │  UNCERTAIN ──▶  UNCERTAIN / RE-SCAN│
         └────────────────┬────────────────┘
                          │
             Save Visual Evidence Record
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
Step 04: Returns Manager        Step 05: Recovery Manager
(Audit sent vs returned)        (Dispute proof against claim)
```

---

## 📊 Core Target Metrics

| Metric Category | Target Benchmark | Measurement Method |
| :--- | :--- | :--- |
| **Verification Accuracy** | $\ge 92\%$ across unoccluded items | 50-unit dual-labeller held-out test set |
| **Inference Latency** | $< 1.8 \text{ sec}$ per carton | End-to-end API response timer |
| **False Positive Rate (Bad Seal)** | $< 1.0\%$ | Model marked SEAL on incorrect contents |
| **Uncertainty Recall** | $100\%$ on occluded / low-light items | Model routed low-confidence items to `UNCERTAIN` |
| **Tenancy Isolation** | $0$ cross-tenant data leaks | Automated RLS security test (`org_demo_alpha` vs `bravo`) |
| **Cost Per Carton** | $< \$0.005$ | 1 batched model invocation per unit |

---

## 🛑 Kill Conditions (Non-Negotiable Thresholds)

1. **Accuracy Kill Condition:** If zero-shot visual verification fails to achieve $\ge 85\%$ accuracy on unbagged item counts across heterogeneous SKU mixes without per-SKU custom fine-tuning, OR if single-unit batch inference latency exceeds 2.5 seconds on standard mobile connections, the system must trigger a mandatory fallback to barcode scanning with explicit `UNCERTAIN` audit tagging rather than issuing false `SEAL` verdicts.
2. **Tenancy Isolation Kill Condition:** If any test case allows `org_demo_bravo` to read, query, or infer image evidence belonging to `org_demo_alpha`, the system fails deployment immediately.

---

## ⚙️ Engineering Rules Compliance Summary

| Rule | Requirement | Implementation Strategy in Pack Manager |
| :---: | :--- | :--- |
| **Rule 1** | Tenancy Isolation | PostgreSQL Row-Level Security (RLS) forced on `org_id` for all queries. S3 paths scoped by tenant hash. |
| **Rule 2** | Batch Model Calls | Exactly 1 vision model call per unit containing all order lines and image inputs simultaneously. |
| **Rule 3** | Fail Open | Timeouts or API failures fallback to `PENDING_REVIEW` record without locking packer UI. |
| **Rule 4** | `UNCERTAIN` Verdict | First-class verdict status assigned when visual confidence $< 0.80$ or items are occluded. |
| **Rule 5** | Authoritative Rules | SKU definitions and channel policies pulled dynamically from schema, not recalled from LLM weights. |
