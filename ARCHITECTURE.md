# ARCHITECTURE.md - Pack Manager (Step 3 of 5)

## 1. System Position & Context in the 5-Step Chain

Pack Manager operates at **Step 3 of 5 (Outbound to Buyer)** in the Commerce Context pipeline:

```text
┌────────────────┐      ┌────────────────┐      ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│  01 Receiving  │ ───► │    02 Prep     │ ───► │    03 Pack     │ ───► │   04 Returns   │ ───► │  05 Recovery   │
│  Inbound arrival│      │  FBA compliance│      │ Outbound seal  │      │   Return proof │      │ Claim defense  │
└────────────────┘      └────────────────┘      └───────┬────────┘      └────────┬───────┘      └────────▲───────┘
                                                        │                        │                       │
                                                        └────────────────────────┴───────────────────────┘
                                                           Evidence records joined via unit_id (UNIT-0001..0100)
```

- **Upstream Inputs**: Customer orders from WMS/ERP, physical items assembled by picker in an open box (`UNIT-0001` ... `UNIT-0100`).
- **Downstream Consumers**:
  - **Returns Manager (04)**: Consumes the outbound contents record to verify what was originally shipped when assessing return disposition.
  - **Recovery Manager (05)**: Consumes the stamped pack evidence record (with photos, bounding positions, and matcher verdicts) to defend against empty-box claims, wrong-item disputes, and chargebacks.

---

## 2. Core Architecture & Pipeline

Pack Manager decouples **Visual Perception** from **Deterministic Decision Logic**:

```text
               ┌───────────────────────────────┐
               │  Open Box Photo(s) (1-3)      │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │ Blind Perception Engine       │
               │ (Groq / Anthropic Vision API) │
               │ *NO order details provided*   │
               └───────────────┬───────────────┘
                               │ Returns detected SKUs, quantities,
                               │ confidence scores & quality flags
                               ▼
               ┌───────────────────────────────┐
               │  Customer Order Line Items    │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │  Deterministic Matcher        │
               │  (backend/server/matcher.js)  │
               └───────────────┬───────────────┘
                               │ Evaluates 3 PASS/FAIL/UNCERTAIN checks
                               ▼
  ┌────────────────────────────┼────────────────────────────┐
  ▼                            ▼                            ▼
[ SEAL ]                 [ STOP_AND_FIX ]              [ UNCERTAIN ]
Box taped & shipped     Discrepancy highlighted       Photo issue / low conf
                        Packer corrects SKU/qty       Routed for manual check
```

---

## 3. PASS / FAIL / UNCERTAIN Check Definitions

The deterministic matcher (`backend/server/matcher.js`) evaluates three explicit checks:

1. **`all_items_present`**:
   - `PASS`: All SKUs listed on the order sheet were detected with high confidence (`≥ 0.62`).
   - `FAIL`: An expected SKU is clearly missing from a clean, high-quality photo, or a wrong SKU was swapped.
   - `UNCERTAIN`: An expected SKU was not seen, but the photo suffered from quality flags (`blurry`, `poor_lighting`, `partial_occlusion`).

2. **`quantities_correct`**:
   - `PASS`: Count of detected units matches ordered count exactly per line item.
   - `FAIL`: High-confidence count shows excess or short units.
   - `UNCERTAIN`: Count is unconfirmed due to low detection confidence or partial box occlusion.

3. **`no_extra_items`**:
   - `PASS`: No unauthorized SKUs or unmapped objects detected in the container.
   - `FAIL`: High-confidence detection of an un-ordered SKU.
   - `UNCERTAIN`: Photo cut off at edge (`box_partially_out_of_frame`) or unmapped object detected.

---

## 4. Evidence Traceability & Interoperability

Every pack verification generates an immutable **Evidence Record** structured per the cross-pod contract:

- **Unit Identification**: Joined via `unit_id` (`UNIT-0001` through `UNIT-0100`).
- **Chain of Evidence**:
  - `What should be in the box?` ➔ Order line mapping (`order_lines`)
  - `What was actually found?` ➔ Observed detections & box coordinates (`detected_items`)
  - `What checks were performed?` ➔ Status of `all_items_present`, `quantities_correct`, `no_extra_items`
  - `What verdict was produced?` ➔ `SEAL`, `STOP_AND_FIX`, or `UNCERTAIN`
  - `Why?` ➔ Granular findings list and image quality flags
- **Audit & Overrides**: Includes operator ID, original AI findings, and mandatory justification for manual overrides.

---

## 5. Non-Functional Capabilities & Failure Modes

- **Fail-Open Resilience**: Infrastructure timeouts, API model deprecations, or network failures immediately fallback to `PENDING_REVIEW` / `UNCERTAIN`. No false `SEAL` is ever issued on infrastructure failure.
- **Model Fallback**: Primary provider (Groq `qwen/qwen3.6-27b`) automatically falls back to secondary provider (Anthropic `claude-sonnet-5-5` / `claude-haiku-4-5-20251001`).
- **Zero Confirmation Bias**: Vision models perform blind perception without viewing target order expectations.
