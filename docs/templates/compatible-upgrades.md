# Reviewed compatible template upgrades

An editable application's same-template version selector opens **Review template upgrade**. The review lists newly available capability choices and retained configuration/attachment/connection IDs. **Upgrade template** saves one semantic edit; Cancel leaves the design intact, and undo/redo restores its prior/next version. Selection, board layout, context/resource identities and implementation notes survive. Generate subsequently applies normal owned-output checks. Neither action deploys or restarts a live application.

The closed catalog currently includes:

| Template | From | To | Newly available |
| --- | --- | --- | --- |
| HTTP service | 0.1.0 | 0.2.0 | Durable events |
| HTTP service | 0.2.0 | 0.3.0 | Local execution policy |
| HTTP service | 0.1.0 | 0.3.0 | Both capabilities |
| Web app | 0.1.0 | 0.2.0 | Resource workspace |

An upgrade does not add the new attachment. The selected preset, resource/command contract or delivery configuration remains an explicit next choice. These paths retain existing application/runtime/contract/Compose output before a new capability is selected; generated provenance and guidance record the selected version. Existing schema-1 documents receive the same lossless canonical schema-2 representation as any other edit, including preserved connection IDs and capability bindings.

Safety is a specific release decision, not an inference from version numbering. Both manifests must be available element templates of the same kind. Current effective configuration and port contracts must match, and existing attachments must fit the destination's slots. Unknown versions, reverse/cross-template paths and changed effective defaults/ports are refused. Same-template version replacement cannot bypass this through `updateElement` or destructive `changeSubtype`. A different template family retains the existing explicit discard review. Design chat receives the same compatible review and exact operation fields; it does not offer an unusable destructive confirmation for a version change.

The operation includes the exact expected source and review revision. Stale reviews fail without mutation; the editor keeps the explanation open, reloads current state when the server reports a conflict, and requires a new review. Existing readiness findings remain visible. This compatibility review is not an application verification result.

Protected recipes require a separately reviewed recipe release upgrade. Detaching a recipe and upgrading in the same operation batch is refused. Editable starter provenance is an origin marker and stays intact through supported upgrades; the released starter snapshot itself never changes. No live qrwty adoption or database migration is included.

`pnpm work run template-upgrade` creates a disposable Inventory starter, generates its original output, applies HTTP 0.2→0.3, checks unchanged runtime/contract/Compose output and private setup, then explicitly adds the local execution policy. It runs template checks and the bounded account/owner/resource/paging/session browser journey, preserves frozen archive hashes and custom content, regenerates, and cleans the isolated project. No implementation-model task is required. Offline checks cover all four catalog paths and refusal boundaries. Expand this catalog only alongside reviewed output/ownership evidence; schema or runtime migrations belong to a separately designed package.
