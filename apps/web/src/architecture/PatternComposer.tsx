import { builtinRegistry } from "@jeeves/registry";
import {
  architecturePatterns,
  type PatternRequest,
  patternConfigSchema,
  previewArchitecturePattern,
} from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

export function PatternComposer({
  pattern,
  onClose,
  onApplied,
}: {
  pattern: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [base] = useState(() => structuredClone(useDraw.getState().loaded!.design));
  const entry = architecturePatterns.find((p) => p.id === pattern)!;
  const [request, setRequest] = useState<PatternRequest>(() => ({
    pattern,
    version: "1.0.0",
    variant: entry.variants[0],
    instanceId: `pat-${crypto.randomUUID().slice(0, 8)}`,
    baseRevision: base.revision,
    config: patternConfigSchema.parse({ name: entry.name, channel: "Work items" }),
    roles: {},
    relationships: {},
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const preview = previewArchitecturePattern(base, request, builtinRegistry());
  const config = <K extends keyof PatternRequest["config"]>(
    key: K,
    value: PatternRequest["config"][K],
  ) => setRequest({ ...request, config: { ...request.config, [key]: value } });
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== base.revision) {
      setError(
        "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
      );
      return;
    }
    if (!preview.ok) return;
    setSaving(true);
    const ok = await useDraw.getState().edit(preview.ops);
    setSaving(false);
    if (ok) onApplied();
    else
      setError(
        useDraw.getState().notice?.message ??
          "Could not apply pattern. Your draft has been retained.",
      );
  };
  return (
    <ConfigurationDialog
      title="Compose architecture pattern"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={!preview.ok}
            loading={saving}
            onClick={() => void save()}
          >
            Apply pattern
          </Button>
        </Group>
      }
    >
      <Stack gap="md" className="pattern-composer">
        <Group justify="space-between">
          <h3>{entry.name}</h3>
          <Badge variant="light">Design intent · v1.0.0</Badge>
        </Group>
        <Text size="sm">
          {entry.description} Expansion adds editable C2/C3 declarations in one undoable edit.
          Runtime support and verification remain separate.
        </Text>
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <TextInput
          label="Composition name"
          value={request.config.name}
          onChange={(e) => config("name", e.currentTarget.value)}
        />
        {entry.variants.length > 1 ? (
          <NativeSelect
            label="Delivery variant"
            value={request.variant}
            data={[
              { value: "best-effort", label: "Best effort — bounded work loss" },
              {
                value: "transactional-outbox",
                label: "Transactional outbox — atomic domain and event intent",
              },
            ]}
            onChange={(e) =>
              setRequest({
                ...request,
                variant: e.currentTarget.value as PatternRequest["variant"],
                roles: {},
                relationships: {},
              })
            }
          />
        ) : null}
        <NativeSelect
          label="Contract tenant scope"
          description="Select the access boundary for this composition; system tenancy remains a separate decision."
          value={request.config.tenant}
          data={["Tenant scoped", "Public", "Cross tenant"]}
          onChange={(e) =>
            config("tenant", e.currentTarget.value as PatternRequest["config"]["tenant"])
          }
        />
        {pattern === "asynchronous-work-delivery" ? (
          <TextInput
            label="Logical channel name"
            description="Different business channels remain distinct even if they later share a broker."
            value={request.config.channel}
            onChange={(e) => config("channel", e.currentTarget.value)}
          />
        ) : null}
        {pattern === "cached-public-lookup" ? (
          <NumberInput
            label="Maximum stale age (seconds)"
            min={0}
            max={86400}
            allowDecimal={false}
            value={request.config.maxAgeSeconds}
            onChange={(v) => config("maxAgeSeconds", typeof v === "number" ? v : 30)}
          />
        ) : null}
        {request.variant === "best-effort" ? (
          <NumberInput
            label="Maximum loss window (seconds)"
            min={0}
            max={86400}
            allowDecimal={false}
            value={request.config.lossWindowSeconds}
            onChange={(v) => config("lossWindowSeconds", typeof v === "number" ? v : 60)}
          />
        ) : null}
        <section aria-label="Pattern role bindings">
          <h4>Bind responsibilities and boundaries</h4>
          <Stack gap="sm">
            {preview.roles.map((role) => (
              <div key={role.id}>
                <NativeSelect
                  label={role.name}
                  description={role.purpose}
                  value={role.selected ?? "unfilled"}
                  data={[
                    { value: "unfilled", label: "Unfilled — choose a binding" },
                    ...(role.create ? [{ value: "create", label: "Create a fresh instance" }] : []),
                    ...role.candidates.map((c) => ({
                      value: c.id,
                      label: `Reuse ${c.name} (${c.id})`,
                    })),
                  ]}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setRequest({
                      ...request,
                      roles: {
                        ...request.roles,
                        [role.id]:
                          value === "create" || value === "unfilled"
                            ? { mode: value }
                            : { mode: "reuse", id: value },
                      },
                      relationships: {},
                    });
                  }}
                />
                {role.candidates.find((c) => c.id === role.selected) ? (
                  <Text size="xs" mt={4}>
                    {role.candidates.find((c) => c.id === role.selected)!.reason}
                  </Text>
                ) : null}
              </div>
            ))}
          </Stack>
        </section>
        {preview.relationships.some((r) => r.candidates.length) ? (
          <section aria-label="Existing relationship bindings">
            <h4>Reuse existing C2 relationships</h4>
            <Stack>
              {preview.relationships
                .filter((r) => r.candidates.length)
                .map((r) => (
                  <NativeSelect
                    key={r.id}
                    label={r.name}
                    value={request.relationships[r.id] ?? ""}
                    data={[
                      { value: "", label: "Create a planned relationship" },
                      ...r.candidates.map((c) => ({ value: c.id, label: `${c.name} (${c.id})` })),
                    ]}
                    onChange={(e) => {
                      const relationships = { ...request.relationships };
                      if (e.currentTarget.value) relationships[r.id] = e.currentTarget.value;
                      else delete relationships[r.id];
                      setRequest({ ...request, relationships });
                    }}
                  />
                ))}
            </Stack>
          </section>
        ) : null}
        {preview.unfilled.length ? (
          <Alert color="yellow" title="Unfilled required roles">
            {preview.unfilled.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </Alert>
        ) : null}
        {preview.errors.length ? (
          <Alert color="red" title="Resolve before applying" role="alert">
            {preview.errors.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </Alert>
        ) : null}
        <section aria-label="Pattern preview">
          <h4>Preview additions</h4>
          <Text size="sm">
            {preview.fragment?.architecture.components?.length ?? 0} responsibilities,{" "}
            {preview.fragment?.architecture.contracts?.length ?? 0} contracts,{" "}
            {preview.fragment?.architecture.bindings?.length ?? 0} relationship bindings. Reused
            hosts retain their configuration and customizations.
          </Text>
          {preview.additions.length ? (
            <details>
              <summary>Inspect {preview.additions.length} added declarations</summary>
              <ul className="pattern-additions">
                {preview.additions.map((a) => (
                  <li key={`${a.kind}:${a.id}`}>
                    {a.name} <small>({a.kind})</small>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
        <section aria-label="Required pattern guarantees">
          <h4>Required guarantees and open implementation work</h4>
          {preview.fragment?.invariants.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
        <section aria-label="Pattern extension points">
          <h4>Extension points</h4>
          {preview.fragment?.extensionPoints.map((point) => (
            <p key={point.role}>
              <strong>{point.role}:</strong> {point.description}
            </p>
          ))}
        </section>
        {preview.review.length ? (
          <Alert title="Separate design review" color="yellow">
            {preview.review.length} open findings after expansion. Domain payloads, lifecycle
            policies and system choices remain editable design decisions. This does not certify
            runtime behavior.
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
