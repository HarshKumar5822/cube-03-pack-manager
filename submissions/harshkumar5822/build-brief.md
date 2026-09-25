# Build Brief: Pack Manager

**Author:** Harsh Kumar (`harshkumar5822`)  
**Project:** Pack Manager (Step 03 of 5)  
**Date:** September 25, 2026  

---

## 📌 Executive Summary

Pack Manager is a headless vision AI agent paired with a real-time packing bench web interface. It captures a single photo of an open e-commerce shipping carton prior to sealing, compares the visual contents against the manifest order lines, detects missing or extra items, issues a verdict (`SEAL`, `STOP_AND_FIX`, `UNCERTAIN`), and writes a tamper-evident audit record for downstream dispute resolution.

---

## 📐 Data Contracts & Schema

### Input Order Manifest Format:
`SKU:quantity;SKU:quantity` (e.g. `SKU-B001:2;SKU-A004:1`)

### Output Evidence Record Contract:
```json
{
  "record_id": "PCK-20260925-0012",
  "unit_id": "UNIT-0003",
  "org_id": "org_demo_alpha",
  "photo_refs": ["storage/org_demo_alpha/UNIT-0003_open_box.jpg"],
  "operator_id": "OP-882",
  "captured_at": "2026-09-25T12:00:00Z",
  "order_id": "ORD-99120",
  "channel": "amazon_mfn",
  "order_lines": "SKU-B001:2;SKU-A004:1",
  "observed_in_box": "SKU-B001:2;SKU-A004:1",
  "ai_verdict": "SEAL",
  "operator_verdict": "SEAL",
  "confidence_score": 0.96,
  "checks": [
    { "check": "all_items_present", "verdict": "PASS" },
    { "check": "quantities_correct", "verdict": "PASS" },
    { "check": "no_extra_items", "verdict": "PASS" }
  ],
  "discrepancies": []
}
```

---

## 🏗️ Technical Stack

1. **Agent Backend:** Node.js (TypeScript) / Express, multi-modal Vision LLM integration
2. **Database:** PostgreSQL (with RLS) or SQLite tenant isolation engine
3. **Frontend Bench UI:** React + Vite + Vanilla CSS (Glassmorphism & High Contrast Dark Mode for warehouse lighting)
4. **Evaluation Engine:** Automated evaluation script running held-out 50-unit benchmark fixtures
