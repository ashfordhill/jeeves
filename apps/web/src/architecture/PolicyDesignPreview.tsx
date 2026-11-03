import {
  type BackendAccessPolicy,
  type BackendRecheckSite,
  backendRecheckSiteSchema,
  contractKey,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { Pick } from "./BackendFields.tsx";
import { type FixtureFact, policyDesignPreview } from "./policy-preview.ts";
export function PolicyDesignPreview({ policy: p }: { policy: BackendAccessPolicy }) {
  const [fixture, setFixture] = useState<{
    context: FixtureFact;
    current: FixtureFact;
    action: string;
    site: BackendRecheckSite;
    projection: string;
    facts: Record<string, FixtureFact>;
  }>({
    context: "unknown",
    current: "unknown",
    action: "read",
    site: "read",
    projection: "",
    facts: {},
  });
  const result = policyDesignPreview(p, fixture);
  const fact = (label: string, value: FixtureFact, change: (v: FixtureFact) => void) => (
    <NativeSelect
      label={label}
      value={value}
      data={["unknown", "true", "false"]}
      onChange={(e) => change(e.currentTarget.value as FixtureFact)}
    />
  );
  return (
    <Stack gap="sm">
      <Alert title="Design preview · local synthetic fixture">
        Illustrates rule composition using invented facts for {contractKey(p)}. No credentials,
        persisted rows or production authorization are evaluated. This fixture is local, unsaved and
        never runtime evidence.
      </Alert>
      <Group>
        <Button
          variant="default"
          onClick={() =>
            setFixture({
              ...fixture,
              context: "true",
              current: "true",
              facts: Object.fromEntries(p.clauses.map((c) => [c.id, "true"])),
            })
          }
        >
          Assume all clauses true
        </Button>
        <Button
          variant="default"
          onClick={() =>
            setFixture({ ...fixture, context: "unknown", current: "unknown", facts: {} })
          }
        >
          Reset fixture
        </Button>
      </Group>
      {fact(
        `Assume trusted ${p.context.identity}, matching scope and purpose`,
        fixture.context,
        (context) => setFixture({ ...fixture, context }),
      )}
      {fact(
        "Assume current-state revocation rechecked at observation",
        fixture.current,
        (current) => setFixture({ ...fixture, current }),
      )}
      <NativeSelect
        label="Preview recheck site"
        value={fixture.site}
        data={backendRecheckSiteSchema.options}
        onChange={(e) =>
          setFixture({ ...fixture, site: e.currentTarget.value as BackendRecheckSite })
        }
      />
      <Text size="sm">
        Declared recheck:{" "}
        {p.revocation.recheck.includes(fixture.site)
          ? "present"
          : "missing; preview denies at this site"}
        .
      </Text>
      <Pick
        label="Preview action"
        value={fixture.action}
        options={[...new Set(p.rules.flatMap((r) => r.actions))].map((value) => ({
          value,
          label: value,
        }))}
        onChange={(action) => setFixture({ ...fixture, action })}
      />
      <Pick
        label="Preview field projection"
        value={fixture.projection}
        options={p.projections.map((v) => ({ value: v.id, label: `${v.id} · ${v.mode}` }))}
        onChange={(projection) => setFixture({ ...fixture, projection })}
      />
      {p.clauses.map((c) => (
        <div key={c.id}>
          {fact(`Fixture ${c.id} · ${c.kind}`, fixture.facts[c.id] ?? "unknown", (v) =>
            setFixture({ ...fixture, facts: { ...fixture.facts, [c.id]: v } }),
          )}
        </div>
      ))}
      <section aria-label="Design preview result" aria-live="polite" className="policy-group">
        <Text fw={700}>Illustrative decision: {result.verdict}</Text>
        <Text size="sm">
          Default deny. Matching deny wins; unknown facts cannot demonstrate permission.
          Identity/scope/purpose and current-state checks gate every rule.
        </Text>
        {result.rules.map((r) => (
          <Text size="sm" key={r.id}>
            {r.id}: {r.effect} · {r.match}
          </Text>
        ))}
        <Text size="sm">
          Illustrative {result.mode ?? "unselected"} fields: {result.fields.join(", ") || "none"}.
          Projection condition: {result.projectionMatch}. Unknown writes must be rejected.
        </Text>
        <Text size="sm">
          Illustrative redactions:{" "}
          {result.redacted.map((r) => `${r.field} → ${r.replacement}`).join(", ") || "none"}.
        </Text>
      </section>
    </Stack>
  );
}
