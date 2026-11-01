import {
  createTargetSchema,
  type DesignDocument,
  suggestArchitectureAnnotations,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  Loader,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import "./targets.css";

export function TargetCreateDialog({ onClose }: { onClose: () => void }) {
  const loaded = useDraw((s) => s.loaded)!;
  const [base] = useState(() => ({ id: loaded.project.id, revision: loaded.design.revision }));
  const [name, setName] = useState(`${loaded.project.name.slice(0, 105)} target`);
  const [recipeMode, setMode] = useState<"protected-copy" | "conceptual-replacement">(
    "protected-copy",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const input = createTargetSchema.safeParse({
    name,
    baseRevision: base.revision,
    recipeMode,
    ...(reason && { reason }),
  });
  const create = async () => {
    if (!input.success || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const project = await api.createTarget(base.id, input.data);
      await useDraw.getState().open(project.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <ConfigurationDialog
      title="Create target from this design"
      size="lg"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={!input.success || busy}
            loading={busy}
            onClick={() => void create()}
          >
            Create target
          </Button>
        </Group>
      }
    >
      <Stack>
        <Text>
          Creates a separate planning workspace with a frozen baseline of {loaded.project.name},
          revision {base.revision}. The saved design is not deployment evidence.
        </Text>
        <Text size="sm">
          Runtime pins, configuration and stable identities are copied. This target has no output
          folder or inherited generation/run history.
        </Text>
        <TextInput
          label="Target name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={120}
        />
        {loaded.design.recipe ? (
          <>
            <NativeSelect
              label="Recipe handling"
              value={recipeMode}
              onChange={(e) => setMode(e.currentTarget.value as typeof recipeMode)}
              data={[
                { value: "protected-copy", label: "Keep protected recipe constraints" },
                {
                  value: "conceptual-replacement",
                  label: "Plan an editable conceptual replacement",
                },
              ]}
            />
            {recipeMode === "conceptual-replacement" ? (
              <>
                <Alert color="blue">
                  This explicit planning action removes the active recipe binding from the target.
                  Its pinned recipe, configuration and constraints remain in the immutable baseline.
                  Generation and runs stay unavailable.
                </Alert>
                <Textarea
                  label="Replacement reason"
                  value={reason}
                  maxLength={1200}
                  onChange={(e) => setReason(e.currentTarget.value)}
                  required
                />
              </>
            ) : (
              <Text size="sm">Protected core contracts remain protected in this copy.</Text>
            )}
          </>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error} Close and reopen to capture a newer source revision.
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
function Snapshot({ design }: { design: DesignDocument }) {
  return (
    <div className="target-snapshot">
      <Text fw={700}>Saved topology · {design.elements.length} containers</Text>
      <ul>
        {design.elements.map((e) => (
          <li key={e.id}>
            <strong>{e.name}</strong> <code>{e.id}</code>
            <p>{e.description || "No responsibility description recorded."}</p>
            <Text size="sm">
              {e.template
                ? `${e.template.id}@${e.template.version}`
                : `Planned: ${e.planned ?? "needs a template"}`}
            </Text>
            {design.architecture?.components
              ?.filter((c) => c.element === e.id)
              .map((c) => (
                <p key={c.id}>
                  {c.name}: {c.responsibility}
                </p>
              ))}
          </li>
        ))}
      </ul>
      <Text fw={700}>Relationships</Text>
      <ul>
        {design.connections.map((c) => (
          <li key={c.id}>
            <code>{c.from.element}</code> → <code>{c.to.element}</code> ·{" "}
            {c.label ?? c.planned?.label ?? c.kind} ·{" "}
            {c.protocol ?? c.planned?.protocol ?? "Protocol not recorded"}
          </li>
        ))}
      </ul>
      <details>
        <summary>Full saved semantic snapshot</summary>
        <pre>{JSON.stringify(design, null, 2)}</pre>
      </details>
    </div>
  );
}
export function TargetComparison({
  initialTab,
  onClose,
}: {
  initialTab: "baseline" | "changes";
  onClose: () => void;
}) {
  const loaded = useDraw((s) => s.loaded)!;
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.targetComparison>>>();
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const request = useRef<
    { key: string; pending: ReturnType<typeof api.targetComparison> } | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    const key = `${loaded.project.id}:${loaded.design.revision}:${refresh}`;
    if (request.current?.key !== key)
      request.current = { key, pending: api.targetComparison(loaded.project.id) };
    request.current.pending.then(
      (r) => {
        if (active) {
          setResult(r);
          setError(undefined);
        }
      },
      (e) => {
        if (active) setError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, [loaded.project.id, loaded.design.revision, refresh]);
  return (
    <ConfigurationDialog
      title="Current and target design"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" onClick={() => setRefresh((v) => v + 1)}>
            Check source drift
          </Button>
          <Button color="cyan.9" onClick={onClose}>
            Edit proposed target
          </Button>
        </Group>
      }
    >
      <Stack>
        {error ? <Alert color="red">{error}</Alert> : null}
        {!result ? (
          <Loader />
        ) : (
          <>
            <Text>
              Baseline: {result.origin.sourceProjectName} · revision {result.origin.sourceRevision}.
              Proposed target: {loaded.project.name} · revision {result.revision}.
            </Text>
            <Alert color={result.source?.drift.length ? "orange" : "blue"}>
              {!result.source
                ? "Source deleted. The frozen baseline is retained."
                : result.source.drift.length
                  ? `Source drift: ${result.source.drift.length} semantic changes since the captured baseline (source revision ${result.source.revision}).`
                  : result.source.revisionChanged
                    ? `Source revision changed to ${result.source.revision}; its semantics match the baseline.`
                    : "Source still matches the captured baseline."}{" "}
              The baseline is never refreshed automatically.
            </Alert>
            <Text size="sm">
              These are saved design facts. Neither snapshot proves deployment. This target has no
              inherited verification evidence or output ownership.
            </Text>
            {result.origin.recipeMode === "conceptual-replacement" ? (
              <Alert color="blue">
                Conceptual replacement: {result.origin.reason}. Original recipe retained in the
                baseline.
              </Alert>
            ) : null}
            <Tabs defaultValue={initialTab} keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="baseline">Current baseline</Tabs.Tab>
                <Tabs.Tab value="proposed">Proposed target</Tabs.Tab>
                <Tabs.Tab value="changes">Changes ({result.changes.length})</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="baseline" pt="md">
                <Snapshot design={result.origin.baseline} />
              </Tabs.Panel>
              <Tabs.Panel value="proposed" pt="md">
                <Snapshot design={result.proposed} />
              </Tabs.Panel>
              <Tabs.Panel value="changes" pt="md">
                <Text>Proposed changes relative to the frozen baseline</Text>
                {!result.changes.length ? (
                  <Text>No semantic changes.</Text>
                ) : (
                  result.changes.map((change) => (
                    <details className="target-change" key={change.path}>
                      <summary>
                        {change.kind} · {change.path}
                      </summary>
                      <Text fw={700}>Baseline</Text>
                      <pre>{JSON.stringify(change.before ?? null, null, 2)}</pre>
                      <Text fw={700}>Proposed</Text>
                      <pre>{JSON.stringify(change.after ?? null, null, 2)}</pre>
                    </details>
                  ))
                )}
                {result.source?.drift.length ? (
                  <>
                    <Text mt="md" fw={700}>
                      Source drift · separate from proposed changes
                    </Text>
                    <ul>
                      {result.source.drift.map((c) => (
                        <li key={c.path}>
                          {c.kind} · {c.path}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </ConfigurationDialog>
  );
}

export function AnnotationDraft({ onClose }: { onClose: () => void }) {
  const loaded = useDraw((s) => s.loaded)!;
  const [baseRevision] = useState(loaded.design.revision);
  const [draft, setDraft] = useState(() =>
    suggestArchitectureAnnotations(loaded.design, loaded.project.name),
  );
  const existing = new Set(loaded.design.architecture?.components?.map((c) => c.id));
  const additions = draft.components?.filter((c) => !existing.has(c.id)) ?? [];
  const newNodes = draft.nodes.filter(
    (n) => n.annotationOrigin && !loaded.design.architecture?.nodes.some((v) => v.id === n.id),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const save = async () => {
    if (busy) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Close and reopen this draft before saving.");
      return;
    }
    setBusy(true);
    const result = await useDraw.getState().edit([{ op: "setArchitecture", architecture: draft }]);
    setBusy(false);
    if (result) onClose();
    else setError("Could not save. Your draft is retained; review the conflict or invalid fields.");
  };
  return (
    <ConfigurationDialog
      title="Suggest responsibility annotations"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={
              busy ||
              (!additions.length && !newNodes.length) ||
              newNodes.some((n) => !n.name.trim()) ||
              additions.some((c) => !c.name.trim())
            }
            loading={busy}
            onClick={() => void save()}
          >
            Save annotations
          </Button>
        </Group>
      }
    >
      <Stack>
        <Text>
          Editable drafts from explicit auth, resource and extension bindings at saved revision{" "}
          {baseRevision}. Names and operation paths do not prove business behavior. Review actual
          roles and cohesive responsibilities.
        </Text>
        {!additions.length && !newNodes.length ? (
          <Text>No ungrouped explicit bindings found.</Text>
        ) : null}
        {draft.nodes
          .filter(
            (n) =>
              n.annotationOrigin && !loaded.design.architecture?.nodes.some((v) => v.id === n.id),
          )
          .map((n) => (
            <TextInput
              key={n.id}
              label="Suggested actor name"
              value={n.name}
              onChange={(e) => {
                const name = e.currentTarget.value;
                setDraft((d) => ({
                  ...d,
                  nodes: d.nodes.map((v) => (v.id === n.id ? { ...v, name } : v)),
                }));
              }}
            />
          ))}
        {additions.map((c) => (
          <fieldset className="target-annotation" key={c.id}>
            <legend>
              {loaded.design.elements.find((e) => e.id === c.element)?.name ?? c.element} ·{" "}
              {c.members[0]?.kind}
            </legend>
            <TextInput
              label="Responsibility name"
              value={c.name}
              maxLength={120}
              onChange={(e) => {
                const name = e.currentTarget.value;
                setDraft((d) => ({
                  ...d,
                  components: d.components!.map((v) => (v.id === c.id ? { ...v, name } : v)),
                }));
              }}
            />
            <Textarea
              label="Responsibility description"
              value={c.responsibility}
              maxLength={240}
              onChange={(e) => {
                const responsibility = e.currentTarget.value;
                setDraft((d) => ({
                  ...d,
                  components: d.components!.map((v) =>
                    v.id === c.id ? { ...v, responsibility } : v,
                  ),
                }));
              }}
            />
            <Text size="sm">
              Source revision {c.annotationOrigin?.revision}:{" "}
              {c.annotationOrigin?.bindings
                .map((b) => `${b.element}/${b.attachment}/${b.kind}${b.ref ? `/${b.ref}` : ""}`)
                .join(", ")}
            </Text>
          </fieldset>
        ))}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
