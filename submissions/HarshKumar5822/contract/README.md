# Cross-Pod Evidence Record Contract

This directory defines the agreed evidence-record shape for inter-pod communication and audit interchange across Pack Manager pods.

## Schema Overview

The standard evidence record JSON schema includes:
- `record_id`: Unique string identifier (e.g. `REC-1743840000000-A1B2`)
- `timestamp`: ISO-8601 UTC timestamp
- `order_id`: Customer order reference
- `operator_id`: Active bench operator ID
- `verdict`: Stamped verdict (`SEAL`, `STOP_AND_FIX`, `UNCERTAIN`, `PENDING_REVIEW`)
- `confidence_score`: Float between 0.00 and 1.00
- `checks`: Object containing `all_items_present`, `quantities_correct`, `no_extra_items` (`PASS`, `FAIL`, `UNCERTAIN`)
- `discrepancy_types`: Array of detected anomaly codes (`WRONG_ITEM`, `MISSING_ITEM`, `SHORT_QUANTITY`, `EXTRA_ITEM`, `VISUAL_AMBIGUITY`)
- `findings`: Array of detailed human-readable finding objects
- `line_items`: Array of expected vs detected SKU level details
- `detected_items`: Detections returned by the vision perception engine
- `image_quality_flags`: Array of photo flags (`blurry`, `poor_lighting`, `partial_occlusion`, etc.)
- `override`: Optional human override object (`original_verdict`, `new_verdict`, `reason`, `timestamp`)

See [evidence-record.json](file:///c:/Users/harsh/OneDrive/Desktop/pack-manager_1/pack-manager/submissions/HarshKumar5822/contract/evidence-record.json) for the complete JSON schema example.
