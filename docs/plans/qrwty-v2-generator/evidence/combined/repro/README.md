# Reproduce the native review

Run from the Jeeves root at the accepted commit with Node 24.21.0 and pnpm 12.16.1. The helper
copies a fixture into a temporary named checkout path read by the existing integration harness.
It removes that path on exit. The probes use independently owned Docker stacks and remove the
run's stack and private runtime files after saving sanitized observations.

```sh
repro="$PWD/docs/plans/qrwty-v2-generator/evidence/combined/repro"
scratch=$(mktemp -d)

python3 "$repro/prepare-combined.py" field-projects/generator-system/fixtures "$scratch/combined"
gzip -dc "$repro/native-design.json.gz" | cmp - "$scratch/combined/design.json"
gzip -dc "$repro/native-attachments.json.gz" | cmp - "$scratch/combined/attachments.json"
gzip -dc "$repro/native-combined.mts.gz" > "$scratch/native-combined.mts"
bash "$repro/run-native-case.sh" "$scratch/combined" qr-combined-review \
  "$scratch/native-combined.mts" "$scratch/combined-results"
```

The focused older Event counter witness uses the Activity design and the existing publisher and
counter hook bodies. Their two imports use the public API v8. The test checks PostgreSQL and the
broker directly.

```sh
legacy="$scratch/legacy-counter"
activity="$PWD/field-projects/generator-system/fixtures/activity"
mkdir -p "$legacy/owned"
cp "$activity/design.json" "$legacy/design.json"
sed 's|../entry.ts|../../extension-api/index.ts|g' "$activity/owned/submit.ts" > "$legacy/owned/submit.ts"
sed 's|../../runtime/event-counter.ts|../../extension-api/index.ts|g' \
  "$activity/owned/increment.hooks.ts" > "$legacy/owned/increment.hooks.ts"
python3 - "$activity" "$legacy" <<'PY'
import json
from pathlib import Path
import sys

source, target = map(Path, sys.argv[1:])
rows = json.loads((source / "attachments.json").read_bytes())
(target / "attachments.json").write_text(
    json.dumps([row for row in rows if row["module"] != "read-total"], indent=2) + "\n"
)
PY
gzip -dc "$repro/native-legacy-counter.mts.gz" > "$scratch/native-legacy-counter.mts"
bash "$repro/run-native-case.sh" "$legacy" qr-legacy-counter-review \
  "$scratch/native-legacy-counter.mts" "$scratch/legacy-results"
```

The initial and final Studio scripts capture the mouse interaction and project comparisons from
the persistent local projects. The initial script takes the coordinator's r1 seed and committed r4
snapshot from the adjoining scratch directory. The repaired script rereads their permitted r10
result through a fresh Studio on ports 4322/4323 and verifies the repaired manifest digest. The
published editable source and browser ZIP are the inputs for ordinary reproducible export checks.
[Initial inspection script](studio.mts.gz) · [Repaired inspection script](studio-repaired.mts.gz) ·
[Canonical source and ZIP](../README.md#field-build-inputs)
