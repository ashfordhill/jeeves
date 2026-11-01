import { type ArchitectureScenario, type DesignDocument, scenarioReview } from "@jeeves/spec";
import {
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

export const scenarioId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export function ScenarioIntentFields({
  design,
  draft,
  change,
  pathId,
  choosePath,
  canReview,
}: {
  design: DesignDocument;
  draft: ArchitectureScenario;
  change: (draft: ArchitectureScenario) => void;
  pathId: string;
  choosePath: (id: string) => void;
  canReview: boolean;
}) {
  const alternative = draft.alternatives?.find((p) => p.id === pathId);
  const review = scenarioReview(design, draft);
  const patchPath = (patch: Partial<NonNullable<ArchitectureScenario["alternatives"]>[number]>) =>
    change({
      ...draft,
      alternatives: draft.alternatives?.map((p) => (p.id === pathId ? { ...p, ...patch } : p)),
    });
  return (
    <Stack gap="sm">
      <NativeSelect
        label="Scenario actor"
        value={draft.actor ?? ""}
        data={[
          { value: "", label: "Unspecified" },
          ...(design.architecture?.nodes ?? []).map((n) => ({ value: n.id, label: n.name })),
        ]}
        onChange={(e) => change({ ...draft, actor: e.currentTarget.value || undefined })}
      />
      <Textarea
        label="Start condition"
        value={draft.startCondition ?? ""}
        maxLength={1200}
        onChange={(e) => change({ ...draft, startCondition: e.currentTarget.value || undefined })}
      />
      <details className="scenario-expectations">
        <summary>Expected outcomes and invariants ({draft.outcomes?.length ?? 0})</summary>
        <Stack gap="sm" mt="sm">
          <Text size="sm">
            These are authored acceptance expectations. Review records design agreement, never a
            test result.
          </Text>
          {(draft.outcomes ?? []).map((o, index) => {
            const patch = (value: Partial<typeof o>) =>
              change({
                ...draft,
                outcomes: draft.outcomes?.map((v) => (v.id === o.id ? { ...v, ...value } : v)),
              });
            return (
              <fieldset className="scenario-step-editor" key={o.id}>
                <legend>Outcome {index + 1}</legend>
                <Stack gap="sm">
                  <Textarea
                    label={`Outcome ${index + 1} expectation`}
                    value={o.text}
                    maxLength={1200}
                    onChange={(e) => patch({ text: e.currentTarget.value })}
                  />
                  <Textarea
                    label={`Outcome ${index + 1} invariants`}
                    description="One invariant per line, up to 20."
                    value={o.invariants.join("\n")}
                    onChange={(e) =>
                      patch({
                        invariants: e.currentTarget.value ? e.currentTarget.value.split("\n") : [],
                      })
                    }
                  />
                  <MultiSelect
                    searchable
                    label={`Outcome ${index + 1} requirements`}
                    value={o.requirements}
                    data={(design.architecture?.reviewRequirements ?? []).map((v) => ({
                      value: v.id,
                      label: v.name,
                    }))}
                    onChange={(requirements) => patch({ requirements })}
                  />
                  <MultiSelect
                    searchable
                    label={`Outcome ${index + 1} decisions`}
                    value={o.decisions}
                    data={(design.architecture?.decisions ?? []).map((v) => ({
                      value: v.id,
                      label: `${v.name} (${v.status})`,
                    }))}
                    onChange={(decisions) => patch({ decisions })}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() =>
                      change({
                        ...draft,
                        outcomes: draft.outcomes?.filter((v) => v.id !== o.id),
                        mainOutcomes: draft.mainOutcomes?.filter((id) => id !== o.id),
                        alternatives: draft.alternatives?.map((p) => ({
                          ...p,
                          outcomes: p.outcomes.filter((id) => id !== o.id),
                        })),
                      })
                    }
                  >
                    Remove outcome {index + 1}
                  </Button>
                </Stack>
              </fieldset>
            );
          })}
          <Button
            variant="default"
            disabled={(draft.outcomes?.length ?? 0) >= 30}
            onClick={() =>
              change({
                ...draft,
                outcomes: [
                  ...(draft.outcomes ?? []),
                  {
                    id: scenarioId("outcome"),
                    text: "",
                    invariants: [],
                    requirements: [],
                    decisions: [],
                  },
                ],
              })
            }
          >
            Add expected outcome
          </Button>
        </Stack>
      </details>
      <NativeSelect
        label="Editing path"
        value={pathId}
        data={[
          { value: "main", label: "Main path" },
          ...(draft.alternatives ?? []).map((p) => ({
            value: p.id,
            label: p.name || "Unnamed alternative",
          })),
        ]}
        onChange={(e) => choosePath(e.currentTarget.value)}
      />
      <Button
        variant="default"
        disabled={!draft.steps.length || (draft.alternatives?.length ?? 0) >= 12}
        onClick={() => {
          const id = scenarioId("path");
          change({
            ...draft,
            alternatives: [
              ...(draft.alternatives ?? []),
              {
                id,
                name: "New alternative",
                kind: "alternative",
                condition: "",
                afterStep: draft.steps[0]!.id,
                steps: [],
                outcomes: [],
              },
            ],
          });
          choosePath(id);
        }}
      >
        Add alternative path
      </Button>
      {alternative ? (
        <>
          <TextInput
            label="Path name"
            value={alternative.name}
            maxLength={120}
            onChange={(e) => patchPath({ name: e.currentTarget.value })}
          />
          <NativeSelect
            label="Path kind"
            data={["alternative", "failure"]}
            value={alternative.kind}
            onChange={(e) =>
              patchPath({ kind: e.currentTarget.value as "alternative" | "failure" })
            }
          />
          <Textarea
            label="Path condition"
            value={alternative.condition}
            maxLength={1200}
            onChange={(e) => patchPath({ condition: e.currentTarget.value })}
          />
          <NativeSelect
            label="Branches after main step"
            value={alternative.afterStep}
            data={draft.steps.map((s, i) => ({
              value: s.id,
              label: `${i + 1}. ${s.text || "Untitled step"}`,
            }))}
            onChange={(e) => patchPath({ afterStep: e.currentTarget.value })}
          />
          <Button
            variant="default"
            onClick={() => {
              change({
                ...draft,
                alternatives: draft.alternatives?.filter((p) => p.id !== pathId),
              });
              choosePath("main");
            }}
          >
            Remove alternative path
          </Button>
        </>
      ) : null}
      <MultiSelect
        searchable
        label="Path expected outcomes"
        value={alternative?.outcomes ?? draft.mainOutcomes ?? []}
        data={(draft.outcomes ?? []).map((o, i) => ({
          value: o.id,
          label: `${i + 1}. ${o.text || "Untitled expectation"}`,
        }))}
        onChange={(outcomes) =>
          alternative ? patchPath({ outcomes }) : change({ ...draft, mainOutcomes: outcomes })
        }
      />
      <Group justify="space-between">
        <Text size="sm">Expectation review: {review.status}</Text>
        <Button
          size="xs"
          variant="default"
          disabled={!canReview || review.incomplete.length > 0}
          onClick={() => change({ ...draft, review: { fingerprint: review.fingerprint } })}
        >
          Record expectation review
        </Button>
      </Group>
      {review.incomplete.length ? <Text size="sm">{review.incomplete.join(" ")}</Text> : null}
    </Stack>
  );
}
