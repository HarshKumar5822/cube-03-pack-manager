# Build Log - Pack Manager

*Organisers note: This log tracks active development, testing, and milestone completions.*

---

## Timeline & Milestones

### Phase 1: Core Foundation & Perception Pipeline
- **Milestone 1.1**: Initialized repository structure with Node.js Express backend and vanilla JS frontend.
- **Milestone 1.2**: Implemented blind perception prompt schema in `backend/server/ai.js`. Vision model returns strict JSON with SKU, quantity, confidence, evidence notes, and bounding box approximations.
- **Milestone 1.3**: Integrated Groq (`qwen/qwen3.6-27b`) and Anthropic (`claude-sonnet-5-5`) API adapters with dynamic model capability checks.

### Phase 2: Deterministic Rule Engine & Evaluator
- **Milestone 2.1**: Built `evaluatePacking()` in `backend/server/matcher.js`. Implemented `raise()` logic for `PASS` -> `UNCERTAIN` -> `FAIL` severity progression.
- **Milestone 2.2**: Implemented wrong-item candidate pairing (`pairWrongItems()`) to distinguish true SKU swaps (e.g. Blue Cap vs Red Cap) from independent extra/missing items.
- **Milestone 2.3**: Handled image quality flags (`blurry`, `poor_lighting`, `partial_occlusion`, `glare`, `box_partially_out_of_frame`) to automatically raise uncertainty instead of falsely penalizing boxes.

### Phase 3: Benchmark & Evaluation Suite
- **Milestone 3.1**: Authored 21 benchmark scenarios covering all 8 challenge cases in `backend/data/eval_set.json`.
- **Milestone 3.2**: Created automated test suite (`npm test`) with 27 unit & integration tests covering stubbed vision responses, model failovers, HTML rejection, and co-pilot explanations.
- **Milestone 3.3**: Created `Benchmark` page UI with interactive Logic Lab for real-time what-if scenario testing.

### Phase 4: UI & Operational Workflow
- **Milestone 4.1**: Designed Bench view with photo upload, live camera feed support, and stamped visual bounding boxes.
- **Milestone 4.2**: Built Audit log view with filterable historical records, human override reasons, and CSV export.
- **Milestone 4.3**: Built Library & Label desk for catalog management and manual product annotation.

### Phase 5: Submission Packaging & Multi-Pod Contract Alignment
- **Milestone 5.1**: Formatted submission directory `submissions/HarshKumar5822/`.
- **Milestone 5.2**: Drafted Customer Letter, PR/FAQ, One-Pager with Kill Condition, CLAUDE.md durable constraints, and cross-pod evidence record contract schema.
- **Milestone 5.3**: Verified all unit tests pass clean (`27/27 pass`) and evaluation suite passes (`20/21 agree, 0 unsafe seals`).
