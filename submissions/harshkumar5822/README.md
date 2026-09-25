# harshkumar5822 · Pack Manager

> **Position in Chain:** Step 3 of 5 · Outbound to Buyer  
> **Customer:** Merchant-fulfilled Amazon sellers, Shopify merchants, and 3PL warehouse operators packing outbound orders without dedicated hardware stations.  
> **Primary Function:** Instant single-capture vision verification of open box contents prior to tape seal.

---

## 📁 Expected Layout

```
submissions/harshkumar5822/
├── README.md               ← Index & Submission Overview (this file)
├── ARCHITECTURE.md         ← Technical System Architecture & Data Flow
├── 01-customer-letter.md   ← Working Backwards Customer Letter
├── 02-prfaq.md             ← Press Release & Hard Questions FAQ
├── 03-one-pager.md         ← Solution Architecture, Metrics & Kill Condition
├── CLAUDE.md               ← Durable constraints, hard rules, engineering guidelines
├── build-brief.md          ← Technical Brief & System Specification
├── build-log.md            ← Active Chronological Engineering Log
├── eval-report.md          ← Evaluation Methodology, Accuracy, FP/FN & Uncertainty Matrix
├── contract/               ← Inter-Manager JSON Evidence Schema & Interoperability Specs
│   ├── evidence-contract.json
│   └── README.md
└── agent/                  ← Vision Agent Core Code, Backend API, & MERN Interface
    ├── cli.js
    ├── pack-agent.js
    ├── vision-engine.js
    ├── matcher.js
    ├── tenancy.js
    ├── types.js
    ├── server.js
    ├── package.json
    └── ui/
        ├── index.html
        ├── app.css
        └── app.js
```

---

## 🚦 Status

| Face | Deliverable | Status |
| :---: | :--- | :---: |
| **1** | Customer letter, PR/FAQ, one-pager | ☑ |
| **2** | CLAUDE.md, build-brief.md, build-log.md | ☑ |
| **3** | Headless agent on fixtures (`agent/`) | ☑ |
| **4** | Eval report (`eval-report.md`) | ☑ |
| **5** | Evidence record page & UI (`agent/ui/`) | ☑ |
| **6** | Cross-pod contract (`contract/`) | ☑ |

---

## 🎯 Kill Condition

> **Kill Condition:** If zero-shot visual verification fails to achieve $\ge 85\%$ accuracy on unbagged item counts across heterogeneous SKU mixes without per-SKU training or barcodes visible, OR if single-unit batch inference latency exceeds 2.5 seconds on mobile networks, the headless agent must default to mandatory barcode scanning fallback with explicit `UNCERTAIN` audit tagging rather than issuing false `SEAL` verdicts.

---

## 🔗 Quick Links & Nav

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [01 - Customer Letter](01-customer-letter.md)
- [02 - PR / FAQ](02-prfaq.md)
- [03 - Executive One-Pager](03-one-pager.md)
- [CLAUDE.md](CLAUDE.md)
- [Build Brief](build-brief.md)
- [Build Log](build-log.md)
- [Eval Report](eval-report.md)
- [Evidence Contract](contract/README.md)
