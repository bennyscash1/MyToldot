# Add-child flow investigation report

See the attached investigation plan for full code citations. This document summarizes findings and the layout fix applied for tree `71978` (Yuval Banai).

## Root cause (Yuval / second marriage)

- **Database:** Yuval has `PARENT_CHILD` edges from Yossi and Ilana only; second wife (אביבה) has a separate `SPOUSE` to Yossi.
- **Graph:** `buildBipartiteGraph` correctly attaches Yuval to union `u:cmpo0j29100keih4gtgk8vgyf` (Yossi–Ilana).
- **Layout bug:** `enforceCoupleAdjacency` processed childless Yossi–Aviva union after Yossi–Ilana, re-ordering X slots so Yuval shared a column with the second wife while the connector targeted the Ilana union midpoint.

## Fixes applied

1. **`elkLayout.ts`:** Only run couple adjacency forcing for unions with ≥1 child edge; sort processing by child count; re-run `centerLoneChildrenUnderUnions` after final union re-centering.
2. **`currentSpouses.ts`:** `getCurrentSpouseIdsOrdered` — spouses sorted by `start_date` then relationship id (used for add-child co-parent modal and single-spouse auto-pick).

## Add-child flow (unchanged behavior)

- **2+ current spouses:** `PickCoParentModal` → `openAddChildPopover` → `addChild` with `parent2Id`.
- **1 spouse:** auto `parent_ids: [anchor, spouse]`, no modal.
- **Repro “child then second marriage”:** Data correct at create; display fixed by layout pass above.
