import {
  type Architecture,
  type ArchitectureComponent,
  architectureSchema,
  type BackendEffect,
  type BackendHook,
  contractKey,
  type DesignDocument,
  isStructural,
  validateBackendEffects,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { BackendEffectEditor, effectExecution } from "./BackendEffectEditor.tsx";
import {
  type BackendNavigation,
  type BackendNavigationRequest,
  missingReference,
} from "./BackendEffectFields.tsx";
import { dataId, exact, namedOptions, Pick } from "./BackendFields.tsx";
import { BackendHookEditor, hookProtected } from "./BackendHookEditor.tsx";

export function effectSection(path: (string | number)[] = []) {
  const field = String(path[0] ?? "");
  return field === "recovery"
    ? "recovery"
    : field === "values" || field === "payload"
      ? "payload"
      : field === "after" || field === "delivery" || field === "execution"
        ? "delivery"
        : "target";
}
export function hookSection(path: (string | number)[] = []) {
  const field = String(path[0] ?? "");
  return field === "recovery"
    ? "recovery"
    : field === "failure" || field === "unavailable"
      ? "failure"
      : field === "dependencies" ||
          field === "repositories" ||
          field === "services" ||
          field === "allowedWrites" ||
          field === "allowedEffects"
        ? "dependencies"
        : field === "acceptance" || field === "seam"
          ? "acceptance"
          : "signature";
}
export function ComponentEffectsEditor({
  design,
  draft,
  component,
  onChange,
  navigate,
  navigation,
}: {
  design: DesignDocument;
  draft: Architecture;
  component: ArchitectureComponent;
  onChange: (a: Architecture) => void;
  navigate: BackendNavigation;
  navigation?: BackendNavigationRequest;
}) {
  const [section, setSection] = useState("effects");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [sectionRequest, setSectionRequest] = useState<{
    section: string;
    path?: (string | number)[];
  }>();
  const [scenarioOutcome, setScenarioOutcome] = useState("");
  useEffect(() => {
    if (!navigation || !["effects", "hooks", "scenarios"].includes(navigation.kind)) return;
    setSection(navigation.kind);
    setSelection((s) => ({ ...s, [navigation.kind]: navigation.key }));
    setSectionRequest({
      path: navigation.path,
      section:
        navigation.kind === "hooks" ? hookSection(navigation.path) : effectSection(navigation.path),
    });
    if (navigation.kind === "scenarios") setScenarioOutcome(String(navigation.path?.[0] ?? ""));
  }, [navigation]);
  const selected = selection[section] ?? "",
    select = (key: string) => setSelection((s) => ({ ...s, [section]: key }));
  const model = draft.backend ?? { schemaVersion: 1 as const, entities: [], aggregates: [] };
  const update = (patch: Partial<typeof model>) =>
    onChange({ ...draft, backend: { ...model, ...patch } });
  const owned = (o: { kind: string; id: string }) =>
    o.kind === "component" && o.id === component.id;
  const operations = (model.operations ?? []).filter(
    (o) => owned(o.target.owner) && o.kind === "command",
  );
  const effects = (model.effects ?? []).filter(
    (e) =>
      contractKey(e) === selection.effects ||
      operations.some((o) => contractKey(o) === contractKey(e.source)),
  );
  const hooks = (model.hooks ?? []).filter(
    (h) => owned(h.owner) || contractKey(h) === selection.hooks,
  );
  const effect = model.effects?.find((e) => contractKey(e) === selected),
    hook = model.hooks?.find((h) => contractKey(h) === selected);
  const scenario = draft.scenarios?.find((s) => s.id === selected);
  const parsed = architectureSchema.safeParse(draft);
  const gaps = parsed.success
    ? validateBackendEffects({ ...design, architecture: parsed.data }).filter(
        (f) =>
          !isStructural(f) &&
          (effects.some((e) => contractKey(e) === f.target.path?.[3]) ||
            hooks.some((h) => contractKey(h) === f.target.path?.[3])),
      )
    : [];
  const addEffect = () => {
    const o = operations[0];
    if (!o) return;
    const event = draft.contracts?.find((c) => c.kind === "event");
    const next: BackendEffect = effectExecution(
      {
        id: dataId("effect"),
        version: "v1",
        name: "New effect",
        source: exact(o),
        target: { kind: "event", contract: event ? exact(event) : missingReference() },
        payload: event ? exact(event) : missingReference(),
        values: [],
        execution: "durable-intent",
        boundary: "atomic-intent",
        required: true,
        loss: { kind: "forbidden" },
        after: [],
        delivery: {
          identity: "operation-version-scope-command-effect-recipient",
          context: "verified-service-actor-provenance-only",
          recheck: "current-policy-before-effect",
          recipient: "single-target",
          guarantee: "at-least-once",
          acknowledgement: "durable-terminal-result",
          attempts: 5,
          backoffSeconds: 2,
          timeoutSeconds: 30,
          exhausted: "operator-visible",
          duplicates: "possible",
        },
        recovery: [],
      },
      "durable-intent",
    );
    update({ effects: [...(model.effects ?? []), next] });
    select(contractKey(next));
  };
  const addHook = () => {
    const o = operations[0];
    if (!o) return;
    const contract = draft.contracts?.find((c) => c.kind === "data"),
      signature = contract ? exact(contract) : missingReference();
    const outcome = (trigger: string) =>
      o.outcomes.find((v) => v.trigger === trigger)?.outcome ?? "unselected";
    const id = dataId("hook");
    const next: BackendHook = {
      id,
      version: "v1",
      name: "New typed hook",
      operation: exact(o),
      owner: o.target.owner,
      kind: "pure",
      boundary: "before-commit",
      contracts: { input: signature, output: signature, error: signature },
      context: ["authorized-scope", "correlation", "cancellation", "deadline"],
      authority: "current-policy-at-observation",
      dependencies: [],
      repositories: [],
      services: [],
      allowedWrites: [],
      writeMode: "validated-proposals-only",
      allowedEffects: [],
      result: "validate-exact-contract-before-use",
      privateData: "authorized-input-only",
      required: true,
      readiness: "before-mutation",
      timeoutSeconds: Math.min(20, o.cancellation.deadlineSeconds),
      cancellation: "cooperative-no-forced-termination",
      unavailable: { outcome: outcome("unavailable"), status: 503, writes: "none" },
      failure: {
        operation: exact(o),
        scope: "source-transaction",
        error: outcome("failed"),
        invalidResult: outcome("failed"),
        timeout: outcome("failed"),
        cancelled: outcome("cancelled"),
      },
      acceptance: [],
      seam: { file: `src/hooks/${id}-v1.ts`, ownership: "scaffold-once-project-owned" },
      recovery: [],
    };
    update({ hooks: [...(model.hooks ?? []), next] });
    select(contractKey(next));
  };
  return (
    <Stack gap="md" className="component-effects-editor">
      <Text size="sm">
        Effects and typed hooks declare intent, failure boundaries and acceptance obligations. No
        delivery, hook or recovery executes here. All sections share Save component.
      </Text>
      <NativeSelect
        label="Effects section"
        value={section}
        data={[
          { value: "effects", label: "Effects & delivery" },
          { value: "hooks", label: "Typed hooks & project seams" },
          { value: "scenarios", label: "Inspect exact failure scenario" },
        ]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      {section === "effects" ? (
        <>
          <Pick
            label="Effect definition"
            value={selected}
            options={namedOptions(effects)}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={!operations.length || (model.effects?.length ?? 0) >= 100}
            onClick={addEffect}
          >
            Add effect
          </Button>
          {effect ? (
            <>
              <BackendEffectEditor
                key={contractKey(effect)}
                design={design}
                draft={draft}
                effect={effect}
                navigate={navigate}
                sectionRequest={
                  navigation?.kind === "effects" && navigation.key === contractKey(effect)
                    ? sectionRequest
                    : undefined
                }
                onChange={(next) => {
                  update({ effects: model.effects?.map((e) => (e === effect ? next : e)) });
                  select(contractKey(next));
                }}
              />
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  update({ effects: model.effects?.filter((e) => e !== effect) });
                  select("");
                }}
              >
                Remove effect
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {section === "hooks" ? (
        <>
          <Pick
            label="Hook definition"
            value={selected}
            options={namedOptions(hooks)}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={!operations.length || (model.hooks?.length ?? 0) >= 100}
            onClick={addHook}
          >
            Add typed hook
          </Button>
          {hook ? (
            <>
              <BackendHookEditor
                key={contractKey(hook)}
                design={design}
                draft={draft}
                hook={hook}
                navigate={navigate}
                sectionRequest={
                  navigation?.kind === "hooks" && navigation.key === contractKey(hook)
                    ? sectionRequest
                    : undefined
                }
                onChange={(next) => {
                  update({ hooks: model.hooks?.map((h) => (h === hook ? next : h)) });
                  select(contractKey(next));
                }}
              />
              <Group>
                <Button
                  variant="default"
                  disabled={(model.hooks?.length ?? 0) >= 100}
                  onClick={() => {
                    let n = 2;
                    while (model.hooks?.some((h) => h.id === hook.id && h.version === `v${n}`)) n++;
                    const next = {
                      ...structuredClone(hook),
                      version: `v${n}`,
                      seam: { ...hook.seam, file: `src/hooks/${hook.id}-v${n}.ts` },
                    };
                    update({ hooks: [...(model.hooks ?? []), next] });
                    select(contractKey(next));
                  }}
                >
                  Create hook successor
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={hookProtected(design, hook)}
                  onClick={() => {
                    update({ hooks: model.hooks?.filter((h) => h !== hook) });
                    select("");
                  }}
                >
                  Remove hook
                </Button>
              </Group>
            </>
          ) : null}
        </>
      ) : null}
      {section === "scenarios" ? (
        <>
          <Pick
            label="Failure scenario"
            value={selected}
            options={(draft.scenarios ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(key) => {
              select(key);
              setScenarioOutcome("");
            }}
          />
          <Pick
            label="Inspected scenario outcome"
            value={scenarioOutcome}
            options={(scenario?.outcomes ?? []).map((o) => ({
              value: o.id,
              label: `${o.id} · ${o.text}`,
            }))}
            onChange={setScenarioOutcome}
          />
          {scenario ? (
            <section aria-label="Exact failure scenario">
              <Text fw={600}>
                {scenario.name} · {scenario.id} · {scenario.scope.level}
              </Text>
              <Text size="sm">{scenario.startCondition}</Text>
              {(scenario.outcomes ?? [])
                .filter((o) => !scenarioOutcome || o.id === scenarioOutcome)
                .map((o) => (
                  <div key={o.id}>
                    <Text size="sm">
                      {o.id}: {o.text}
                    </Text>
                    <Text size="sm">Invariants: {o.invariants.join("; ")}</Text>
                    {(scenario.mainOutcomes ?? []).includes(o.id) ? (
                      <Text size="sm">
                        Main path:{" "}
                        {scenario.steps
                          .map((s) => `${s.relationship.kind} / ${s.relationship.id}: ${s.text}`)
                          .join(" → ") || "No steps declared"}
                      </Text>
                    ) : null}
                    {(scenario.alternatives ?? [])
                      .filter((p) => p.outcomes.includes(o.id))
                      .map((p) => (
                        <Text size="sm" key={p.id}>
                          {p.name} · {p.kind} · {p.condition} · after step {p.afterStep ?? "start"}:{" "}
                          {p.steps.map((s) => `${s.relationship.id}: ${s.text}`).join(" → ") ||
                            "No steps declared"}
                        </Text>
                      ))}
                  </div>
                ))}
              <Text size="sm">
                Inspection uses the shared scenario definition. Design paths are not test results.
                Edit scenario intent through Dynamic scenarios after saving or cancelling this
                component draft.
              </Text>
            </section>
          ) : (
            <Text size="sm">
              The exact scenario is missing or unselected; recovery is unresolved.
            </Text>
          )}
        </>
      ) : null}
      {gaps.length ? (
        <Alert
          title="Unresolved effects & hook decisions"
          color="yellow"
          styles={{ label: { color: "var(--ink)" } }}
        >
          <Stack gap="xs">
            {gaps.map((g, i) => (
              <div key={`${g.target.path?.join("/")}-${g.message}`}>
                <Text size="sm">
                  {g.target.path?.join(" / ")}: {g.message}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() =>
                    navigate(
                      g.target.path?.[2] === "hooks" ? "hooks" : "effects",
                      String(g.target.path?.[3] ?? ""),
                      g.target.path?.slice(4),
                    )
                  }
                >
                  Open effect or hook decision {i + 1}
                </Button>
              </div>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}
