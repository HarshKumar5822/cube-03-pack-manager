# Build Brief - Pack Manager

## 1. Project Goal
Pack Manager is built for modern warehouse packing benches. It replaces manual box audits with instant, vision-guided order checking before carton sealing.

---

## 2. Technical Stack & Architecture

- **Backend**: Node.js + Express (`backend/server/index.js`)
- **Vision Integration**: Dual-provider client (`backend/server/ai.js`) supporting Groq (`qwen/qwen3.6-27b`) & Anthropic (`claude-sonnet-5-5`) with automatic failover.
- **Rule Engine**: Pure deterministic logic (`backend/server/matcher.js`).
- **Frontend**: Vanilla JavaScript + modern CSS design system with tabbed interfaces (`Bench`, `Insights`, `Orders`, `Audit`, `Library`, `Label desk`, `Benchmark`, `System`).

---

## 3. Data Flow Pipeline

```text
[ Image Input (1-3 photos) ] ──► [ Vision AI (Blind Perception) ]
                                          │
                                          ▼
                                 [ Parsed Detections ]
                                          │
 [ Customer Order Lines ] ──────► [ Rule Engine (matcher.js) ]
                                          │
                                          ▼
                                 [ Verdict & Findings ]
                                          │
                                          ▼
                                [ Stamped Evidence Record ]
```

---

## 4. Key Design Principles
- **Separation of Perception & Judgment**: Vision AI identifies objects; deterministic code decides pass/fail.
- **Workspace Isolation**: Support for demo vs live data separation.
- **Auditability**: Complete history of every visual record, detected bounding positions, and human overrides.
