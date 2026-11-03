import type { BackendAccessPolicy, BackendRecheckSite } from "@jeeves/spec";
export type FixtureFact = "true" | "false" | "unknown";
/** Illustrates finite composition over invented clause facts; no identity, rows or production evaluator. */
export function policyDesignPreview(
  policy: BackendAccessPolicy,
  fixture: {
    context: FixtureFact;
    current: FixtureFact;
    action: string;
    site: BackendRecheckSite;
    projection: string;
    facts: Record<string, FixtureFact>;
  },
) {
  const condition = (when: BackendAccessPolicy["rules"][number]["when"]): FixtureFact => {
    const facts = when.clauses.map((id) => fixture.facts[id] ?? "unknown");
    if (!facts.length) return "unknown";
    if (when.operator === "all")
      return facts.includes("false") ? "false" : facts.includes("unknown") ? "unknown" : "true";
    return facts.includes("true") ? "true" : facts.includes("unknown") ? "unknown" : "false";
  };
  const rules = policy.rules
    .filter((r) => r.actions.includes(fixture.action))
    .map((r) => ({ id: r.id, effect: r.effect, match: condition(r.when) }));
  const deny = rules.some((r) => r.effect === "deny" && r.match === "true");
  const allow = rules.some((r) => r.effect === "allow" && r.match === "true");
  const uncertainDeny = rules.some((r) => r.effect === "deny" && r.match === "unknown");
  const possibleAllow = rules.some((r) => r.effect === "allow" && r.match === "unknown");
  const gates = [
    fixture.context,
    fixture.current,
    policy.revocation.recheck.includes(fixture.site) ? "true" : "false",
  ];
  const verdict =
    gates.includes("false") || deny || (!allow && !possibleAllow)
      ? "deny"
      : gates.includes("unknown") || uncertainDeny || !allow
        ? "undetermined"
        : "allow";
  const projection = policy.projections.find((p) => p.id === fixture.projection);
  const selectedFields =
    verdict === "allow" &&
    projection &&
    projection.mode === (fixture.site === "write" ? "write" : "read") &&
    condition(projection.when) === "true"
      ? projection.fields
      : [];
  const redacted = (projection?.conditional ?? [])
    .filter(
      (c) => selectedFields.includes(c.field) && !c.allow.some((w) => condition(w) === "true"),
    )
    .map((c) => ({ field: c.field, replacement: c.otherwise }));
  const fields = selectedFields.filter((f) => !redacted.some((c) => c.field === f));
  return {
    redacted,
    verdict,
    rules,
    fields,
    mode: projection?.mode,
    projectionMatch: projection ? condition(projection.when) : "unknown",
  };
}
