# Headless Agent - Pack Manager

This directory contains the headless agent entry point for running evaluation fixtures and processing packing checks programmatically without UI dependencies.

## Usage

```bash
# Run headless agent on standard evaluation set
node submissions/HarshKumar5822/agent/index.js

# Run with custom fixtures file
node submissions/HarshKumar5822/agent/index.js /path/to/custom_fixtures.json
```

## Structure
- `index.js`: Headless CLI agent runner. Imports deterministic rule matcher from `backend/server/matcher.js`.
