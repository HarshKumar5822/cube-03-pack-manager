# Cube Buildathon · 03 · Pack Manager

**Commerce Context stream · Round 2 · Individual Build**

**Created by Harsh Kumar** ([@HarshKumar5822](https://github.com/HarshKumar5822))

> 📦 **Submission Index & Deliverables:** [submissions/HarshKumar5822/](submissions/HarshKumar5822/README.md)  
> 📐 **System Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)  
> 🚀 **Live Deployment URL:** [https://cube-03-pack-manager.onrender.com/](https://cube-03-pack-manager.onrender.com/)


---

> Five agents, one unit, one record that follows it.
> A physical product arrives, gets prepped, gets shipped, comes back. At every step a person makes a fast judgment that nobody records. **You build the agent that makes one of those judgments, and leaves proof.**

**Quick Links:**

1. [`GITHUB-GUIDE.md`](GITHUB-GUIDE.md) explains how to fork the repository, set it up, build and push your work.
2. [`RULES.md`](RULES.md) covers the repository and engineering rules.

---

## Pack Manager Overview

An AI check that looks at an **open box** and compares it with the **order** before it is sealed.
It answers **SEAL**, **STOP & FIX**, or **UNCERTAIN**, and lists what is present, missing, wrong, extra, or the wrong quantity, with the photo kept as evidence.

### Position in the chain
Step 3 of 5. Outbound to buyer.
* **Customer**: Seller or 3PL packing outbound orders
* **What gets recorded**: Contents at seal
* **Who consumes your output**: Returns Manager (what was actually sent) and Recovery Manager (buyer disputes, empty-box and wrong-item claims)

---

## Run it

```bash
npm run setup          # installs backend dependencies
cp backend/.env.example backend/.env     # then add ONE key (Groq or Anthropic)
npm run seed           # demo records + 3 sample orders (optional)
npm start              # http://localhost:4000
```

Node 18 or newer. With no key the app still runs: every box is held as "Manual check" and **nothing is guessed**.

---

## How the AI is used (and kept honest)

1. **Blind perception.** One vision call per box (up to 3 photos). The model is **never shown the order**, so it cannot confirm what it was told to expect. It returns JSON: SKU, quantity, confidence, the evidence it saw, and approximate box positions.
2. **Validation.** SKUs outside the catalogue become "unmapped" objects. A detection with no stated evidence cannot be high-confidence. An empty result raises a photo-quality flag.
3. **Plain code decides** (`backend/server/matcher.js`). Only things actually *seen* can cause STOP & FIX. Not seeing something in a blurry, dark or partial photo gives UNCERTAIN, never a guess. Products with no description or photo cannot be verified and are reported UNCERTAIN.
4. **Fail open.** If the AI is unreachable, the box is saved as PENDING_REVIEW with the photo. No detections are invented.
5. **Claude co-pilot.** Ask "why this verdict?" on any record. It is grounded only in that record and **cannot change the verdict**. Without a model it falls back to a labelled rule-based explanation.
6. **Reference photos.** With Anthropic as provider, catalogue photos are sent alongside the box photos to help separate look-alikes (blue vs red cap).
7. **Human override** needs a reason and is kept in the audit trail next to the AI's original verdict.

Providers: Groq (default `qwen/qwen3.6-27b`, fallback `qwen/qwen3.8-27b`) or Anthropic (`claude-sonnet-5-5`, fallback `claude-haiku-4-5-20251001`). Model IDs get retired; the **System** page asks the provider which models it really serves and flags any that are gone.

---

## Pages

| Page | What it does |
|---|---|
| Bench | Pick an order, add photos (upload, drag, or camera), run the check, stamped verdict, boxes on the photo, co-pilot |
| Insights | Verdict doughnut, daily line graph with cumulative seal rate, defect types, worst products, confidence histogram, channel breakdown |
| Orders | Build orders from the catalogue |
| Audit | Every record, filters, photos, AI details, override, CSV export |
| Library | Product descriptions and reference photos (this is what the AI recognises) |
| Label desk | Manual labelling of PRODUCT 01-50 (see below) |
| Benchmark | Evaluation against 21 scenarios, plus a Logic lab to try what-if detections |
| System | Provider, model check, how a verdict is made, workspace isolation check |

**Live vs Demo.** Charts show Live data by default. Demo data is built from the challenge's sample rows and 21 scenarios, always flagged, never mixed into Live numbers, and removable.

---

## The 8 challenge scenarios

Correct order, missing item, wrong item, extra item, wrong quantity, multiple identical products, visually similar products, and ambiguous photos are all in `backend/data/eval_set.json` and run by `npm run eval` and the Benchmark page.

**What the benchmark does and does not prove.** The bundled run skips the AI vision step and only tests the matching rules against author-written labels: 20 of 21 verdicts agree, 0 unsafe seals (a box that should be held but got SEAL). The 2 differences are reported, not hidden. It says **nothing** about how well a model recognises real products. For that, put photos and a `labels.csv` in `backend/fixtures/eval/` (see the README there) and run `npm run eval:vision`.

---

## Product photos from the Drive folder

The app cannot fetch the Drive folder by itself. Download the folder, then:

```bash
npm run import:products -- "/path/to/CUBE 2026 - RTN PRODUCT COLLECTION"
```

Photos are filed under `PRODUCT-01` to `PRODUCT-50` and appear in the Library, the order builder, the Bench, and the Label desk. Give each product a name and description in the Library so the AI can recognise it.

The **Label desk** records a person's answers (matches details? parts visible? condition? SKU/ASIN defaulting to UNKNOWN) and exports a CSV or reply text. The AI never pre-fills answers, and there is no restock/refurbish/liquidate/dispose option.

---

## Tests

```bash
npm test               # 27 tests: matcher rules and the full AI pipeline against a stub AI server
```

The pipeline tests cover the blind prompt, multi-photo requests, model fallback, fail-open, rejecting an HTML file sent as a photo, org-scoped evidence, co-pilot, and the Anthropic request shape.

---

## Known limits

- **No real sign-in.** The workspace and operator are chosen in the browser, so tenancy is demo-grade. Add authentication before using real customer data.
- Live AI calls were not run in development (no network access to the providers). Expect to tune the prompt and confidence floor on real photos.
- Box positions are the model's approximations.
- Cost avoided is an estimate from an assumed cost per wrong shipment, not a measurement.
- Never commit `backend/.env`. If an API key was ever shared or committed, rotate it.
