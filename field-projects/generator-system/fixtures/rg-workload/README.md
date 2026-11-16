# RG09 workload identity fixtures

`workloadDesign()` is a two-service design with one Custom operation in each process and a
workload-only local Identity. No Browser or Sign-in is required. `workloadDesign(true)` adds
independent user guards for the basic verified-bearer forwarding proof. `send.ts` and `receive.ts`
are application-owned bodies copied into scratch exports; the receiver records observations for
the offline HTTP fixtures and offers finite primitive/empty/oversized response cases.

The caller's only offered operation is `receive`, GET or POST at its internal root. The private
callee has no legacy alias. The public-callee unit variant explicitly changes exposure before
assembly to prove normal user routes remain usable. `allowedCallers` narrows the declared maximum.

`withStubWorkloads()` explicitly migrates the active stub-stack test input: its original Stats
caller and Stats search select the same issuer. It adds no business module/operation and leaves
processes-off source separate. The existing wiring fixture's internal call also uses API8.
Actual native two-service/Keycloak proof remains RG14; no generated-system checkpoint runs here.
