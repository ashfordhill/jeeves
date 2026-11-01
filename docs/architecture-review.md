# Architecture review and decisions

P51 adds **Architecture review** in Editor actions and the generation-findings dialog.
Review is computed from the current design revision and returned separately by
`GET /projects/:id/architecture` as `review`. `reviewArchitecture` is shared by the
mouse editor and chat's `getArchitectureReview`. Existing contract/policy summaries
remain available at their original inspectors.

Review findings do not enter `validateDesign` or `blocksGenerate`. Selected contradictions
and unresolved requirements can be saved. Structural errors still reject operation batches;
decisions cannot suppress them. Review completion means the declared architecture has no
outstanding review conflicts, unaccepted findings or explicitly unresolved decisions. It
says nothing about template availability, generated behavior, capacity or security evidence.
A legacy design's supported generated files and ownership remain unchanged.

## Selected inputs and rules

Existing exact-version contracts, required interfaces, relationship policies, datasets and
objectives remain the inputs introduced by P47/P48. P51 groups those findings alongside
optional `architecture.reviewRequirements`. Every finding names its input identities,
assumption, concern, severity and relevant-input fingerprint.

| Requirement | What review checks |
| --- | --- |
| Access | The selected binding's identity and tenant policy agree with the requirement. Private network reachability supplies no identity. Unknown or absent choices remain unresolved. |
| Cache-aside | The selected cache read has a bounded freshness policy; its same application responsibility has a read from a different source (source/cache representations can have separate explicit contracts); cache failure selects Source fallback. A linked write propagates change/disable intent to the same cache contract within the lookup's age bound. No cache→store edge is required. |
| Delivery | A selected trigger has a named internal or external responsibility. Channel delivery additionally identifies a consume binding whose provider belongs to the selected channel and whose consumer is the declared responsibility. Schedule/request delivery requires no queue or consume binding. |
| Failure | The selected binding states the required failure outcome, a timeout bound and observable outcome detail. A contradictory known outcome is a conflict; absence/Unknown is unresolved. |

Bindings retain the exact identity/version and direction rules from P48. Dataset authority,
read/write access, tenant/lifecycle/export choices and scoped objective values/units remain
visible. Structural dangling identities and impossible ownership are rejected by the shared
validator. Review requirements do not infer policy from component counts, duplicate families,
visitors, hosting choice, technology or diagram line style. Synchronous search, personal billing
and asynchronous send followed by a response are valid.

Cache review verifies explicit bindings and declared propagation bounds. It does not inspect
code to prove a miss actually falls back or every mutation invalidates. Channel review verifies
a declared delivery responsibility, without proving handler execution or delivery guarantees.
Unknown domain payload/lifecycle details in architecture examples remain visible; examples
are not edited to manufacture a zero-finding result.

## Decisions and acknowledgements

`architecture.decisions` stores concise records with a stable ID/title, context, decision and
reason, consequence, status (`Unresolved`, `Accepted`, `Superseded`) and linked identities.
A contract link includes its exact version key. Decision and requirement IDs share the design's
identity namespace; references must exist. Historical acknowledgement IDs may remain after a
finding is resolved; their presence supplies no evidence and hides nothing.

**Record tradeoff** captures a finding ID and fingerprint. Only an Accepted decision with the
matching fingerprint and all relevant linked identities acknowledges an unresolved finding.
The finding stays visible with its reason as an accepted scoped tradeoff. Conflicts cannot be
acknowledged away, including exact-contract mismatches and contradictory selected policies.
An explicit Unresolved decision prevents review completion; Superseded records do not.

Fingerprints use a deterministic, non-security digest of canonical relevant inputs. They
include linked requirement/binding/interface/contract data, relevant owner/relationship
identities and selected tenant choices; source contracts include the current authoritative
source shape. Dataset/objective checks include their referenced policy inputs. Decisions,
layout, semantic revision alone and unrelated notes/context prose are excluded. Changes to
relevant inputs make the finding active again. **Review current inputs** updates the captured
fingerprint and restores Unresolved status so acceptance is a deliberate new choice.
These fingerprints are change detectors, not cryptographic signatures or certification.

## Editing and chat

The review dialog groups findings by concern. Open relevant editor selects the exact binding,
interface/contract, dataset/objective or requirement. Cache/delivery findings link to the existing
pattern preview; no advice applies itself. Save/Cancel remain in a fixed footer. Requirement
and decision changes share one validated `setArchitecture` batch, semantic undo/redo, reload
and revision conflict handling. Invalid/conflicting drafts stay open with their text intact.
Save or Cancel a dirty review draft before opening a separate linked editor or pattern.

Chat reads `getArchitectureReview`, then uses the same typed `setArchitecture` operation.
Supplied ordinary planning edits need no additional confirmation. A turn is one undo step.
Review-bearing architecture snapshots refuse generic stale-operation replay: a concurrent
revision saves nothing and requires a fresh read/review. No paid model call is needed to test
this behavior. The [fixture](../fixtures/designs/architecture-review.json), focused suites and
[P51 evidence](evidence/p51/README.md) document the supported boundary.
