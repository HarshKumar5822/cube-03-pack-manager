# CLAUDE.md — Pack Manager Engineering Rules & Constraints

> **Repository:** `cube-03-pack-manager`  
> **Participant:** Harsh Kumar (`harshkumar5822`)  
> **Stage:** Step 03 of 5 · Pack Manager (Outbound to Buyer)  

---

## 🛠️ Mandatory Engineering Rules (Non-Negotiable)

### 1. Tenancy Isolation Before Any Feature
- Every database query and storage access **MUST** enforce row-level security (RLS) keying on `org_id`.
- Test cases must explicitly verify that `org_demo_bravo` receives zero records when querying data belonging to `org_demo_alpha`.
- Shared, guessable image URL paths without signed tokens or tenant hashes are strictly forbidden.

### 2. Batch Model Calls
- Make **EXACTLY ONE** multi-modal LLM call per unit to evaluate all order lines, quantities, and anomaly checks simultaneously.
- Never issue sequential or looped LLM calls per SKU item on a single carton capture.

### 3. Fail Open Protocol
- If a vision model call times out or fails (HTTP 5xx, network drop), the system **MUST** save the capture image, assign a status of `PENDING_REVIEW`, and return control to the bench operator immediately.
- Packing bench operations must never freeze or block waiting for an async AI service recovery.

### 4. `UNCERTAIN` is a First-Class Verdict
- `UNCERTAIN` is not a low-confidence `PASS`.
- If an item is occluded, obscured, reflection-heavy, or visually ambiguous, the model must return `UNCERTAIN`.
- The UI must treat `UNCERTAIN` as a valid outcome requiring 1-tap human review or barcode fallback.

### 5. Look Up Authoritative Rules
- SKU manifest specifications and channel business rules must be pulled dynamically from authority schemas/databases.
- Never rely on LLM memory or example synthetic CSV flags as authoritative ground truth.

---

## 🚫 Forbidden Practices & Anti-Patterns

1. **No Silent Overrides:** Operator overrides must record `original_verdict`, `operator_verdict`, `operator_id`, `timestamp`, and `override_reason`. Never overwrite historical rows.
2. **No FBA Handling:** FBA orders are packed by Amazon. Pack Manager strictly targets `amazon_mfn`, `shopify`, `walmart`, and `3pl_client`.
3. **No Unhandled Fallbacks:** Do not mask vision failures with synthetic 100% confidence scores.

---

## 💻 Tech Stack & Architecture Standards

- **Core Backend:** Node.js / Express or Fastify with TypeScript
- **Database & Storage:** PostgreSQL with RLS enabled; local/S3 image storage with signed URLs
- **AI Vision Core:** Batched vision agent via Gemini / Claude Multi-modal API with strict JSON schema outputs
- **Frontend Bench UI:** React / Vite MERN stack with camera capture, real-time bounding box renders, and override controls
