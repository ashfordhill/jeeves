import "./architecture-library.css";
import {
  type ArchitectureLibraryEntry,
  type LibraryMetadata,
  plannedCapability,
} from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Group,
  MultiSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { PatternComposer } from "./PatternComposer.tsx";

export function ArchitectureLibrary({
  onClose,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
}) {
  const [base] = useState(() => structuredClone(useDraw.getState().loaded!));
  const [entries, setEntries] = useState<ArchitectureLibraryEntry[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [identity, setIdentity] = useState({
    id: "my-architecture",
    version: "1.0.0",
    name: "Reusable architecture",
    purpose: "",
  });
  const [entry, setEntry] = useState<ArchitectureLibraryEntry>();
  const [invariantText, setInvariantText] = useState("");
  const [metadata, setMetadata] = useState<LibraryMetadata>();
  const [inserting, setInserting] = useState(false);
  const [nextVersion, setNextVersion] = useState("2.0.0");
  const reload = async () => setEntries(await api.architectureLibrary());
  useEffect(() => {
    void api
      .architectureLibrary()
      .then(setEntries)
      .catch((e: Error) => setError(e.message));
  }, []);
  const select = (value: ArchitectureLibraryEntry) => {
    setEntry(value);
    setMetadata(structuredClone(value.metadata));
    setInvariantText(value.metadata.invariants.join("\n"));
    setError(undefined);
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const saved = await api.changeLibrary(entry!.id, entry!.version, {
      action: "edit",
      draftRevision: entry!.draftRevision,
      metadata: {
        ...metadata!,
        invariants: invariantText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
    select(saved!);
    return saved!;
  };
  if (inserting && entry)
    return (
      <PatternComposer
        pattern={entry.id}
        saved={entry}
        onClose={() => setInserting(false)}
        onApplied={onClose}
      />
    );
  const title = creating
    ? "Save as architecture template"
    : entry
      ? "Review architecture template"
      : "Saved architecture templates";
  return (
    <ConfigurationDialog
      title={title}
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              if (entry || creating) {
                setEntry(undefined);
                setCreating(false);
                setError(undefined);
              } else onBack();
            }}
          >
            Cancel
          </Button>
          {creating ? (
            <Button
              className="architecture-template-primary"
              color="cyan.9"
              loading={busy}
              disabled={!selection.length || !identity.purpose.trim()}
              onClick={() =>
                void run(async () => {
                  const result = await api.saveArchitectureTemplate({
                    ...identity,
                    projectId: base.project.id,
                    baseRevision: base.design.revision,
                    selection: {
                      elements: selection.filter((s) => s.startsWith("e:")).map((s) => s.slice(2)),
                      components: selection
                        .filter((s) => s.startsWith("c:"))
                        .map((s) => s.slice(2)),
                    },
                  });
                  setCreating(false);
                  select(result);
                })
              }
            >
              Save draft
            </Button>
          ) : null}
          {entry?.state === "draft" ? (
            <>
              <Button
                variant="default"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await api.changeLibrary(entry.id, entry.version, {
                      action: "delete",
                      draftRevision: entry.draftRevision,
                    });
                    setEntry(undefined);
                  })
                }
              >
                Delete draft
              </Button>
              <Button
                variant="default"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await save();
                  })
                }
              >
                Save draft
              </Button>
              <Button
                className="architecture-template-primary"
                color="cyan.9"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const saved = await save();
                    select(
                      (await api.changeLibrary(saved.id, saved.version, {
                        action: "publish",
                        draftRevision: saved.draftRevision,
                      }))!,
                    );
                  })
                }
              >
                Publish version
              </Button>
            </>
          ) : null}
          {entry?.state === "published" ? (
            <Button
              className="architecture-template-primary"
              color="cyan.9"
              onClick={() => setInserting(true)}
            >
              Preview insertion
            </Button>
          ) : null}
        </Group>
      }
    >
      <Stack gap="md" className="pattern-composer architecture-library">
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <Text size="sm">
          Architecture only. Published versions expand into editable design intent; implementation
          and verification remain separate.
        </Text>
        {creating ? (
          <>
            <TextInput
              label="Library identity"
              value={identity.id}
              onChange={(e) => setIdentity({ ...identity, id: e.currentTarget.value })}
            />
            <TextInput
              label="Version"
              value={identity.version}
              onChange={(e) => setIdentity({ ...identity, version: e.currentTarget.value })}
            />
            <TextInput
              label="Template name"
              value={identity.name}
              onChange={(e) => setIdentity({ ...identity, name: e.currentTarget.value })}
            />
            <Textarea
              label="Purpose"
              value={identity.purpose}
              onChange={(e) => setIdentity({ ...identity, purpose: e.currentTarget.value })}
            />
            <MultiSelect
              label="Containers and components to copy"
              data={[
                ...base.design.elements.map((e) => ({
                  value: `e:${e.id}`,
                  label: `Container: ${e.name}`,
                })),
                ...(base.design.architecture?.components ?? []).map((c) => ({
                  value: `c:${c.id}`,
                  label: `Component: ${c.name}`,
                })),
              ]}
              value={selection}
              onChange={setSelection}
              searchable
            />
            <Text size="sm">
              A container selection copies its components. Dependencies outside this selection
              become required roles. Runtime attachments, private configuration, output ownership
              and verification are excluded. Runtime-owned responsibilities need portable planned
              contracts before extraction.
            </Text>
          </>
        ) : entry && metadata ? (
          <>
            <Group justify="space-between">
              <Text fw={700}>
                {entry.id} · v{entry.version}
              </Text>
              <Badge variant="light">{entry.state}</Badge>
            </Group>
            <TextInput
              label="Template name"
              readOnly={entry.state !== "draft"}
              value={metadata.name}
              onChange={(e) => setMetadata({ ...metadata, name: e.currentTarget.value })}
            />
            <Textarea
              label="Purpose"
              readOnly={entry.state !== "draft"}
              value={metadata.purpose}
              onChange={(e) => setMetadata({ ...metadata, purpose: e.currentTarget.value })}
            />
            <Textarea
              label="Required invariants (one per line)"
              readOnly={entry.state !== "draft"}
              value={invariantText}
              onChange={(e) => setInvariantText(e.currentTarget.value)}
              autosize
              minRows={3}
            />
            <section aria-label="Compatible hosts and required roles">
              <h3>Compatible hosts and required roles</h3>
              {entry.fragment.roles.map((r) => (
                <div key={r.id}>
                  <Text fw={600}>
                    {r.name} · {r.required ? "Required role" : "Copied role"}
                  </Text>
                  <Text size="sm">
                    {r.purpose} {r.hostRoles.length ? `Hosts: ${r.hostRoles.join(", ")}.` : ""}{" "}
                    {r.host
                      ? `Within ${entry.fragment.roles.find((host) => host.id === r.host)?.name ?? r.host}.`
                      : ""}
                  </Text>
                </div>
              ))}
            </section>
            <section aria-label="Exposed template options">
              <h3>Exposed options</h3>
              <MultiSelect
                label="Finite component options"
                disabled={entry.state !== "draft"}
                data={entry.fragment.roles
                  .filter((r) => !r.required && r.kind === "component")
                  .flatMap((r) => {
                    const c = entry.fragment.architecture.components?.find((c) => c.id === r.id);
                    return (plannedCapability(c?.capability)?.fields ?? [])
                      .filter((f) => f.options)
                      .map((f) => ({ value: `${r.id}.${f.key}`, label: `${r.name}: ${f.label}` }));
                  })}
                value={metadata.exposedOptions.map((o) => `${o.role}.${o.field}`)}
                onChange={(values) =>
                  setMetadata({
                    ...metadata,
                    exposedOptions: values.map((s) => {
                      const [role, field] = s.split(".");
                      return { role: role!, field: field! };
                    }),
                  })
                }
                searchable
              />
            </section>
            <section aria-label="Template extension points">
              <h3>Extension points</h3>
              {metadata.extensionPoints.map((p, i) => (
                <Textarea
                  key={p.role}
                  label={entry.fragment.roles.find((r) => r.id === p.role)?.name ?? p.role}
                  readOnly={entry.state !== "draft"}
                  value={p.description}
                  onChange={(e) =>
                    setMetadata({
                      ...metadata,
                      extensionPoints: metadata.extensionPoints.map((item, index) =>
                        index === i ? { ...item, description: e.currentTarget.value } : item,
                      ),
                    })
                  }
                />
              ))}
            </section>
            <details>
              <summary>Interfaces and policy guarantees</summary>
              {entry.fragment.architecture.interfaces?.map((i) => (
                <Text key={i.id} size="sm">
                  {i.name}: {i.direction} · {i.contract.id}@{i.contract.version}
                </Text>
              ))}
              {entry.fragment.architecture.bindings?.map((b) => (
                <div key={b.id}>
                  <Text fw={600}>{b.name}</Text>
                  <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                    {JSON.stringify(b.policies)}
                  </Text>
                </div>
              ))}
            </details>
            {entry.state !== "draft" ? (
              <>
                <TextInput
                  label="New version"
                  value={nextVersion}
                  onChange={(e) => setNextVersion(e.currentTarget.value)}
                />
                <Group>
                  <Button
                    variant="default"
                    loading={busy}
                    onClick={() =>
                      void run(async () =>
                        select(await api.cloneLibrary(entry.id, entry.version, nextVersion)),
                      )
                    }
                  >
                    Create new draft version
                  </Button>
                  {entry.state === "published" ? (
                    <Button
                      variant="default"
                      loading={busy}
                      onClick={() =>
                        void run(async () =>
                          select(
                            (await api.changeLibrary(entry.id, entry.version, {
                              action: "retire",
                              draftRevision: entry.draftRevision,
                            }))!,
                          ),
                        )
                      }
                    >
                      Retire version
                    </Button>
                  ) : null}
                </Group>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Button variant="default" onClick={() => setCreating(true)}>
              Save as architecture template
            </Button>
            <TextInput
              label="Search saved architecture templates"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            {entries
              .filter((e) =>
                `${e.metadata.name} ${e.metadata.purpose} ${e.id}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((e) => (
                <button
                  key={`${e.id}@${e.version}`}
                  type="button"
                  className="catalog-card"
                  onClick={() => select(e)}
                >
                  <Text fw={700}>
                    {e.metadata.name} · v{e.version}
                  </Text>
                  <Badge variant="light">{e.state} · architecture only</Badge>
                  <Text size="sm">{e.metadata.purpose}</Text>
                </button>
              ))}
            {!entries.length ? <Text size="sm">No saved architecture templates yet.</Text> : null}
          </>
        )}
      </Stack>
    </ConfigurationDialog>
  );
}
