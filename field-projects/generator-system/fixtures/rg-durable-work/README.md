# RG15 durable-work fixture

Backend-only application inputs: diagrams, registered product SQL and scoped handlers. The local
fixture accepts item intent and commits the registered command with fenced completion. The remote
fixture uses distinct caller/callee databases and an actual authenticated generated ServiceTarget;
its callee exports an opaque workload-operation descriptor. The framework protocol works even
when the arbitrary callee stub entrypoint is unwritten. No generated export tree is stored here.

The evidence runner exports both fixtures to scratch, supplies their application-owned SQL and
hooks, runs the actual extension checker and pinned TypeScript, then removes only that scratch
root. Durable input and result DTOs contain no credentials. Secret-result remote checkpoints are
explicitly refused before effect dispatch. Remote recovery supports replicas of one compiled
process identity; cross-role takeover is refused, while local-only work can share logical-owner
state with distinct credentials. Neither fixture implements schedules, webhooks or arbitrary
external providers. The owner-approved authority/recovery decision and mechanism limits are in
`docs/plans/reliable-generation/evidence/rg15/`.
