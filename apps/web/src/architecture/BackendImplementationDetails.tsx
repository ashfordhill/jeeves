import { builtinRegistry } from "@jeeves/registry";
import {
  type Architecture,
  type BackendImplementation,
  backendImplementationRequirements,
  backendImplementationTargetSchema,
  contractKey,
  type DesignDocument,
  implementationKey,
  matchBackendImplementations,
} from "@jeeves/spec";
import { Button, MultiSelect, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import "./backend-implementation.css";

export function BackendImplementationSummary({
  design,
  component,
  target,
  binding,
}: {
  design: DesignDocument;
  component?: string;
  target?: string;
  binding?: string;
}) {
  const report = matchBackendImplementations(design, builtinRegistry());
  if (!report.enabled) return <p>No typed backend implementation review is selected.</p>;
  const operationIds = new Set(
    design.architecture?.backend?.operations
      ?.filter((o) => o.target.owner.id === component)
      .map((o) => o.id),
  );
  const rows = report.obligations.filter((o) =>
    target
      ? o.obligation.id === target || (!!binding && o.binding === binding)
      : !component || o.obligation.id === component || operationIds.has(o.obligation.id),
  );
  return (
    <section
      className="backend-implementation-support"
      aria-label="Declared implementation support"
    >
      <p>
        <strong>Declared implementation support</strong>
      </p>
      <p>
        Foundation: {report.foundationReady ? "ready with declared seams" : "blocked"} · Full
        support: {report.fullReady ? "declared" : "blocked"}. Observed verification is recorded
        separately.
      </p>
      {rows.map((o) => (
        <details key={implementationKey(o.obligation)}>
          <summary>
            {o.name} · {o.obligation.kind} · {o.status}
          </summary>
          <p>{o.template ? `${o.template} / ${o.capability}` : "No selected implementation"}</p>
          <ul>
            {o.reasons.map((r) => (
              <li key={`${r.code}-${r.path ?? ""}-${r.message}`}>{r.message}</li>
            ))}
          </ul>
          {o.hooks.map((h) => (
            <p key={h.slot}>
              Hook {h.slot}: {h.hook ?? "selection required"} ·{" "}
              {h.ready
                ? "typed seam declared; implementation pending"
                : "pending compatible selection"}
            </p>
          ))}
          {o.evidencePackIds.length ? (
            <p>
              Expected evidence packs: {o.evidencePackIds.join(", ")}. These are declarations, not
              observed passes.
            </p>
          ) : null}
        </details>
      ))}
    </section>
  );
}

/** Same atomic Review draft and conflict handling; no code, runtime or opaque option editor. */
export function BackendImplementationEditor({
  design,
  draft,
  onChange,
}: {
  design: DesignDocument;
  draft: Architecture;
  onChange: (a: Architecture) => void;
}) {
  const current = { ...design, architecture: draft },
    registry = builtinRegistry();
  const requirements = backendImplementationRequirements(current);
  const targets = requirements.filter((r) =>
    ["container", "component", "operation", "connection", "component-relationship"].includes(
      r.ref.kind,
    ),
  );
  const [targetKey, setTargetKey] = useState(targets[0] ? implementationKey(targets[0].ref) : "");
  const target = targets.find((r) => implementationKey(r.ref) === targetKey);
  const bindings = draft.backend?.implementations ?? [];
  const binding = bindings.find((v) => implementationKey(v.target) === targetKey);
  const choices = registry.list().flatMap((m) =>
    (m.capabilities ?? [])
      .filter((c) => target && c.targets.includes(target.ref.kind as (typeof c.targets)[number]))
      .map((c) => ({
        value: `${contractKey(m)}/${contractKey(c)}`,
        label: `${m.displayName} ${m.version} · ${c.name} ${c.version}`,
        template: { id: m.id, version: m.version },
        capability: { id: c.id, version: c.version },
      })),
  );
  const value = binding
    ? `${contractKey(binding.template)}/${contractKey(binding.capability)}`
    : "";
  const descriptor =
    binding &&
    registry
      .get(binding.template)
      ?.capabilities?.find((c) => contractKey(c) === contractKey(binding.capability));
  const update = (next: BackendImplementation | undefined) => {
    if (!draft.backend) return;
    onChange({
      ...draft,
      backend: {
        ...draft.backend,
        implementations: [
          ...bindings.filter((v) => implementationKey(v.target) !== targetKey),
          ...(next ? [next] : []),
        ],
      },
    });
  };
  if (!draft.backend)
    return (
      <Text>
        Implementation support is available for the versioned typed backend model. Design review and
        recorded evidence remain separate.
      </Text>
    );
  return (
    <Stack className="backend-implementation-editor" gap="sm">
      <Text size="sm">
        Select a responsibility and its exact registered descriptor. Architecture families remain
        design choices. Descriptor support and observed verification remain separate.
      </Text>
      <NativeSelect
        label="Implementation target"
        value={targetKey}
        data={[
          { value: "", label: "Select an exact target" },
          ...targets.map((r) => ({
            value: implementationKey(r.ref),
            label: `${r.name} · ${r.ref.kind}`,
          })),
        ]}
        onChange={(e) => setTargetKey(e.currentTarget.value)}
      />
      {target ? (
        <>
          <NativeSelect
            label="Registered implementation"
            value={value}
            data={[
              { value: "", label: "No selected implementation" },
              ...(!choices.some((v) => v.value === value) && binding
                ? [{ value, label: `Unavailable selection · ${value}` }]
                : []),
              ...choices,
            ]}
            onChange={(e) => {
              const choice = choices.find((c) => c.value === e.currentTarget.value);
              update(
                choice
                  ? {
                      id: binding?.id ?? `impl-${crypto.randomUUID().slice(0, 8)}`,
                      version: binding?.version ?? "v1",
                      name: binding?.name ?? `${target.name} implementation`,
                      target: backendImplementationTargetSchema.parse(target.ref),
                      template: choice.template,
                      capability: choice.capability,
                      obligations: [],
                      hooks: [],
                    }
                  : undefined,
              );
            }}
          />
          {!choices.length ? (
            <Text size="sm">
              No registered capability descriptors are available for this target. It remains
              unsupported.
            </Text>
          ) : null}
          {binding ? (
            <>
              <TextInput
                label="Implementation selection name"
                value={binding.name}
                maxLength={120}
                onChange={(e) => update({ ...binding, name: e.currentTarget.value })}
              />
              <NativeSelect
                label="Implementation transaction store"
                value={binding.store ?? ""}
                data={[
                  { value: "", label: "No selected store" },
                  ...design.elements.map((e) => ({ value: e.id, label: e.name })),
                ]}
                onChange={(e) => update({ ...binding, store: e.currentTarget.value || undefined })}
              />
              <MultiSelect
                label="Exact supplied obligations"
                value={binding.obligations.map(implementationKey)}
                data={requirements
                  .filter((r) => implementationKey(r.ref) !== targetKey)
                  .map((r) => ({
                    value: implementationKey(r.ref),
                    label: `${r.name} · ${implementationKey(r.ref)}`,
                  }))}
                onChange={(values) =>
                  update({
                    ...binding,
                    obligations: requirements
                      .filter((r) => values.includes(implementationKey(r.ref)))
                      .map((r) => r.ref),
                  })
                }
                searchable
              />
              {descriptor?.hooks.map((slot) => (
                <NativeSelect
                  key={slot.id}
                  label={`Typed hook · ${slot.id}`}
                  value={
                    binding.hooks
                      .filter((h) => h.slot === slot.id)
                      .map((h) => contractKey(h.hook))[0] ?? ""
                  }
                  data={[
                    { value: "", label: "Pending explicit hook" },
                    ...(draft.backend?.hooks ?? []).map((h) => ({
                      value: contractKey(h),
                      label: `${h.name} ${h.version}`,
                    })),
                  ]}
                  onChange={(e) => {
                    const hook = draft.backend?.hooks?.find(
                      (h) => contractKey(h) === e.currentTarget.value,
                    );
                    update({
                      ...binding,
                      hooks: [
                        ...binding.hooks.filter((h) => h.slot !== slot.id),
                        ...(hook
                          ? [{ slot: slot.id, hook: { id: hook.id, version: hook.version } }]
                          : []),
                      ],
                    });
                  }}
                />
              ))}
              <details>
                <summary>External adapter environment</summary>
                <Text size="sm">
                  Select registry identities for explicit fixture or production configuration. No
                  credentials are stored here.
                </Text>
                <NativeSelect
                  label="External environment mode"
                  value={binding.environment?.mode ?? ""}
                  data={[
                    { value: "", label: "No external environment" },
                    { value: "fixture", label: "Fixture" },
                    { value: "production", label: "Production" },
                  ]}
                  onChange={(e) =>
                    update({
                      ...binding,
                      environment: e.currentTarget.value
                        ? {
                            ...binding.environment,
                            mode: e.currentTarget.value as "fixture" | "production",
                            adapterBinding: binding.environment?.adapterBinding ?? "",
                            configurationId: binding.environment?.configurationId ?? "",
                          }
                        : undefined,
                    })
                  }
                />
                {binding.environment ? (
                  <>
                    <NativeSelect
                      label="Environment adapter interface binding"
                      value={binding.environment.adapterBinding}
                      data={[
                        { value: "", label: "Select exact adapter binding" },
                        ...(draft.bindings ?? []).map((v) => ({ value: v.id, label: v.name })),
                      ]}
                      onChange={(e) =>
                        binding.environment &&
                        update({
                          ...binding,
                          environment: {
                            ...binding.environment,
                            adapterBinding: e.currentTarget.value,
                          },
                        })
                      }
                    />
                    <TextInput
                      label="Environment configuration registry ID"
                      value={binding.environment.configurationId}
                      maxLength={63}
                      onChange={(e) =>
                        binding.environment &&
                        update({
                          ...binding,
                          environment: {
                            ...binding.environment,
                            configurationId: e.currentTarget.value,
                          },
                        })
                      }
                    />
                    <TextInput
                      label="Environment credential registry ID"
                      description="Optional identity only"
                      value={binding.environment.credentialId ?? ""}
                      maxLength={63}
                      onChange={(e) =>
                        binding.environment &&
                        update({
                          ...binding,
                          environment: {
                            ...binding.environment,
                            credentialId: e.currentTarget.value || undefined,
                          },
                        })
                      }
                    />
                  </>
                ) : null}
              </details>
              <Button variant="default" onClick={() => update(undefined)}>
                Clear implementation selection
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      <BackendImplementationSummary
        design={current}
        target={target?.ref.id}
        binding={binding ? contractKey(binding) : undefined}
      />
      <details>
        <summary>All original obligations ({requirements.length})</summary>
        <BackendImplementationSummary design={current} />
      </details>
      <details>
        <summary>Raw design diagnostics</summary>
        <p>The legacy NEEDS_TEMPLATE findings and generation gate remain in force.</p>
        <ul>
          {matchBackendImplementations(current, registry).rawFindings.map((f) => (
            <li key={`${f.code}-${JSON.stringify(f.target)}-${f.message}`}>
              {f.code}: {f.message}
            </li>
          ))}
        </ul>
      </details>
    </Stack>
  );
}
