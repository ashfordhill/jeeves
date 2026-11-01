import {
  type ArchitectureScenario,
  architectureScenarioSchema,
  type ScenarioRelationship,
  type ScenarioScope,
  type ScenarioStep,
  sameScenarioRelationship,
  sameScenarioScope,
  scenarioPaths,
  scenarioRelationships,
  scenarioReview,
  validateArchitecture,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  Menu,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useViewport } from "@xyflow/react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import "./scenarios.css";
import { ScenarioIntentFields } from "./ScenarioIntentFields.tsx";

type ScenarioControls = {
  scenario?: ArchitectureScenario;
  scenarios: ArchitectureScenario[];
  pathId: string;
  choosePath: (id: string) => void;
  choose: (id?: string) => void;
  edit: () => void;
  create: () => void;
};
const Scenarios = createContext<ScenarioControls | undefined>(undefined);

export function ScenarioProvider({
  scope,
  children,
}: {
  scope?: ScenarioScope;
  children: ReactNode;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const [selected, setSelected] = useState<Record<string, string | undefined>>({});
  const [pathId, choosePath] = useState("main");
  const [draft, setDraft] = useState<ArchitectureScenario>();
  const key = `${loaded.project.id}:${scope?.level}:${scope?.level === "components" ? scope.container : ""}`;
  const scenarios = (loaded.design.architecture?.scenarios ?? []).filter(
    (scenario) => scope && sameScenarioScope(scope, scenario.scope),
  );
  const scenario = scenarios.find((item) => item.id === selected[key]);
  const choose = (id?: string) => {
    setSelected((current) => ({ ...current, [key]: id }));
    choosePath("main");
  };
  return (
    <Scenarios.Provider
      value={
        scope
          ? {
              scenario,
              pathId,
              choosePath,
              scenarios,
              choose,
              edit: () => scenario && setDraft(structuredClone(scenario)),
              create: () =>
                setDraft({
                  id: `scenario-${crypto.randomUUID().slice(0, 8)}`,
                  name: "New scenario",
                  scope,
                  steps: [],
                }),
            }
          : undefined
      }
    >
      {children}
      {draft ? (
        <ScenarioEditor
          key={draft.id}
          initial={draft}
          onClose={() => setDraft(undefined)}
          onSaved={choose}
        />
      ) : null}
    </Scenarios.Provider>
  );
}

/** Used by the C2 editor menu and the C3 diagram menu. */
export function ScenarioMenuItems() {
  const controls = useContext(Scenarios);
  if (!controls) return null;
  return (
    <>
      <Menu.Divider />
      <Menu.Label>Dynamic scenarios</Menu.Label>
      <Menu.Item onClick={() => controls.choose()} disabled={!controls.scenario}>
        Hide scenario
      </Menu.Item>
      {controls.scenarios.map((scenario) => (
        <Menu.Item key={scenario.id} onClick={() => controls.choose(scenario.id)}>
          {scenario.name}
        </Menu.Item>
      ))}
      <Menu.Item onClick={controls.create}>Add scenario</Menu.Item>
      <Menu.Item disabled={!controls.scenario} onClick={controls.edit}>
        Edit scenario
      </Menu.Item>
    </>
  );
}

export function ScenarioNumbers({ relationship }: { relationship?: ScenarioRelationship }) {
  const controls = useContext(Scenarios);
  const scenario = controls?.scenario;
  const { zoom } = useViewport();
  if (!scenario || !relationship) return null;
  const steps =
    scenarioPaths(scenario).find((p) => p.id === controls?.pathId)?.steps ?? scenario.steps;
  const numbers = steps.flatMap((step, index) =>
    sameScenarioRelationship(step.relationship, relationship) ? [index + 1] : [],
  );
  return numbers.length ? (
    <span
      className="scenario-numbers"
      title={`Scenario steps ${numbers.join(", ")}`}
      style={{ fontSize: 12 / zoom, lineHeight: `${16 / zoom}px`, top: -9 / zoom }}
    >
      {numbers.join(", ")}
    </span>
  ) : null;
}

export function ScenarioPanel() {
  const controls = useContext(Scenarios);
  const design = useDraw((state) => state.loaded)!.design;
  if (!controls?.scenario) return null;
  const review = scenarioReview(design, controls.scenario);
  const path =
    scenarioPaths(controls.scenario).find((p) => p.id === controls.pathId) ??
    scenarioPaths(controls.scenario)[0]!;
  return (
    <aside key={controls.scenario.id} className="scenario-panel" aria-label="Scenario steps">
      <span className="scenario-eyebrow">Dynamic scenario</span>
      <h2>{controls.scenario.name}</h2>
      <details className="scenario-expectations">
        <summary>Actor and interaction convention</summary>
        <p>
          Numbers order interactions over existing relationships. Responses and continuations
          preserve the static dependency direction.
        </p>
        <p>
          Actor:{" "}
          {design.architecture?.nodes.find((n) => n.id === controls.scenario!.actor)?.name ??
            "Unspecified"}
          . {controls.scenario.startCondition ?? "Start condition unspecified."}
        </p>
      </details>
      {(controls.scenario.alternatives?.length ?? 0) > 0 ? (
        <NativeSelect
          label="Scenario path"
          value={path.id}
          data={scenarioPaths(controls.scenario).map((p) => ({ value: p.id, label: p.name }))}
          onChange={(e) => controls.choosePath(e.currentTarget.value)}
        />
      ) : null}
      {path.condition !== undefined ? (
        <p>
          {path.kind}: {path.condition} (branches after main step{" "}
          {controls.scenario.steps.findIndex((s) => s.id === path.afterStep) + 1})
        </p>
      ) : null}
      <ol>
        {path.steps.map((step) => (
          <li key={step.id}>
            {step.text}
            {step.phase || step.binding || step.client ? (
              <small className="scenario-step-detail">
                {step.phase ?? "Interaction"}
                {step.binding
                  ? ` · ${design.architecture?.bindings?.find((b) => b.id === step.binding)?.name ?? step.binding}`
                  : ""}
                {step.client
                  ? ` · ${design.architecture?.components?.find((c) => c.id === step.client?.component)?.name}: ${step.client.state}`
                  : ""}
              </small>
            ) : null}
          </li>
        ))}
      </ol>
      <details className="scenario-expectations">
        <summary>Acceptance expectations · {review.status}</summary>
        <p>Authored intent; no test result.</p>
        {review.incomplete.map((message) => (
          <p key={message}>{message}</p>
        ))}
        {path.outcomes.map((id) => {
          const o = controls.scenario!.outcomes?.find((v) => v.id === id);
          return o ? (
            <div key={id}>
              <p>{o.text}</p>
              {o.invariants.map((text) => (
                <p key={text}>Invariant: {text}</p>
              ))}
              {o.requirements.map((id) => (
                <p key={id}>
                  Requirement:{" "}
                  {design.architecture?.reviewRequirements?.find((v) => v.id === id)?.name}
                </p>
              ))}
              {o.decisions.map((id) => (
                <p key={id}>
                  Decision: {design.architecture?.decisions?.find((v) => v.id === id)?.name}
                </p>
              ))}
            </div>
          ) : null;
        })}
      </details>
      <Group gap="xs">
        <Button size="xs" variant="default" onClick={controls.edit}>
          Edit scenario
        </Button>
        <Button size="xs" variant="subtle" color="var(--ink)" onClick={() => controls.choose()}>
          Hide scenario
        </Button>
      </Group>
    </aside>
  );
}

function ScenarioEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ArchitectureScenario;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const [design] = useState(loaded.design);
  const [draft, setDraft] = useState(initial);
  const [pathId, choosePath] = useState("main");
  const alternative = draft.alternatives?.find((p) => p.id === pathId);
  const steps = alternative?.steps ?? draft.steps;
  const changeSteps = (steps: ScenarioStep[]) =>
    setDraft(
      alternative
        ? {
            ...draft,
            alternatives: draft.alternatives?.map((p) => (p.id === pathId ? { ...p, steps } : p)),
          }
        : { ...draft, steps },
    );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const architecture = design.architecture ?? {
    system: { name: loaded.project.name, description: "" },
    nodes: [],
    relationships: [],
  };
  const existing = architecture.scenarios?.some((scenario) => scenario.id === draft.id);
  const scope = draft.scope;
  const choices = scenarioRelationships(design, scope);
  const token = (ref: ScenarioRelationship) => `${ref.kind}:${ref.id}`;
  const parsed = architectureScenarioSchema.safeParse(draft);
  const next = {
    ...architecture,
    scenarios: [...(architecture.scenarios ?? []).filter((item) => item.id !== draft.id), draft],
  };
  const problems = parsed.success
    ? validateArchitecture({ ...design, architecture: next }).filter(
        (finding) => finding.target.path?.[1] === "scenarios",
      )
    : [];
  const save = async (remove = false) => {
    if (saving) return;
    if (useDraw.getState().loaded?.design.revision !== design.revision) {
      setError(
        "The design changed. Cancel and reopen to review the current relationships. Your draft is retained here.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "setArchitecture",
        architecture: remove
          ? {
              ...architecture,
              scenarios: architecture.scenarios?.filter((item) => item.id !== draft.id),
            }
          : next,
      },
    ]);
    setSaving(false);
    if (ok) {
      onSaved(remove ? undefined : draft.id);
      onClose();
    } else
      setError(
        useDraw.getState().loaded?.design.revision !== design.revision
          ? "The design changed. Your draft is retained. Cancel and reopen to review the current relationships, contracts and expectations."
          : (useDraw.getState().notice?.message ?? "Could not save scenario."),
      );
  };
  const move = (index: number, delta: number) => {
    const next = [...steps];
    const step = next.splice(index, 1)[0]!;
    next.splice(index + delta, 0, step);
    changeSteps(next);
  };
  return (
    <ConfigurationDialog
      title="Edit scenario"
      size="lg"
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <Stack gap="xs">
          {error ? (
            <Alert className="scenario-error" color="red" role="alert">
              {error}
            </Alert>
          ) : problems.length ? (
            <Alert className="scenario-error" color="red" role="alert">
              {problems.map((f) => f.message).join(" ")}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="scenario-save-action"
              color="cyan.9"
              loading={saving}
              disabled={!parsed.success || problems.length > 0}
              onClick={() => void save()}
            >
              Save scenario
            </Button>
          </Group>
        </Stack>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          Scope:{" "}
          {scope.level === "containers"
            ? "Containers"
            : `Components of ${design.elements.find((element) => element.id === scope.container)?.name}`}
          . Steps describe existing relationships and do not create runtime behavior.
        </Text>
        <TextInput
          label="Scenario name"
          required
          maxLength={120}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
        />
        <ScenarioIntentFields
          design={design}
          draft={draft}
          change={setDraft}
          pathId={pathId}
          choosePath={choosePath}
          canReview={parsed.success && problems.length === 0}
        />
        {steps.map((step, index) => (
          <fieldset className="scenario-step-editor" key={step.id}>
            <legend>Step {index + 1}</legend>
            <NativeSelect
              label={`Step ${index + 1} relationship`}
              value={token(step.relationship)}
              data={choices.map((choice) => ({
                value: token(choice.relationship),
                label: choice.label,
              }))}
              onChange={(event) => {
                const choice = choices.find(
                  (choice) => token(choice.relationship) === event.currentTarget.value,
                );
                if (choice)
                  changeSteps(
                    steps.map((item, position) =>
                      position === index
                        ? {
                            ...item,
                            relationship: choice.relationship,
                            binding: undefined,
                            client: undefined,
                          }
                        : item,
                    ),
                  );
              }}
            />
            <Textarea
              autosize
              minRows={2}
              maxRows={5}
              label={`Step ${index + 1} text`}
              required
              maxLength={240}
              value={step.text}
              onChange={(event) =>
                changeSteps(
                  steps.map((item, position) =>
                    position === index ? { ...item, text: event.currentTarget.value } : item,
                  ),
                )
              }
            />
            <details className="scenario-expectations">
              <summary>Operation and client state</summary>
              <Stack gap="sm" mt="sm">
                <NativeSelect
                  label={`Step ${index + 1} phase`}
                  value={step.phase ?? ""}
                  data={[
                    { value: "", label: "Unspecified" },
                    "request",
                    "response",
                    "continuation",
                  ]}
                  onChange={(e) =>
                    changeSteps(
                      steps.map((v) =>
                        v.id === step.id
                          ? {
                              ...v,
                              phase: (e.currentTarget.value as ScenarioStep["phase"]) || undefined,
                            }
                          : v,
                      ),
                    )
                  }
                />
                <NativeSelect
                  label={`Step ${index + 1} binding`}
                  value={step.binding ?? ""}
                  data={[
                    { value: "", label: "Unspecified" },
                    ...(design.architecture?.bindings ?? [])
                      .filter(
                        (b) =>
                          b.relationship.id === step.relationship.id &&
                          b.relationship.kind ===
                            (step.relationship.kind === "componentRelationship"
                              ? "component-relationship"
                              : step.relationship.kind),
                      )
                      .map((b) => ({
                        value: b.id,
                        label: `${b.name} · ${b.contract.id}@${b.contract.version}${b.operation ? ` / ${b.operation}` : ""}`,
                      })),
                  ]}
                  onChange={(e) =>
                    changeSteps(
                      steps.map((v) =>
                        v.id === step.id
                          ? { ...v, binding: e.currentTarget.value || undefined, client: undefined }
                          : v,
                      ),
                    )
                  }
                />
                <NativeSelect
                  label={`Step ${index + 1} client feature`}
                  value={step.client?.component ?? ""}
                  data={[
                    { value: "", label: "No client state" },
                    ...(design.architecture?.components ?? [])
                      .filter((c) => {
                        const b = design.architecture?.bindings?.find((b) => b.id === step.binding);
                        return (
                          c.capability === "screen-group" &&
                          [b?.provided, b?.required].some((id) => {
                            const owner = design.architecture?.interfaces?.find(
                              (i) => i.id === id,
                            )?.owner;
                            return owner?.kind === "component" && owner.id === c.id;
                          })
                        );
                      })
                      .map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  onChange={(e) =>
                    changeSteps(
                      steps.map((v) =>
                        v.id === step.id
                          ? {
                              ...v,
                              client: e.currentTarget.value
                                ? { component: e.currentTarget.value, state: "loading" }
                                : undefined,
                            }
                          : v,
                      ),
                    )
                  }
                />
                {step.client ? (
                  <NativeSelect
                    label={`Step ${index + 1} visible state`}
                    value={step.client.state}
                    data={["loading", "success", "denied", "failed"]}
                    onChange={(e) =>
                      changeSteps(
                        steps.map((v) =>
                          v.id === step.id
                            ? {
                                ...v,
                                client: {
                                  ...step.client!,
                                  state: e.currentTarget.value as NonNullable<
                                    ScenarioStep["client"]
                                  >["state"],
                                },
                              }
                            : v,
                        ),
                      )
                    }
                  />
                ) : null}
              </Stack>
            </details>
            <Group gap="xs" mt="xs">
              <Button
                size="compact-xs"
                variant="default"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Move step {index + 1} up
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              >
                Move step {index + 1} down
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={() => changeSteps(steps.filter((_, position) => position !== index))}
              >
                Remove step {index + 1}
              </Button>
            </Group>
          </fieldset>
        ))}
        {!choices.length ? (
          <Text size="sm">Add a relationship in this scope before adding scenario steps.</Text>
        ) : null}
        <Button
          variant="default"
          disabled={!choices.length || steps.length >= 50}
          onClick={() => {
            const choice = choices[0];
            if (choice)
              changeSteps([
                ...steps,
                {
                  id: `step-${crypto.randomUUID().slice(0, 8)}`,
                  relationship: choice.relationship,
                  text: "",
                },
              ]);
          }}
        >
          Add step
        </Button>
        {existing ? (
          <Button variant="subtle" color="red" disabled={saving} onClick={() => void save(true)}>
            Remove scenario
          </Button>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
