# AR Grocery Reviewer (prototype project brief)

Status: stub for the user to fill in. Not part of the Jeeves v1 build. Concept source: `~/github/brainstorm/AR Grocery Reviewer/README.md`.

## To fill in

- Device: phone/tablet or glasses
- First journey (capture, recognize, review, prioritize)
- Data sources available
- Elements you expect on the board

## Notes carried over from the earlier plan

These were written during architecture planning. They are background, not decisions.

### AR Grocery Reviewer: separate recognition and field-review reference

The user confirmed that **AR Grocery Reviewer** and the dropshipping storefront are separate examples. The grocery concept concerns field visits to inspect product presence/promotion and prioritize work using value/KPI data, potentially through a phone/tablet or glasses. Sources: [grocery concept](<../../../brainstorm/AR Grocery Reviewer/README.md>), [brainstorm index](../../../brainstorm/README.md). The detailed storefront specification remains in its own repository.

Candidate Slices include product/priority-data ingestion, visit/task management, image capture and storage, recognition adapter, priority calculation, human correction/review, and reporting. Phone/tablet-first versus glasses-first remains a separate product decision. Retailmotus/Trax are context in the concept document; access to their data or APIs is not assumed.

A first software fixture can ingest a consented/reference shelf image and known catalog/priority data, identify candidate products, let a reviewer correct uncertain matches, and record a prioritized task/result. Recognition quality needs labeled datasets, held-out evaluation, latency/cost measures, and field evidence. Deterministic test doubles verify the surrounding system but cannot establish real recognition accuracy. Uncertain matches should remain uncertain rather than becoming fabricated stock counts or priorities.

Reusable capabilities shared with qrwty and the inventory app include device adapters, captured-location metadata where relevant, media handling, operator tasks, and activity history. Dropshipping shares adapter conformance, business rules, and human workflow checkpoints. These applications exercise shared mechanisms while keeping separate domain models and UIs.
