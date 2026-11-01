import {
  type ArchitectureScenario,
  architectureScenarioSchema,
  type ScenarioRelationship,
  type ScenarioScope,
  sameScenarioRelationship,
  sameScenarioScope,
  scenarioRelationships,
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

type ScenarioControls = {
  scenario?: ArchitectureScenario;
  scenarios: ArchitectureScenario[];
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
  const [draft, setDraft] = useState<ArchitectureScenario>();
  const key = `${loaded.project.id}:${scope?.level}:${scope?.level === "components" ? scope.container : ""}`;
  const scenarios = (loaded.design.architecture?.scenarios ?? []).filter(
    (scenario) => scope && sameScenarioScope(scope, scenario.scope),
  );
  const scenario = scenarios.find((item) => item.id === selected[key]);
  const choose = (id?: string) => setSelected((current) => ({ ...current, [key]: id }));
  return (
    <Scenarios.Provider
      value={
        scope
          ? {
              scenario,
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
  const scenario = useContext(Scenarios)?.scenario;
  const { zoom } = useViewport();
  if (!scenario || !relationship) return null;
  const numbers = scenario.steps.flatMap((step, index) =>
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
  if (!controls?.scenario) return null;
  return (
    <aside key={controls.scenario.id} className="scenario-panel" aria-label="Scenario steps">
      <span className="scenario-eyebrow">Dynamic scenario</span>
      <h2>{controls.scenario.name}</h2>
      <p>
        Numbered steps follow existing arrows. Several step numbers on one arrow show its reuse.
      </p>
      <ol>
        {controls.scenario.steps.map((step) => (
          <li key={step.id}>{step.text}</li>
        ))}
      </ol>
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
    } else setError(useDraw.getState().notice?.message ?? "Could not save scenario.");
  };
  const move = (index: number, delta: number) => {
    const steps = [...draft.steps];
    const step = steps.splice(index, 1)[0]!;
    steps.splice(index + delta, 0, step);
    setDraft({ ...draft, steps });
  };
  return (
    <ConfigurationDialog
      title="Edit scenario"
      size="lg"
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            loading={saving}
            disabled={!parsed.success || problems.length > 0}
            onClick={() => void save()}
          >
            Save scenario
          </Button>
        </Group>
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
        {draft.steps.map((step, index) => (
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
                  setDraft({
                    ...draft,
                    steps: draft.steps.map((item, position) =>
                      position === index ? { ...item, relationship: choice.relationship } : item,
                    ),
                  });
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
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item, position) =>
                    position === index ? { ...item, text: event.currentTarget.value } : item,
                  ),
                })
              }
            />
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
                disabled={index === draft.steps.length - 1}
                onClick={() => move(index, 1)}
              >
                Move step {index + 1} down
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={() =>
                  setDraft({
                    ...draft,
                    steps: draft.steps.filter((_, position) => position !== index),
                  })
                }
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
          disabled={!choices.length || draft.steps.length >= 50}
          onClick={() => {
            const choice = choices[0];
            if (choice)
              setDraft({
                ...draft,
                steps: [
                  ...draft.steps,
                  {
                    id: `step-${crypto.randomUUID().slice(0, 8)}`,
                    relationship: choice.relationship,
                    text: "",
                  },
                ],
              });
          }}
        >
          Add step
        </Button>
        {problems.length ? (
          <Alert color="red">{problems.map((finding) => finding.message).join(" ")}</Alert>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        {existing ? (
          <Button variant="subtle" color="red" disabled={saving} onClick={() => void save(true)}>
            Remove scenario
          </Button>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
