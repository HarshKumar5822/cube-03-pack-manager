# harshkumar5822 · Pack Manager

> **Position in Chain:** Step 3 of 5 · Outbound to Buyer  
> **Customer:** Merchant-fulfilled Amazon sellers, Shopify merchants, and 3PL warehouse operators packing outbound orders without dedicated hardware stations.  
> **Primary Function:** Instant single-capture vision verification of open box contents prior to tape seal.

---

## 📁 Submission Directory Structure

```
submissions/harshkumar5822/
├── README.md               ← Index & Submission Overview
├── 01-customer-letter.md   ← Working Backwards Customer Letter
├── 02-prfaq.md             ← Press Release & Hard Questions FAQ
├── 03-one-pager.md         ← Solution Architecture, Metrics & Kill Condition
├── CLAUDE.md               ← Engineering Rules, Architectural Constraints & Protocol
├── build-brief.md          ← Technical Brief & System Specification
├── build-log.md            ← Active Chronological Engineering Log
├── eval-report.md          ← Evaluation Methodology, Accuracy, FP/FN & Uncertainty Matrix
├── contract/               ← Inter-Manager JSON Evidence Schema & Interoperability Specs
└── agent/                  ← Vision Agent Core Code, Backend API, & MERN Interface
```

---

## 🚦 Roadmap & Implementation Status

| Phase | Component / Deliverable | Description | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | Working Backwards Documentation | `01-customer-letter.md`, `02-prfaq.md`, `03-one-pager.md` | ✅ Complete |
| **Phase 2** | Technical Design & Constraints | `CLAUDE.md`, `build-brief.md`, `build-log.md` | 🔄 In Progress |
| **Phase 3** | Headless AI Agent Core | Multi-modal vision batch reasoning engine + JSON Schema output | ⏳ Pending |
| **Phase 4** | Evidence Contract & Traceability | Shared schema JSON exporter for Returns (04) & Recovery (05) | ⏳ Pending |
| **Phase 5** | Evaluation & Uncertainty Benchmark | 50-unit held-out benchmark, FP/FN metrics, dual-labeller inter-rater reliability | ⏳ Pending |
| **Phase 6** | MERN UI + Live Camera Stream | High-speed mobile/desktop web app, image uploads & override logging | ⏳ Pending |

---

## 🎯 Primary Kill Condition

> **Kill Condition:** If zero-shot visual verification fails to achieve $\ge 85\%$ accuracy on unbagged item counts across heterogeneous SKU mixes without per-SKU training or barcodes visible, OR if single-unit batch inference latency exceeds 2.5 seconds on mobile networks, the headless agent must default to mandatory barcode scanning fallback with explicit `UNCERTAIN` audit tagging rather than issuing false `SEAL` verdicts.

---

## 🔗 Quick Links & Nav

- [01 - Customer Letter](01-customer-letter.md)
- [02 - PR / FAQ](02-prfaq.md)
- [03 - Executive One-Pager](03-one-pager.md)
