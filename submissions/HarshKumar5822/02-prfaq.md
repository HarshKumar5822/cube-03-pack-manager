# 02 - Press Release & Frequently Asked Questions (PR/FAQ)

## Press Release

### FOR IMMEDIATE RELEASE

**Pack Manager Launches AI-Powered Open-Box Verification to Eliminate Fulfillment Errors**

**LOCATION** — *September 30, 2026* — Pack Manager today announced the immediate availability of its automated open-box verification system, engineered to inspect contents of packing containers before sealing. Combining blind computer vision perception with strict, deterministic validation rules, Pack Manager prevents mis-packs, missing items, and quantity errors before packages leave fulfillment centers.

"Traditional packing lines rely on human memory or barcode scanning each unit individually, which fails when packers grab the wrong item or miscount identical SKUs," said HarshKumar5822, Lead Architect. "Pack Manager solves this at the point of sealing. It sees the box as it actually is, verifies every unit against the catalogue, and stamps an auditable verdict in less than 500 milliseconds."

Pack Manager features:
- **Blind Vision Perception:** Ensures AI vision models identify items without knowing the target order, eliminating confirmation bias.
- **Deterministic Matcher:** Zero AI decision-making on verdicts; standard business logic guarantees auditability.
- **Human-in-the-Loop Override:** Complete audit trail with mandatory reasoning when operators override `UNCERTAIN` or `STOP_AND_FIX` verdicts.

---

## Frequently Asked Questions (FAQ)

### General Questions

**Q1: How does Pack Manager work on a packing bench?**  
A overhead or handheld camera captures 1 to 3 photos of an open shipping box. Pack Manager identifies SKUs and quantities, matches them against the warehouse order system, and displays a green (`SEAL`), red (`STOP_AND_FIX`), or amber (`UNCERTAIN`) light on the packer's terminal screen.

**Q2: What AI vision providers are supported?**  
Pack Manager natively supports Groq (`qwen/qwen3.6-27b`, `qwen/qwen3.8-27b`) and Anthropic (`claude-sonnet-5-5`, `claude-haiku-4-5-20251001`), with graceful fallback when services are unreachable.

---

### Questions We'd Rather Not Answer (Hard Questions)

**Q3: What happens when two products look identical from the top view (e.g., Blue Cap vs Red Cap in plain packaging)?**  
*The uncomfortable truth:* Top-down camera angles cannot distinguish items wrapped in opaque polybags or identical brown inner boxes. If reference photos and visual features are ambiguous, Pack Manager assigns a low confidence score to the detection, causing the matcher to return `UNCERTAIN`. The packer must manually scan or inspect the item. Pack Manager refuses to guess when visual ambiguity exists.

**Q4: Will Pack Manager slow down fast packers who process 120 boxes an hour?**  
*The uncomfortable truth:* Adding a mandatory vision trigger adds ~300ms to 800ms of latency per box. If API providers experience latency spikes, bench throughput slows down. To mitigate this, Pack Manager supports local offline stubbing and asynchronous queueing, but network dependency remains a real factor in live cloud deployments.

**Q5: Can packers easily cheat the system by putting an item in the box for the photo and removing it right before sealing?**  
*The uncomfortable truth:* Yes. Pack Manager verifies the visual state at the exact instant the photo is taken. It does not replace physical security, weight sensors, or camera surveillance over the bench. It verifies *what was packed at T=0*, not physical operator intent at T+5s.

**Q6: How does the system handle items buried at the bottom of a deep box or covered by bubble wrap?**  
*The uncomfortable truth:* It cannot see through solid objects or heavy packing material. If an item is occluded, it won't be detected. If an expected item is undetected due to occlusion, the matcher marks `all_items_present` as `UNCERTAIN` (or `MISSING` if photo quality appears clean), requiring the packer to unstack or clear occlusion before sealing.

**Q7: What is the cost of running vision API calls for millions of packages?**  
*The uncomfortable truth:* High-volume vision API calls add ongoing per-box operational costs (~$0.001 - $0.005 per check). While significantly cheaper than a $15-$25 mis-pack return, high volume warehouses must account for API token budgets.
