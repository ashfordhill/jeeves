import "./architecture-library.css";
import {
  type ArchitectureLibraryEntry,
  architecturePatterns,
  contractCanonical,
  libraryOptionChoices,
  noTemplates,
  type PatternRequest,
  patternConfigSchema,
  previewArchitecturePattern,
  previewArchitectureTemplate,
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
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";

export function PatternComposer({
  pattern,
  saved,
  onClose,
  onApplied,
}: {
  pattern: string;
  saved?: ArchitectureLibraryEntry;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [projectId] = useState(() => useDraw.getState().loaded!.project.id);
  const [base] = useState(() => structuredClone(useDraw.getState().loaded!.design));
  const entry = saved
    ? {
        id: saved.id,
        name: saved.metadata.name,
        description: saved.metadata.purpose,
        variants: ["standard"] as const,
      }
    : architecturePatterns.find((p) => p.id === pattern)!;
  const [request, setRequest] = useState<PatternRequest>(() => ({
    pattern,
    version: saved?.version ?? "1.0.0",
    variant: entry.variants[0],
    instanceId: `pat-${crypto.randomUUID().slice(0, 8)}`,
    baseRevision: base.revision,
    config: patternConfigSchema.parse({ name: entry.name.slice(0, 80), channel: "Work items" }),
    roles: {},
    relationships: {},
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [options, setOptions] = useState<Record<string, string>>({});
  const libraryRequest = saved
    ? {
        id: saved.id,
        version: saved.version,
        contentHash: saved.contentHash,
        instanceId: request.instanceId,
        baseRevision: base.revision,
        name: request.config.name,
        roles: request.roles,
        relationships: request.relationships,
        definitions: request.definitions,
        options,
      }
    : undefined;
  const preview =
    saved && libraryRequest
      ? previewArchitectureTemplate(base, saved, libraryRequest, noTemplates)
      : previewArchitecturePattern(base, request, noTemplates);
  const config = <K extends keyof PatternRequest["config"]>(
    key: K,
    value: PatternRequest["config"][K],
  ) => setRequest({ ...request, config: { ...request.config, [key]: value } });
  const save = async () => {
    if (
      useDraw.getState().loaded?.project.id !== projectId ||
      useDraw.getState().loaded?.design.revision !== base.revision
    ) {
      setError(
        "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
      );
      return;
    }
    if (!preview.ok) return;
    setSaving(true);
    let ok = false;
    try {
      if (libraryRequest) {
        const current = await api.previewLibrary(projectId, libraryRequest);
        if (!current.ok) throw new Error(current.errors.concat(current.unfilled).join(" "));
      }
      if (
        useDraw.getState().loaded?.project.id !== projectId ||
        useDraw.getState().loaded?.design.revision !== base.revision
      )
        throw new Error(
          "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
        );
      ok = await useDraw.getState().edit(preview.ops);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
      return;
    }
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
      title={saved ? "Insert architecture template" : "Compose architecture pattern"}
      size="xl"
      onClose={onClose}
      footer={
        <Stack gap="xs">
          {error ? (
            <Alert className="architecture-template-error" color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="architecture-template-primary"
              color="cyan.9"
              disabled={!preview.ok}
              loading={saving}
              onClick={() => void save()}
            >
              {saved ? "Insert template" : "Apply pattern"}
            </Button>
          </Group>
        </Stack>
      }
    >
      <Stack gap="md" className="pattern-composer architecture-library">
        <Group justify="space-between">
          <h3>{entry.name}</h3>
          <Badge variant="light">Architecture only · v{saved?.version ?? "1.0.0"}</Badge>
        </Group>
        <Text size="sm">
          {entry.description} Expansion adds editable C2/C3 declarations in one undoable edit.
          Runtime support and verification remain separate.
        </Text>
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
        {!saved ? (
          <NativeSelect
            label="Contract tenant scope"
            description="Select the access boundary for this composition; system tenancy remains a separate decision."
            value={request.config.tenant}
            data={["Tenant scoped", "Public", "Cross tenant"]}
            onChange={(e) =>
              config("tenant", e.currentTarget.value as PatternRequest["config"]["tenant"])
            }
          />
        ) : null}
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
        {saved?.metadata.exposedOptions.map((option) => (
          <NativeSelect
            key={`${option.role}.${option.field}`}
            label={`${saved.fragment.roles.find((r) => r.id === option.role)?.name}: ${option.field}`}
            data={[...(libraryOptionChoices(saved, option.role, option.field) ?? [])]}
            value={
              options[`${option.role}.${option.field}`] ??
              String(
                saved.fragment.architecture.components?.find((c) => c.id === option.role)?.config[
                  option.field
                ] ?? libraryOptionChoices(saved, option.role, option.field)?.[0],
              )
            }
            onChange={(e) =>
              setOptions({ ...options, [`${option.role}.${option.field}`]: e.currentTarget.value })
            }
          />
        ))}
        {saved ? (
          <details>
            <summary>Shared contract definitions</summary>
            <Text size="sm">
              Required roles retain their exact definition identities. Other definitions are
              independent unless you bind an existing version and shape.
            </Text>
            {saved.fragment.architecture.contracts?.map((c) => (
              <NativeSelect
                key={`${c.id}@${c.version}`}
                label={`${c.name} ${c.version}`}
                value={request.definitions?.[c.id] ?? ""}
                data={[
                  {
                    value: "",
                    label: "Use required role identity, or create an independent definition",
                  },
                  ...(base.architecture?.contracts ?? [])
                    .filter(
                      (other) =>
                        other.version === c.version &&
                        other.kind === c.kind &&
                        !!other.shape &&
                        contractCanonical(other.shape) === contractCanonical(c.shape),
                    )
                    .map((other) => ({
                      value: other.id,
                      label: `${other.name} ${other.version} (${other.id})`,
                    })),
                ]}
                onChange={(e) => {
                  const definitions = { ...request.definitions };
                  if (e.currentTarget.value) definitions[c.id] = e.currentTarget.value;
                  else delete definitions[c.id];
                  setRequest({ ...request, definitions });
                }}
              />
            ))}
          </details>
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
