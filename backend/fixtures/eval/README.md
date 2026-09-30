# Vision-in-the-loop eval fixtures

This folder is empty on purpose - no real photos ship with this repo (same as the
official `data/` folder). To run a real, honest test of the vision perception step
(not just the decision logic), add:

1. Open-box photos in this folder, e.g. `UNIT-9001.jpg`.
2. A `labels.csv` file in this folder with these columns:

```
unit_id,scenario,order_lines,image_file,expected_verdict,expected_checks
UNIT-9001,correct_order,SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1,UNIT-9001.jpg,SEAL,"{""all_items_present"":""PASS"",""quantities_correct"":""PASS"",""no_extra_items"":""PASS""}"
```

Then run:

```
npm run eval:vision
```

This calls the real Groq vision pipeline once per row (one call per unit, per
Engineering Rule 2) and scores it exactly the same way the simulated run is scored,
so the two reports are directly comparable. Recommended minimum: 20 photos covering
every scenario in the brief (correct order, missing item, wrong item, extra item,
wrong quantity, multiple identical products, visually similar products, ambiguous
photograph), captured by at least two people so lighting/angle varies.

Label independently, the way the real 50-unit held-out set for this challenge is
described as being labeled: by a human who did not build the agent, ideally two
humans with disagreements adjudicated - not by asking the model what it thinks the
answer "should" be.
