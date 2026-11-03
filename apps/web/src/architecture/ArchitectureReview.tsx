import {
  type ArchitectureDecision,
  architectureReviewReferences,
  architectureSchema,
  type DesignDocument,
  type ReviewFinding,
  type ReviewReference,
  type ReviewRequirement,
  reviewArchitecture,
} from "@jeeves/spec";
import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import {
  ArchitectureDraftErrors,
  architectureId,
  Choice,
  tenantChoices,
  useArchitectureDraft,
} from "./RelationshipBindings.tsx";
import "./review.css";

export function ArchitectureReview({
  design,
  onClose,
  onEdit,
  onPattern,
}: {
  design: DesignDocument;
  onClose: () => void;
  onEdit: (finding: Pick<ReviewFinding, "editor" | "inputs" | "sourcePath">) => void;
  onPattern: (pattern: string) => void;
}) {
  const { draft, setDraft, saving, error, issues, save } = useArchitectureDraft(design, onClose);
  const [tab, setTab] = useState<string | null>("findings");
  const [requirementId, setRequirementId] = useState(draft.reviewRequirements?.[0]?.id ?? "");
  const [decisionId, setDecisionId] = useState(draft.decisions?.[0]?.id ?? "");
  const parsed = architectureSchema.safeParse(draft);
  const report = reviewArchitecture(
    parsed.success ? { ...design, architecture: parsed.data } : design,
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(design.architecture);
  const requirements = draft.reviewRequirements ?? [];
  const decisions = draft.decisions ?? [];
  const requirement = requirements.find((r) => r.id === requirementId);
  const decision = decisions.find((d) => d.id === decisionId);
  const references = architectureReviewReferences({ ...design, architecture: draft });
  const bindings = [
    { value: "", label: "Unresolved binding" },
    ...(draft.bindings ?? []).map((b) => ({ value: b.id, label: b.name })),
  ];
  const updateRequirement = (next: ReviewRequirement) =>
    setDraft({
      ...draft,
      reviewRequirements: requirements.map((r) => (r.id === next.id ? next : r)),
    });
  const updateDecision = (patch: Partial<ArchitectureDecision>) =>
    setDraft({
      ...draft,
      decisions: decisions.map((d) => (d.id === decisionId ? { ...d, ...patch } : d)),
    });
  const newRequirement = (
    kind: ReviewRequirement["kind"],
    id = architectureId("req"),
  ): ReviewRequirement => {
    const base = { id, name: "New requirement", binding: draft.bindings?.[0]?.id ?? "" };
    if (kind === "access") return { ...base, kind, identity: "Unknown", tenant: "Unknown" };
    if (kind === "failure") return { ...base, kind, outcome: "Unknown" };
    if (kind === "cache") return { ...base, kind };
    return { id, name: "New requirement", kind, trigger: "Unknown" };
  };
  const record = (finding?: ReviewFinding) => {
    const id = architectureId("decision");
    setDraft({
      ...draft,
      decisions: [
        ...decisions,
        {
          id,
          name: finding ? `Review ${finding.code}` : "New decision",
          context: finding?.message ?? "",
          decision: "",
          consequence: "",
          status: "Unresolved",
          links: finding?.inputs ?? [],
          acknowledgements:
            finding && finding.severity !== "conflict"
              ? [{ finding: finding.id, fingerprint: finding.fingerprint }]
              : [],
        },
      ],
    });
    setDecisionId(id);
    setTab("decisions");
  };
  const bindingChoice = (
    label: string,
    value: string | undefined,
    change: (id: string) => void,
  ) => (
    <NativeSelect
      label={label}
      data={bindings}
      value={value ?? ""}
      onChange={(e) => change(e.currentTarget.value)}
    />
  );
  const ownerChoices = [
    ...design.elements.map((e) => ({ kind: "element" as const, id: e.id, name: e.name })),
    ...(draft.components ?? []).map((c) => ({
      kind: "component" as const,
      id: c.id,
      name: c.name,
    })),
    ...draft.nodes
      .filter((n) => n.kind === "external-system")
      .map((n) => ({ kind: "external-system" as const, id: n.id, name: n.name })),
  ];
  return (
    <ConfigurationDialog
      title="Architecture review and decisions"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={issues.length > 0 || !dirty}
            loading={saving}
            onClick={() => void save()}
          >
            Save review
          </Button>
        </Group>
      }
    >
      <Stack className="architecture-review" gap="md">
        <Text size="sm">{report.limitation}</Text>
        <Text fw={700} role="status">
          {!parsed.success
            ? "Draft invalid: resolve field errors"
            : report.complete
              ? "Design review complete"
              : "Design review incomplete"}{" "}
          · revision {design.revision}
        </Text>
        <Text size="sm">
          {report.findings.filter((f) => f.severity === "conflict").length} conflicts ·{" "}
          {report.findings.filter((f) => f.severity === "unresolved" && !f.acceptedBy).length}{" "}
          unresolved findings · {report.findings.filter((f) => f.acceptedBy).length} accepted
          tradeoffs
        </Text>
        {dirty ? (
          <Text size="sm">
            Draft preview. Save or Cancel before opening a linked editor or pattern.
          </Text>
        ) : null}
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="findings">Review findings</Tabs.Tab>
            <Tabs.Tab value="requirements">Requirements</Tabs.Tab>
            <Tabs.Tab value="decisions">Decisions</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="findings" pt="md">
            <Stack>
              {report.structuralFindings.length ? (
                <Text>
                  Structural errors require repair in their editors; decisions cannot suppress them.
                </Text>
              ) : null}
              {!report.findings.length ? (
                <Text>
                  No unmet declared requirements. Undeclared behavior remains outside this review.
                </Text>
              ) : null}
              {[...new Set(report.findings.map((f) => f.concern))].map((concern) => (
                <section key={concern} aria-label={concern}>
                  <h3>{concern}</h3>
                  <Stack>
                    {report.findings
                      .filter((f) => f.concern === concern)
                      .map((f) => (
                        <article key={f.id} className="review-finding" aria-label={f.code}>
                          <Group gap="xs">
                            <Badge
                              variant="outline"
                              style={{ color: "var(--ink)" }}
                              color={
                                f.severity === "conflict" ? "red" : f.acceptedBy ? "teal" : "orange"
                              }
                            >
                              {f.acceptedBy
                                ? "Accepted scoped tradeoff"
                                : f.severity === "conflict"
                                  ? "Conflict"
                                  : "Unresolved"}
                            </Badge>
                            <Text size="xs">{f.code}</Text>
                          </Group>
                          <Text size="sm" fw={600}>
                            {f.message}
                          </Text>
                          <Text size="sm">Assumption: {f.assumption}</Text>
                          <Text size="xs">
                            Inputs:{" "}
                            {f.inputs
                              .map(
                                (r) =>
                                  `${r.kind}: ${references.find((v) => v.kind === r.kind && v.id === r.id)?.name ?? r.id}`,
                              )
                              .join("; ")}
                          </Text>
                          <details>
                            <summary>Relevant input fingerprint</summary>
                            <code>{f.fingerprint}</code>
                          </details>
                          {f.expiredDecisions.length ? (
                            <Text size="sm" fw={600}>
                              Inputs changed. Previous acknowledgement expired.
                            </Text>
                          ) : null}
                          {f.acceptedBy ? (
                            <Text size="sm">
                              Reason: {decisions.find((d) => d.id === f.acceptedBy)?.decision}
                            </Text>
                          ) : null}
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="default"
                              disabled={dirty}
                              onClick={() => {
                                if (f.editor === "requirements") {
                                  setRequirementId(
                                    f.inputs.find((r) => r.kind === "requirement")?.id ?? "",
                                  );
                                  setTab("requirements");
                                } else onEdit(f);
                              }}
                            >
                              Open relevant editor
                            </Button>
                            {f.pattern ? (
                              <Button
                                size="xs"
                                variant="default"
                                disabled={dirty}
                                onClick={() => onPattern(f.pattern!)}
                              >
                                Preview relevant pattern
                              </Button>
                            ) : null}
                            <Button size="xs" variant="default" onClick={() => record(f)}>
                              {f.severity === "conflict"
                                ? "Record unresolved decision"
                                : "Record tradeoff"}
                            </Button>
                          </Group>
                        </article>
                      ))}
                  </Stack>
                </section>
              ))}
              {report.unresolvedDecisions.length ? (
                <Text>
                  Explicit unresolved decisions:{" "}
                  {report.unresolvedDecisions
                    .map((id) => decisions.find((d) => d.id === id)?.name)
                    .join(", ")}
                </Text>
              ) : null}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="requirements" pt="md">
            <Stack>
              <Text size="sm">
                Select only requirements that apply. Unknown choices stay visible. Existing required
                interfaces, dataset policies and objectives are reviewed in their own editors.
              </Text>
              <Group>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    const r = newRequirement("access");
                    setDraft({ ...draft, reviewRequirements: [...requirements, r] });
                    setRequirementId(r.id);
                  }}
                >
                  Add requirement
                </Button>
              </Group>
              <NativeSelect
                label="Selected requirement"
                data={[
                  { value: "", label: "Select requirement" },
                  ...requirements.map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={requirementId}
                onChange={(e) => setRequirementId(e.currentTarget.value)}
              />
              {requirement ? (
                <Stack>
                  <TextInput
                    label="Requirement name"
                    maxLength={120}
                    required
                    value={requirement.name}
                    onChange={(e) =>
                      updateRequirement({ ...requirement, name: e.currentTarget.value })
                    }
                  />
                  <Choice
                    label="Requirement kind"
                    value={requirement.kind}
                    options={["access", "cache", "delivery", "failure"]}
                    onChange={(kind) =>
                      updateRequirement({
                        ...newRequirement(kind as ReviewRequirement["kind"], requirement.id),
                        name: requirement.name,
                      })
                    }
                  />
                  {requirement.kind !== "delivery"
                    ? bindingChoice("Required interaction", requirement.binding, (binding) =>
                        updateRequirement({ ...requirement, binding }),
                      )
                    : null}
                  {requirement.binding ? (
                    <Button
                      variant="default"
                      disabled={dirty}
                      onClick={() =>
                        onEdit({
                          editor: "binding",
                          inputs: [{ kind: "binding", id: requirement.binding! }],
                        })
                      }
                    >
                      Edit interaction policies
                    </Button>
                  ) : null}
                  {requirement.kind === "access" ? (
                    <>
                      <Choice
                        label="Required identity"
                        value={requirement.identity}
                        options={[
                          "Unknown",
                          "Public",
                          "User",
                          "Service",
                          "API key",
                          "Signed callback",
                        ]}
                        onChange={(identity) =>
                          updateRequirement({
                            ...requirement,
                            identity: identity as typeof requirement.identity,
                          })
                        }
                      />
                      <Choice
                        label="Required tenant boundary"
                        value={requirement.tenant}
                        options={tenantChoices}
                        onChange={(tenant) =>
                          updateRequirement({
                            ...requirement,
                            tenant: tenant as typeof requirement.tenant,
                          })
                        }
                      />
                    </>
                  ) : null}
                  {requirement.kind === "failure" ? (
                    <Choice
                      label="Required failure outcome"
                      value={requirement.outcome}
                      options={[
                        "Unknown",
                        "Fail request",
                        "Source fallback",
                        "Serve stale",
                        "Buffer",
                        "Bounded loss",
                      ]}
                      onChange={(outcome) =>
                        updateRequirement({
                          ...requirement,
                          outcome: outcome as typeof requirement.outcome,
                        })
                      }
                    />
                  ) : null}
                  {requirement.kind === "cache" ? (
                    <>
                      {bindingChoice(
                        "Application source fallback",
                        requirement.fallback,
                        (fallback) =>
                          updateRequirement({ ...requirement, fallback: fallback || undefined }),
                      )}
                      {bindingChoice(
                        "Change and disable propagation",
                        requirement.update,
                        (update) =>
                          updateRequirement({ ...requirement, update: update || undefined }),
                      )}
                    </>
                  ) : null}
                  {requirement.kind === "delivery" ? (
                    <>
                      <Choice
                        label="Delivery trigger"
                        value={requirement.trigger}
                        options={["Unknown", "Channel", "Schedule", "Request"]}
                        onChange={(trigger) =>
                          updateRequirement({
                            ...requirement,
                            trigger: trigger as typeof requirement.trigger,
                            channel: undefined,
                            binding: undefined,
                          })
                        }
                      />
                      <NativeSelect
                        label="Delivery responsibility"
                        value={
                          requirement.responsible
                            ? `${requirement.responsible.kind}:${requirement.responsible.id}`
                            : ""
                        }
                        data={[
                          { value: "", label: "Unresolved responsibility" },
                          ...ownerChoices.map((o) => ({
                            value: `${o.kind}:${o.id}`,
                            label: `${o.name} · ${o.kind}`,
                          })),
                        ]}
                        onChange={(e) => {
                          const o = ownerChoices.find(
                            (o) => `${o.kind}:${o.id}` === e.currentTarget.value,
                          );
                          updateRequirement({
                            ...requirement,
                            responsible: o ? { kind: o.kind, id: o.id } : undefined,
                          });
                        }}
                      />
                      {requirement.trigger === "Channel" ? (
                        <>
                          <NativeSelect
                            label="Logical channel"
                            value={requirement.channel ?? ""}
                            data={[
                              { value: "", label: "Unresolved channel" },
                              ...design.elements.map((e) => ({ value: e.id, label: e.name })),
                            ]}
                            onChange={(e) =>
                              updateRequirement({
                                ...requirement,
                                channel: e.currentTarget.value || undefined,
                              })
                            }
                          />
                          {bindingChoice(
                            "Channel consume binding",
                            requirement.binding,
                            (binding) =>
                              updateRequirement({ ...requirement, binding: binding || undefined }),
                          )}
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <Button
                    variant="default"
                    color="red"
                    onClick={() => {
                      setDraft({
                        ...draft,
                        reviewRequirements: requirements.filter((r) => r.id !== requirementId),
                      });
                      setRequirementId("");
                    }}
                  >
                    Remove requirement
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="decisions" pt="md">
            <Stack>
              <Text size="sm">
                Accepted decisions record a reason and consequence for specific inputs. Conflicts
                remain unresolved until repaired; acceptance supplies no implementation evidence.
              </Text>
              <Group>
                <Button size="xs" variant="default" onClick={() => record()}>
                  Add decision
                </Button>
              </Group>
              <NativeSelect
                label="Selected decision"
                data={[
                  { value: "", label: "Select decision" },
                  ...decisions.map((d) => ({ value: d.id, label: `${d.name} · ${d.status}` })),
                ]}
                value={decisionId}
                onChange={(e) => setDecisionId(e.currentTarget.value)}
              />
              {decision ? (
                <Stack>
                  <TextInput
                    label="Decision title"
                    required
                    maxLength={120}
                    value={decision.name}
                    onChange={(e) => updateDecision({ name: e.currentTarget.value })}
                  />
                  <Textarea
                    label="Context"
                    required
                    autosize
                    minRows={2}
                    maxLength={1200}
                    value={decision.context}
                    onChange={(e) => updateDecision({ context: e.currentTarget.value })}
                  />
                  <Textarea
                    label="Decision and reason"
                    required
                    autosize
                    minRows={2}
                    maxLength={1200}
                    value={decision.decision}
                    onChange={(e) => updateDecision({ decision: e.currentTarget.value })}
                  />
                  <Textarea
                    label="Consequence"
                    required
                    autosize
                    minRows={2}
                    maxLength={1200}
                    value={decision.consequence}
                    onChange={(e) => updateDecision({ consequence: e.currentTarget.value })}
                  />
                  <Choice
                    label="Decision status"
                    value={decision.status}
                    options={["Unresolved", "Accepted", "Superseded"]}
                    onChange={(status) =>
                      updateDecision({ status: status as typeof decision.status })
                    }
                  />
                  <MultiSelect
                    label="Linked identities"
                    data={references.map((r) => ({
                      value: `${r.kind}:${r.id}`,
                      label: `${r.name} · ${r.kind}`,
                    }))}
                    value={decision.links.map((r) => `${r.kind}:${r.id}`)}
                    onChange={(values) =>
                      updateDecision({
                        links: values.flatMap((v): ReviewReference[] => {
                          const r = references.find((r) => `${r.kind}:${r.id}` === v);
                          return r ? [{ kind: r.kind, id: r.id }] : [];
                        }),
                      })
                    }
                    searchable
                  />
                  {decision.acknowledgements.map((a) => {
                    const f = report.findings.find((f) => f.id === a.finding);
                    return (
                      <div className="review-finding" key={a.finding}>
                        <Text size="sm">
                          {f?.message ?? "Historical finding no longer present"}
                        </Text>
                        <Text size="xs">Recorded fingerprint: {a.fingerprint}</Text>
                        <Text size="sm">
                          {f && f.fingerprint !== a.fingerprint
                            ? "Inputs changed. Acknowledgement expired."
                            : "Acknowledgement applies only to these inputs."}
                        </Text>
                        {f && f.fingerprint !== a.fingerprint ? (
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() =>
                              updateDecision({
                                status: "Unresolved",
                                acknowledgements: decision.acknowledgements.map((old) =>
                                  old.finding === a.finding
                                    ? { finding: f.id, fingerprint: f.fingerprint }
                                    : old,
                                ),
                              })
                            }
                          >
                            Review current inputs
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  <Button
                    variant="default"
                    color="red"
                    onClick={() => {
                      setDraft({
                        ...draft,
                        decisions: decisions.filter((d) => d.id !== decisionId),
                      });
                      setDecisionId("");
                    }}
                  >
                    Remove decision
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Tabs.Panel>
        </Tabs>
        <ArchitectureDraftErrors error={error} issues={issues} />
      </Stack>
    </ConfigurationDialog>
  );
}
