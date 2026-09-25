# Cross-Pod Evidence Contract: Pack Manager (Step 03)

This directory defines the interoperability evidence record schema produced by **Pack Manager (Step 03)** and consumed by downstream pods:
- **Returns Manager (Step 04):** Consumes `observed_in_box` and `photo_refs` to verify if returned items match what was originally packed and sent.
- **Recovery Manager (Step 05):** Consumes `agent_verdict`, `photo_refs`, `confidence_score`, and `checks` to contest customer buyer dispute claims (e.g., "Empty Box" or "Wrong Item" claims).

---

## 📄 Contract Files

- [`evidence-contract.json`](evidence-contract.json) — JSON Schema (Draft-07) defining the exact shape of a Pack Manager evidence record.

---

## 🔒 Key Interoperability Fields

| Field | Meaning | Consumer Pod |
| :--- | :--- | :--- |
| `unit_id` | Shared tracking ID across all 5 repos (`UNIT-0001` ... `UNIT-0100`) | 04 Returns, 05 Recovery |
| `photo_refs` | S3 / storage paths to open carton photos prior to tape seal | 04 Returns, 05 Recovery |
| `order_lines` | Expected SKU quantities (`SKU:qty;SKU:qty`) | 04 Returns, 05 Recovery |
| `observed_in_box` | Vision AI detected SKU quantities | 04 Returns, 05 Recovery |
| `agent_verdict` | Final operational decision (`SEAL`, `STOP_AND_FIX`, `UNCERTAIN`) | 05 Recovery |
| `checks` | Sub-verdicts for `all_items_present`, `quantities_correct`, `no_extra_items` | 05 Recovery |
