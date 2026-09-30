# CLAUDE.md - Durable Constraints, Hard Rules & Guardrails

This document specifies the permanent non-negotiable operational constraints, code rules, and forbidden language for the **Pack Manager** codebase.

---

## 1. Hard Architectural Rules

1. **AI Never Decides Verdicts**:
   - The AI vision model is strictly an **observation engine**.
   - It outputs ONLY raw detections (`sku`, `quantity`, `confidence`, `box_position`, `image_quality_flags`).
   - Pure, deterministic, testable JavaScript (`backend/server/matcher.js`) computes the final verdict (`SEAL`, `STOP_AND_FIX`, `UNCERTAIN`).
   - Modifying code to let an LLM or Vision model choose the `verdict` directly is **strictly forbidden**.

2. **Blind Perception Guarantee**:
   - Vision API prompts MUST NOT contain expected order line items or quantities.
   - Showing expected order details to the vision model introduces confirmation bias and is **forbidden**.

3. **No Inferred Evidence**:
   - An item not visible in a blurry, dark, occluded, or partial photo MUST result in `UNCERTAIN`, **never** a presumed `MISSING` or `STOP_AND_FIX` unless visual quality is clean.
   - No guessing or hallucinating items not backed by high-confidence visual evidence.

4. **Fail-Open Operational Safety**:
   - If the AI API fails, times out, returns malformed JSON, or is unreachable, the system MUST save the record as `PENDING_REVIEW` / `UNCERTAIN`.
   - Never auto-seal or fail a box due to system infrastructure failure.

5. **Audit Integrity**:
   - Every human operator override requires a non-empty text justification.
   - Original AI verdicts and confidence scores MUST be immutably retained alongside overrides.

---

## 2. Forbidden Language & Terminology

The following terms and phrasing are **strictly prohibited** in user interfaces, logs, API contracts, and user-facing messages:

| Forbidden Phrase / Term | Reason | Permitted Alternative |
| :--- | :--- | :--- |
| `"AI confirmed box is correct"` | AI does not confirm; matcher logic evaluates rules | `"Matcher rule check passed"` |
| `"Restock / Refurbish / Liquidate"` | Pack Manager is for packing benches, not returns desk | `"STOP & FIX - Return item to shelf"` |
| `"Guaranteed 100% Error Free"` | Vision models are probabilistic | `"High confidence automated verification"` |
| `"Auto-corrected order"` | System never alters customer order data | `"Flagged discrepancy for manual correction"` |
| `"AI Verdict"` | Verdict comes from deterministic rule engine | `"System Verdict"` / `"Matcher Verdict"` |

---

## 3. Mandatory Development Commands

```bash
npm run setup          # Install dependencies
npm test               # Run all 27 unit & integration tests
npm run eval           # Run 21 benchmark scenarios
npm start              # Start backend server on http://localhost:4000
```
