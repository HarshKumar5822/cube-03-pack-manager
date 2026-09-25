# ARCHITECTURE.md — Pack Manager Technical System Architecture

**Author:** Harsh Kumar (`harshkumar5822`)  
**Repository:** `cube-03-pack-manager`  
**Position in Chain:** Step 03 of 5 (Outbound to Buyer)  
**Target Customer:** Merchant-fulfilled e-commerce sellers and 3PL warehouse operators.  

---

## 🏗️ High-Level System Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      PACKING BENCH (OPERATOR CLIENT)                    │
 │  [ Web Camera / Mobile Phone Capture ]  ──▶  [ High-Contrast Bench UI ] │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                 HTTP Post / JSON API (Carton Photo Payload)
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      PACK MANAGER AGENT BACKEND API                    │
 │                                                                        │
 │  1. TENANCY ISOLATION GUARD (Rule 1)                                   │
 │     └─ Enforces Row-Level Security (RLS) on `org_id`                    │
 │                                                                        │
 │  2. BATCHED VISION INFERENCE ENGINE (Rule 2)                           │
 │     └─ 1 multi-modal LLM call per carton carrying all checks           │
 │                                                                        │
 │  3. FAIL-OPEN CIRCUIT BREAKER (Rule 3)                                 │
 │     └─ Latency > 3.0s or HTTP 5xx ──▶ Assigns `PENDING_REVIEW`        │
 │                                                                        │
 │  4. ORDER LINE MATCHER & VERDICT GENERATOR (Rule 4)                     │
 │     └─ Evaluates Missing, Short, Extra, Wrong items                    │
 │     └─ Low visual confidence / occlusion ──▶ Assigns `UNCERTAIN`       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                      Writes Immutable Audit Record
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     CROSS-POD EVIDENCE DATABASE                        │
 │           (`submissions/harshkumar5822/contract/evidence-contract.json`) │
 └─────────────────┬────────────────────────────────────┬─────────────────┘
                   │                                    │
                   ▼                                    ▼
       Step 04: Returns Manager             Step 05: Recovery Manager
   (Audits returned vs shipped items)     (Defends against dispute claims)
```

---

## 🧩 Component Specifications

### 1. Tenancy Guard (`agent/tenancy.js`) — Engineering Rule 1
- **Function:** Enforces database-level Row-Level Security (RLS).
- **Rule:** Every query and image reference is checked against `requestTenantId === record.org_id`.
- **Enforcement:** If `org_demo_bravo` attempts to read an `org_demo_alpha` record, `TenancyGuardError` is thrown immediately.

### 2. Multi-Modal Vision Engine (`agent/vision-engine.js`) — Engineering Rule 2 & 4
- **Function:** Processes single-pass vision requests.
- **Batched Model Prompt:** Takes all order manifest lines (`SKU-A:2;SKU-B:1`) and box photos in **one single model invocation**.
- **Cost Model:** At $\$0.0035$ per call, single-pass batching maintains a $90\%+$ gross margin for 3PL facilities compared to single-SKU sequential calls.

### 3. Order Line Matcher (`agent/matcher.js`)
- **Function:** Performs deterministic cross-matching between expected manifest quantities and vision-detected items.
- **Discrepancy Classifier:**
  - `MISSING_ITEM`: Expected SKU count $> 0$, Observed count $= 0$.
  - `SHORT_QUANTITY`: Expected SKU count $>$ Observed count $> 0$.
  - `EXTRA_ITEM`: Unmanifested SKU detected in box.
  - `WRONG_ITEM`: Pairings of missing manifest items and extra observed items.
  - `VISUAL_AMBIGUITY`: Triggered when visual confidence $< 0.80$.

### 4. Fail-Open Protocol (`agent/pack-agent.js`) — Engineering Rule 3
- **Function:** Ensures warehouse packing lines never block or wait for network/AI timeouts.
- **Behavior:** If API latency exceeds $3.0\text{ seconds}$ or returns an error, the agent assigns `agent_verdict: "PENDING_REVIEW"` and saves the capture locally for background retry.

---

## 📊 Cross-Pod Evidence Record Schema

The evidence output adheres strictly to `submissions/harshkumar5822/contract/evidence-contract.json`:

```json
{
  "record_id": "PCK-0027",
  "unit_id": "UNIT-0027",
  "org_id": "org_demo_bravo",
  "order_id": "ORD-DUMMY-50027",
  "channel": "amazon_mfn",
  "captured_at": "2026-09-25T13:10:00.000Z",
  "photo_refs": ["storage/org_demo_bravo/UNIT-0027_open_box.jpg"],
  "order_lines": "SKU-PUZZLE-500:1",
  "observed_in_box": "SKU-PUZZLE-500:1;SKU-CABLE-USBC:1",
  "agent_verdict": "STOP_AND_FIX",
  "confidence_score": 0.96,
  "checks": {
    "all_items_present": "PASS",
    "quantities_correct": "PASS",
    "no_extra_items": "FAIL"
  },
  "discrepancy_types": ["EXTRA_ITEM"],
  "operator_id": "OP-882",
  "operator_override": null
}
```

---

## 🔒 Security & Data Isolation Architecture

1. **Database Row Isolation:** Forced PostgreSQL RLS policy on `org_id`.
2. **Storage Partitioning:** Images stored under tenant-hashed directories (`storage/{org_hash}/{unit_id}/`).
3. **Signed Access Tokens:** Pre-signed S3 URLs generated on demand with 15-minute expiration windows.
