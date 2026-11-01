import {
  type ArchitectureProjection,
  architectureHandoffSchema,
  type ArchitectureHandoff as Handoff,
  type HandoffDiagram,
  type HandoffScope,
  handoffJson,
  handoffMarkdown,
  handoffScopeSchema,
} from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { captureHandoffDiagram, handoffSvg } from "./handoff-diagram.ts";
import { useScenarioSnapshot } from "./Scenarios.tsx";
import "./handoff.css";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ArchitectureHandoff({
  projection,
  view,
  onClose,
  diagramRoot = ".editor-canvas-area",
}: {
  projection?: ArchitectureProjection;
  diagramRoot?: string;
  view: string;
  onClose: () => void;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const [base] = useState(loaded);
  const selectedScenario = useScenarioSnapshot();
  const [capturedView] = useState(() => ({
    projection,
    view,
    diagramRoot,
    scenario: projection?.level === "deployment" ? undefined : selectedScenario,
  }));
  const [snapshot, setSnapshot] = useState<Handoff>();
  const [diagram, setDiagram] = useState<HandoffDiagram>();
  const [diagramError, setDiagramError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<string | null>("brief");
  const [scope, setScope] = useState<HandoffScope>(() =>
    structuredClone(
      base.design.architecture?.implementationHandoff ?? {
        description: "",
        partial: false,
        excludedScope: "",
        assignments: [],
      },
    ),
  );
  const [approval, setApproval] = useState("");
  useEffect(() => {
    let active = true;
    api.architectureHandoff(base.project.id, base.design.revision).then(
      (s) => {
        if (active) setSnapshot(architectureHandoffSchema.parse(s));
      },
      (e) => {
        if (active) setError(String(e));
      },
    );
    const root = document.querySelector<HTMLElement>(capturedView.diagramRoot);
    if (root && capturedView.projection)
      captureHandoffDiagram(
        root,
        capturedView.projection,
        capturedView.view,
        capturedView.scenario,
      ).then(
        (d) => {
          if (active) setDiagram(d);
        },
        (e) => {
          if (active) setDiagramError(String(e));
        },
      );
    else setDiagramError("Select a loaded architecture diagram before exporting SVG.");
    return () => {
      active = false;
    };
  }, [base, capturedView]);
  const changed =
    loaded.project.id !== base.project.id || loaded.design.revision !== base.design.revision;
  const savedScope = base.design.architecture?.implementationHandoff;
  const dirty =
    JSON.stringify(scope) !==
    JSON.stringify(
      savedScope ?? { description: "", partial: false, excludedScope: "", assignments: [] },
    );
  const blocked = snapshot?.openItems.some((i) => i.critical) ?? true;
  const bundle = snapshot
    ? architectureHandoffSchema.parse({ ...snapshot, ...(diagram && { diagram }) })
    : undefined;
  const assignable =
    snapshot?.openItems.filter(
      (i) =>
        i.kind === "decision" ||
        i.kind === "objective" ||
        (i.kind === "finding" && /OBJECTIVE/.test(i.message)),
    ) ?? [];
  const assignment = (
    kind: "decision" | "objective" | "finding",
    id: string,
    field: "owner" | "blocks",
    value: string,
  ) => {
    setScope((s) => {
      const found = s.assignments.find((a) => a.id === id && a.kind === kind) ?? {
        kind,
        id,
        owner: "",
        blocks: "",
      };
      return {
        ...s,
        review: undefined,
        assignments: [
          ...s.assignments.filter(
            (a) => a !== s.assignments.find((a) => a.id === id && a.kind === kind),
          ),
          { ...found, [field]: value },
        ],
      };
    });
  };
  const save = async (approve: boolean) => {
    if (changed || useDraw.getState().loaded?.design.revision !== base.design.revision) {
      setError(
        "The design changed. Your scope draft is retained. Cancel and reopen before saving.",
      );
      return;
    }
    const parsed = handoffScopeSchema.safeParse({
      ...scope,
      review:
        approve && snapshot ? { fingerprint: snapshot.designFingerprint, approval } : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setSaving(true);
    const architecture = { ...base.design.architecture!, implementationHandoff: parsed.data };
    const ok = await useDraw.getState().edit([{ op: "setArchitecture", architecture }]);
    setSaving(false);
    if (ok) onClose();
    else setError(useDraw.getState().notice?.message ?? "Could not save review scope.");
  };
  return (
    <ConfigurationDialog
      title="Implementation handoff"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            Close handoff
          </Button>
          <Group>
            <Button
              color="cyan.9"
              disabled={!bundle}
              onClick={() =>
                bundle &&
                download("architecture-handoff.md", handoffMarkdown(bundle), "text/markdown")
              }
            >
              Download Markdown
            </Button>
            <Button
              color="cyan.9"
              disabled={!bundle}
              onClick={() =>
                bundle &&
                download("architecture-handoff.json", handoffJson(bundle), "application/json")
              }
            >
              Download JSON
            </Button>
            <Button
              color="cyan.9"
              disabled={!diagram || !snapshot}
              onClick={() =>
                diagram &&
                snapshot &&
                download(
                  "architecture-diagram.svg",
                  handoffSvg(diagram, snapshot.designFingerprint),
                  "image/svg+xml",
                )
              }
            >
              Download SVG
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack className="handoff-content">
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        {changed ? (
          <Alert color="orange" role="status">
            Captured revision {base.design.revision} is stale. Reopen to capture the current design;
            downloads retain this captured revision.
          </Alert>
        ) : null}
        {!snapshot && !error ? <Loader aria-label="Capturing review snapshot" /> : null}
        {snapshot ? (
          <>
            <Group>
              <Badge
                color={snapshot.status === "Ready for implementation review" ? "teal.9" : "#8a3a0a"}
              >
                {snapshot.status}
              </Badge>
              <Text size="sm">
                Revision {snapshot.project.revision} · {snapshot.designFingerprint.slice(0, 16)}
              </Text>
            </Group>
            <Text size="sm">{snapshot.limitation}</Text>
            <Tabs color="cyan.9" value={tab} onChange={setTab}>
              <Tabs.List>
                <Tabs.Tab value="brief">Brief and gaps</Tabs.Tab>
                <Tabs.Tab value="coverage">Coverage</Tabs.Tab>
                <Tabs.Tab value="scope">Scope and approval</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="brief">
                <Stack gap="sm">
                  <Text fw={700}>{snapshot.intent.system.name}</Text>
                  <Text>{snapshot.intent.system.description}</Text>
                  <Text>
                    {snapshot.containers.length} containers ·{" "}
                    {snapshot.intent.components?.length ?? 0} responsibilities ·{" "}
                    {snapshot.contracts.length} exact contract definitions ·{" "}
                    {snapshot.completeness.boundRequired}/{snapshot.completeness.required} required
                    interfaces bound
                  </Text>
                  <Text>
                    {snapshot.obligations.length} implementation obligations with contract
                    boundaries and acceptance expectations
                  </Text>
                  <Text fw={700}>Unresolved items</Text>
                  {snapshot.openItems.length ? (
                    snapshot.openItems.map((i) => (
                      <article className="handoff-open" key={`${i.kind}:${i.id}`}>
                        <strong>
                          {i.kind}:{i.id}
                        </strong>
                        <Text size="sm">{i.message}</Text>
                        <Text size="sm">
                          {i.critical
                            ? "Blocks implementation review"
                            : "Assigned outside partial scope"}{" "}
                          · Owner: {i.owner ?? "unassigned"} · Blocks:{" "}
                          {i.blocks ?? "unassigned scope"}
                        </Text>
                      </article>
                    ))
                  ) : (
                    <Text>No unresolved architecture decisions.</Text>
                  )}
                  <Text fw={700}>Portable definitions</Text>
                  {snapshot.manifests.map((m) => (
                    <Text size="sm" key={m.instance}>
                      {m.id}@{m.version}: {m.status}
                    </Text>
                  ))}
                  <Text fw={700}>Selected diagram</Text>
                  {diagram ? (
                    <Text size="sm">
                      {diagram.title} · {diagram.nodes.length} nodes · {diagram.edges.length}{" "}
                      relationships. Layout {diagram.layoutFingerprint.slice(0, 16)}. Camera
                      excluded.
                    </Text>
                  ) : (
                    <Text size="sm">{diagramError ?? "Capturing geometry…"}</Text>
                  )}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="coverage">
                <div className="handoff-table">
                  <table>
                    <caption>
                      Implementation availability; recorded evidence remains separate
                    </caption>
                    <thead>
                      <tr>
                        <th>Responsibility</th>
                        <th>Category</th>
                        <th>Version / boundary</th>
                        <th>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.coverage.map((r) => (
                        <tr key={`${r.id}:${r.category}:${r.boundary}`}>
                          <td>
                            {r.name}
                            <small>{r.id}</small>
                          </td>
                          <td>{r.category}</td>
                          <td>{r.version ?? r.boundary}</td>
                          <td>{r.available ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tabs.Panel>
              <Tabs.Panel value="scope">
                <Stack>
                  <Textarea
                    label="Implementation review scope"
                    value={scope.description}
                    onChange={(e) =>
                      setScope({ ...scope, review: undefined, description: e.currentTarget.value })
                    }
                    autosize
                    minRows={2}
                  />
                  <Checkbox
                    color="cyan.9"
                    label="Review a partial scope"
                    checked={scope.partial}
                    onChange={(e) =>
                      setScope({ ...scope, review: undefined, partial: e.currentTarget.checked })
                    }
                  />
                  {scope.partial ? (
                    <Textarea
                      label="Excluded scope"
                      value={scope.excludedScope}
                      onChange={(e) =>
                        setScope({
                          ...scope,
                          review: undefined,
                          excludedScope: e.currentTarget.value,
                        })
                      }
                    />
                  ) : null}
                  {assignable.map((item) => {
                    const kind = item.kind as "decision" | "objective" | "finding";
                    const a = scope.assignments.find((a) => a.kind === kind && a.id === item.id);
                    return (
                      <fieldset key={`${kind}:${item.id}`}>
                        <legend>{item.id}</legend>
                        <Text size="sm">{item.message}</Text>
                        <TextInput
                          label={`Owner for ${item.id}`}
                          value={a?.owner ?? ""}
                          onChange={(e) =>
                            assignment(kind, item.id, "owner", e.currentTarget.value)
                          }
                        />
                        <Textarea
                          label={`Blocked scope for ${item.id}`}
                          value={a?.blocks ?? ""}
                          onChange={(e) =>
                            assignment(kind, item.id, "blocks", e.currentTarget.value)
                          }
                        />
                      </fieldset>
                    );
                  })}
                  <Button
                    color="cyan.9"
                    disabled={!dirty || saving || changed || !base.design.architecture}
                    onClick={() => void save(false)}
                  >
                    Save scope
                  </Button>
                  <Text size="sm">
                    Save scope and ownership before recording approval. Contract gaps and policy
                    conflicts cannot be deferred with a scope assignment.
                  </Text>
                  <Textarea
                    label="Explicit review approval"
                    description="Name the approved scope and any exclusions; this records architecture agreement, not runtime verification."
                    value={approval}
                    onChange={(e) => setApproval(e.currentTarget.value)}
                  />
                  <Button
                    color="cyan.9"
                    disabled={
                      dirty || blocked || changed || saving || !approval.trim() || !savedScope
                    }
                    onClick={() => void save(true)}
                  >
                    Approve implementation review scope
                  </Button>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
