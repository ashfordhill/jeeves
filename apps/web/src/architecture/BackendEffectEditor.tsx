import {
  type Architecture,
  type BackendEffect,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Checkbox, NativeSelect, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  type BackendNavigation,
  ExactPick,
  missingReference,
  RecoveryFields,
  ReferenceLinks,
} from "./BackendEffectFields.tsx";
import { Count, exact, Many, namedOptions, Pick, RecordHeader } from "./BackendFields.tsx";
import { ValueMappings } from "./BehaviorValueFields.tsx";

export function effectExecution(
  e: BackendEffect,
  execution: BackendEffect["execution"],
): BackendEffect {
  const local = execution === "local",
    external = execution === "external";
  return {
    ...e,
    execution,
    boundary: local ? "before-commit" : external ? "after-commit" : "atomic-intent",
    delivery: {
      ...e.delivery,
      context: local ? "source-transaction-context" : "verified-service-actor-provenance-only",
      recipient: local
        ? "single-target"
        : e.target.kind === "notification"
          ? "each-eligible-recipient"
          : e.delivery.recipient,
      guarantee: local ? "local-atomic" : "at-least-once",
      acknowledgement: local
        ? "same-commit"
        : external
          ? "unknown-is-reconcile"
          : "durable-terminal-result",
      attempts: local ? 1 : 5,
      duplicates: local ? "deduplicated-local-effect" : "possible",
    },
  };
}
export function BackendEffectEditor({
  design,
  draft,
  effect: e,
  onChange,
  navigate,
  sectionRequest,
}: {
  design: DesignDocument;
  draft: Architecture;
  effect: BackendEffect;
  onChange: (v: BackendEffect) => void;
  navigate: BackendNavigation;
  sectionRequest?: { section: string; path?: (string | number)[] };
}) {
  const [section, setSection] = useState("target");
  useEffect(() => {
    if (sectionRequest) setSection(sectionRequest.section);
  }, [sectionRequest]);
  const model = draft.backend,
    target = e.target;
  const source = model?.operations?.find((o) => contractKey(o) === contractKey(e.source));
  const payload = draft.contracts?.find((c) => contractKey(c) === contractKey(e.payload));
  const data = (draft.contracts ?? []).filter((c) => c.kind === "data");
  const events = (draft.contracts ?? []).filter((c) => c.kind === "event");
  const update = (patch: Partial<BackendEffect>) => onChange({ ...e, ...patch });
  const targetOperation =
    "operation" in target
      ? target.operation
      : target.kind === "event"
        ? target.consumer
        : undefined;
  const defaultTarget = (kind: BackendEffect["target"]["kind"]): BackendEffect["target"] => {
    const r = missingReference();
    if (kind === "event") return { kind, contract: r };
    if (kind === "operation") return { kind, operation: r };
    if (kind === "notification") return { kind, operation: r, recipients: r };
    if (kind === "projection") return { kind, dataset: "unselected", query: r };
    if (kind === "hook") return { kind, hook: r };
    return { kind, dataset: "unselected", contract: r };
  };
  return (
    <Stack gap="md">
      <RecordHeader label="Effect" name={e.name} version={e.version} onChange={update} />
      <Text size="xs">
        Effect identity: {contractKey(e)} · {e.boundary}
      </Text>
      <NativeSelect
        label="Effect section"
        value={section}
        data={[
          { value: "target", label: "Source & exact target" },
          { value: "payload", label: "Typed payload mappings" },
          { value: "delivery", label: "Commit, delivery & ordering" },
          { value: "recovery", label: "Failure paths & recovery" },
        ]}
        onChange={(event) => setSection(event.currentTarget.value)}
      />
      {section === "target" ? (
        <>
          <ExactPick
            label="Effect source command"
            value={e.source}
            items={(model?.operations ?? []).filter((o) => o.kind === "command")}
            onChange={(source) => update({ source })}
            onOpen={() => navigate("operations", contractKey(e.source))}
          />
          <Many
            label="Effect committed outcomes"
            value={e.when ?? []}
            options={(source?.outcomes ?? [])
              .filter((o) => o.trigger === "success")
              .map((o) => ({ value: o.outcome, label: o.outcome }))}
            max={20}
            onChange={(when) => update({ when: when.length ? when : undefined })}
          />
          <NativeSelect
            label="Effect target kind"
            data={["event", "operation", "dataset", "projection", "notification", "audit", "hook"]}
            value={target.kind}
            onChange={(event) =>
              update({ target: defaultTarget(event.currentTarget.value as typeof target.kind) })
            }
          />
          {target.kind === "event" ? (
            <>
              <ExactPick
                label="Effect event contract"
                value={target.contract}
                items={events}
                onChange={(contract) =>
                  update({ target: { ...target, contract }, payload: contract })
                }
                onOpen={() => navigate("contracts", contractKey(target.contract))}
              />
              <Checkbox
                label="Select an exact event consumer"
                checked={!!target.consumer}
                onChange={(event) =>
                  update({
                    target: {
                      ...target,
                      consumer: event.currentTarget.checked ? missingReference() : undefined,
                    },
                  })
                }
              />
            </>
          ) : null}
          {targetOperation || target.kind === "operation" || target.kind === "notification" ? (
            <ExactPick
              label="Effect target operation"
              value={targetOperation}
              items={model?.operations ?? []}
              onChange={(operation) => {
                if (target.kind === "event") update({ target: { ...target, consumer: operation } });
                else if (target.kind === "operation" || target.kind === "notification")
                  update({ target: { ...target, operation } });
              }}
              onOpen={() => targetOperation && navigate("operations", contractKey(targetOperation))}
            />
          ) : null}
          {"dataset" in target ? (
            <Pick
              label="Effect dataset"
              value={target.dataset}
              options={(draft.datasets ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(dataset) => {
                const d = draft.datasets?.find((d) => d.id === dataset);
                update({
                  target:
                    "contract" in target
                      ? { ...target, dataset, contract: d?.contract ?? missingReference() }
                      : { ...target, dataset },
                  ...("contract" in target && d ? { payload: d.contract } : {}),
                });
              }}
              onOpen={() => navigate("datasets", target.dataset)}
            />
          ) : null}
          {target.kind === "dataset" || target.kind === "audit" ? (
            <ExactPick
              label="Effect dataset contract"
              value={target.contract}
              items={data}
              onChange={(contract) =>
                update({ target: { ...target, contract }, payload: contract })
              }
              onOpen={() => navigate("contracts", contractKey(target.contract))}
            />
          ) : null}
          {target.kind === "projection" || target.kind === "notification" ? (
            <ExactPick
              label={
                target.kind === "projection" ? "Effect projection query" : "Effect recipient query"
              }
              value={target.kind === "projection" ? target.query : target.recipients}
              items={model?.queries ?? []}
              onChange={(q) =>
                update({
                  target:
                    target.kind === "projection"
                      ? { ...target, query: q }
                      : { ...target, recipients: q },
                })
              }
              onOpen={() =>
                navigate(
                  "queries",
                  contractKey(target.kind === "projection" ? target.query : target.recipients),
                )
              }
            />
          ) : null}
          {target.kind === "hook" ? (
            <ExactPick
              label="Effect target hook"
              value={target.hook}
              items={(model?.hooks ?? []).filter(
                (h) => h.kind === "effectful" && contractKey(h.operation) === contractKey(e.source),
              )}
              onChange={(hook) => {
                const h = model?.hooks?.find((h) => contractKey(h) === contractKey(hook));
                update({
                  target: { ...target, hook },
                  ...(h ? { payload: h.contracts.input } : {}),
                });
              }}
              onOpen={() => navigate("hooks", contractKey(target.hook))}
            />
          ) : null}
          <Pick
            label="Effect C2 relationship binding"
            value={e.relationshipBinding ?? ""}
            options={(draft.bindings ?? []).map((b) => ({
              value: b.id,
              label: `${b.id} · ${b.role} · ${contractKey(b.contract)} / ${b.operation ?? "event"}`,
            }))}
            onChange={(relationshipBinding) =>
              update({ relationshipBinding: relationshipBinding || undefined })
            }
          />
          {e.relationshipBinding ? (
            <Text size="sm">
              Exact binding {e.relationshipBinding} retains source/target owners, direction and
              contract. A protocol label supplies no wiring.
            </Text>
          ) : null}
        </>
      ) : null}
      {section === "payload" ? (
        <>
          <ExactPick
            label="Effect payload contract"
            value={e.payload}
            items={target.kind === "event" ? events : data}
            onChange={(payload) => update({ payload })}
            onOpen={() => navigate("contracts", contractKey(e.payload))}
          />
          <ValueMappings
            label="Effect value"
            rows={e.values}
            max={40}
            options={(payload?.shape?.payload ?? []).map((f) => ({
              value: f.id,
              label: `${f.name} · ${f.type}${f.required ? " · required" : ""}`,
            }))}
            onChange={(values) => update({ values })}
            context={{ design, draft, operation: source, before: source?.actions.length, navigate }}
          />
        </>
      ) : null}
      {section === "delivery" ? (
        <>
          <NativeSelect
            label="Effect execution"
            data={["local", "durable-intent", "external"]}
            value={e.execution}
            onChange={(event) =>
              onChange(effectExecution(e, event.currentTarget.value as typeof e.execution))
            }
          />
          <Text size="sm">
            Boundary: {e.boundary}. Local intent shares the source store, connection and commit.
            Durable intent persists with state and receipt. External work runs after commit.
          </Text>
          <Checkbox
            label="Effect is required"
            checked={e.required}
            onChange={(event) =>
              update({
                required: event.currentTarget.checked,
                loss: event.currentTarget.checked
                  ? { kind: "forbidden" }
                  : { kind: "permitted", reason: "" },
              })
            }
          />
          {e.loss.kind === "permitted" ? (
            <Textarea
              label="Optional effect loss reason"
              value={e.loss.reason}
              maxLength={1200}
              onChange={(event) =>
                update({ loss: { kind: "permitted", reason: event.currentTarget.value } })
              }
            />
          ) : (
            <Text size="sm">Loss is forbidden.</Text>
          )}
          <Many
            label="Effect runs after"
            value={e.after.map(contractKey)}
            options={namedOptions(
              (model?.effects ?? []).filter(
                (v) =>
                  contractKey(v) !== contractKey(e) &&
                  contractKey(v.source) === contractKey(e.source),
              ),
            )}
            max={20}
            onChange={(keys) =>
              update({
                after: keys.flatMap((key) => {
                  const v = model?.effects?.find((v) => contractKey(v) === key);
                  return v ? [exact(v)] : [];
                }),
              })
            }
          />
          <ReferenceLinks
            label="Predecessor effect"
            refs={e.after}
            items={model?.effects ?? []}
            kind="effects"
            navigate={navigate}
          />
          <Text size="sm">
            Identity: operation version + trusted scope + source command + effect + recipient.
            Current policy is rechecked before each effect. Context: {e.delivery.context}.
            Exhaustion is operator-visible.
          </Text>
          <NativeSelect
            label="Delivery recipient"
            value={e.delivery.recipient}
            data={["single-target", "each-eligible-recipient"]}
            onChange={(event) =>
              update({
                delivery: {
                  ...e.delivery,
                  recipient: event.currentTarget.value as typeof e.delivery.recipient,
                },
              })
            }
          />
          <NativeSelect
            label="Delivery guarantee"
            value={e.delivery.guarantee}
            data={["local-atomic", "at-least-once", "best-effort"]}
            onChange={(event) =>
              update({
                delivery: {
                  ...e.delivery,
                  guarantee: event.currentTarget.value as typeof e.delivery.guarantee,
                },
              })
            }
          />
          <NativeSelect
            label="Delivery acknowledgement"
            value={e.delivery.acknowledgement}
            data={["same-commit", "durable-terminal-result", "unknown-is-reconcile"]}
            onChange={(event) =>
              update({
                delivery: {
                  ...e.delivery,
                  acknowledgement: event.currentTarget.value as typeof e.delivery.acknowledgement,
                },
              })
            }
          />
          <NativeSelect
            label="Delivery duplicate policy"
            value={e.delivery.duplicates}
            data={["deduplicated-local-effect", "destination-key", "possible"]}
            onChange={(event) =>
              update({
                delivery: {
                  ...e.delivery,
                  duplicates: event.currentTarget.value as typeof e.delivery.duplicates,
                },
              })
            }
          />
          <Count
            label="Delivery maximum attempts"
            value={e.delivery.attempts}
            min={1}
            max={100}
            onChange={(attempts) => update({ delivery: { ...e.delivery, attempts } })}
          />
          <Count
            label="Delivery backoff (seconds)"
            value={e.delivery.backoffSeconds}
            max={86400}
            onChange={(backoffSeconds) => update({ delivery: { ...e.delivery, backoffSeconds } })}
          />
          <Count
            label="Delivery timeout (seconds)"
            value={e.delivery.timeoutSeconds}
            min={1}
            max={3600}
            onChange={(timeoutSeconds) => update({ delivery: { ...e.delivery, timeoutSeconds } })}
          />
          <Text size="sm">
            A stable identity does not promise exactly-once external delivery. Required external
            work needs preceding atomic intent; unresolved recovery remains a Review gap.
          </Text>
        </>
      ) : null}
      {section === "recovery" ? (
        <RecoveryFields
          draft={draft}
          rows={e.recovery}
          operation={e.source}
          focusTrigger={String(sectionRequest?.path?.[1] ?? "")}
          navigate={navigate}
          onChange={(recovery) => update({ recovery })}
        />
      ) : null}
    </Stack>
  );
}
