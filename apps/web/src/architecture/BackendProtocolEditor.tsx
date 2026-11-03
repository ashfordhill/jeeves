import {
  type BackendOperation,
  type BackendProtocolPlan,
  backendProtocolProcedures,
  contractKey,
} from "@jeeves/spec";
import { NativeSelect, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";
import { Count, namedOptions, Pick } from "./BackendFields.tsx";
import { type BehaviorContext, inputPaths, ValueSourceFields } from "./BehaviorValueFields.tsx";

/** The same operation plan is edited in small sections; no code or expression input. */
export function BackendProtocolEditor({
  operation: o,
  ctx,
  onChange,
  onLifecycle,
}: {
  operation: BackendOperation;
  ctx: BehaviorContext;
  onChange: (p: BackendProtocolPlan) => void;
  onLifecycle: (key: string) => void;
}) {
  const p = o.protocol!;
  const [conditionKeys] = useState(() => ({
    preconditions: p.preconditions.map(() => crypto.randomUUID()),
    postconditions: p.postconditions.map(() => crypto.randomUUID()),
  }));
  const [section, setSection] = useState("overview");
  const [recordIndex, setRecordIndex] = useState(0);
  const m = ctx.draft.backend!;
  const change = (patch: Partial<BackendProtocolPlan>) => onChange({ ...p, ...patch });
  const record = p.records[recordIndex];
  const updateRecord = (next: BackendProtocolPlan["records"][number]) =>
    change({ records: p.records.map((r, i) => (i === recordIndex ? next : r)) });
  const inputs = inputPaths(ctx);
  return (
    <Stack gap="sm">
      <NativeSelect
        label="Protocol plan section"
        value={section}
        data={["overview", "inputs", "records", "hook snapshots", "lifecycle dispatch", "outputs"]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      {section === "overview" ? (
        <>
          <NativeSelect
            label="Finite protocol procedure"
            value={p.procedure}
            data={[...backendProtocolProcedures]}
            onChange={(e) => change({ procedure: e.currentTarget.value as typeof p.procedure })}
          />
          <Text size="sm">
            This declares a bounded algorithm. Runtime support and hook implementation remain
            separate requirements.
          </Text>
          <Count
            label="Protocol batch size"
            value={p.limits.batch}
            min={1}
            max={100}
            onChange={(batch) => change({ limits: { ...p.limits, batch } })}
          />
          <Count
            label="Protocol deadline seconds"
            value={p.limits.deadlineSeconds}
            min={1}
            max={3600}
            onChange={(deadlineSeconds) => change({ limits: { ...p.limits, deadlineSeconds } })}
          />
          <Text size="xs">
            Replay: {p.replay} · receipt: {p.receipt} · external boundary: {p.externalIO}
          </Text>
          {(["preconditions", "postconditions"] as const).map((key) => (
            <section key={key} aria-label={`Protocol ${key}`}>
              <Text fw={600}>{key === "preconditions" ? "Preconditions" : "Postconditions"}</Text>
              {p[key].map((value, i) => (
                <Textarea
                  key={conditionKeys[key][i]}
                  label={`${key} ${i + 1}`}
                  value={value}
                  maxLength={1200}
                  autosize
                  minRows={2}
                  maxRows={5}
                  onChange={(e) =>
                    change({ [key]: p[key].map((v, n) => (n === i ? e.currentTarget.value : v)) })
                  }
                />
              ))}
            </section>
          ))}
          <Text size="xs">Fixed acceptance identities: {p.acceptance.join(", ")}</Text>
        </>
      ) : null}
      {section === "inputs"
        ? p.inputs.map((v, i) => (
            <details className="contract-field" key={v.path.join("/")}>
              <summary>Input {v.path.join(" / ")}</summary>
              <NativeSelect
                label={`Input ${i + 1} use`}
                value={v.use}
                data={[
                  "scope",
                  "command-key",
                  "selector",
                  "expected-version",
                  "accepted-value",
                  "bounded-query",
                  "provider-original-bytes",
                  "authorized-choice",
                ]}
                onChange={(e) =>
                  change({
                    inputs: p.inputs.map((x, n) =>
                      n === i ? { ...x, use: e.currentTarget.value as typeof v.use } : x,
                    ),
                  })
                }
              />
            </details>
          ))
        : null}
      {section === "records" && record ? (
        <>
          <NativeSelect
            label="Protocol record"
            value={String(recordIndex)}
            data={p.records.map((r, i) => ({
              value: String(i),
              label: `${i + 1}. ${r.entity.id} · ${r.entity.version}`,
            }))}
            onChange={(e) => setRecordIndex(Number(e.currentTarget.value))}
          />
          <Pick
            label="Record access policy"
            value={contractKey(record.policy)}
            options={namedOptions(
              m.accessPolicies?.filter(
                (v) => contractKey(v.resource) === contractKey(record.entity),
              ) ?? [],
            )}
            onChange={(key) => {
              const v = m.accessPolicies?.find((v) => contractKey(v) === key);
              if (v) updateRecord({ ...record, policy: { id: v.id, version: v.version } });
            }}
            onOpen={() => ctx.navigate("policies", contractKey(record.policy))}
          />
          <NativeSelect
            label="Record selection"
            value={record.selection}
            data={[
              "input-key",
              "scoped-unique-key",
              "authorized-parent",
              "server-created",
              "bounded-plan",
              "current-recipient",
              "local-effect",
            ]}
            onChange={(e) =>
              updateRecord({
                ...record,
                selection: e.currentTarget.value as typeof record.selection,
              })
            }
          />
          {record.keys.map((key, i) => (
            <Pick
              key={`${key.field}/${key.input.join("/")}`}
              label={`Record key ${key.field} input ${i + 1}`}
              value={key.input.join("/")}
              options={inputs}
              onChange={(value) =>
                updateRecord({
                  ...record,
                  keys: record.keys.map((v, n) =>
                    n === i ? { ...v, input: value.split("/") } : v,
                  ),
                })
              }
            />
          ))}
          {record.writes.map((w, i) => (
            <details className="contract-field" key={w.field}>
              <summary>Write {w.field}</summary>
              {w.source.kind === "derived" ? (
                <Text size="sm">
                  Finite owner derivation: {w.source.rule}. The procedure validates this proposal
                  and applies its declared transaction boundary.
                </Text>
              ) : w.source.kind === "hook" ? (
                <Text size="sm">Validated exact hook result: {w.source.path.join(" / ")}</Text>
              ) : (
                <ValueSourceFields
                  context={ctx}
                  label={`Write ${w.field}`}
                  value={w.source}
                  onChange={(source) => {
                    if (source.kind !== "query-result" && source.kind !== "result")
                      updateRecord({
                        ...record,
                        writes: record.writes.map((v, n) => (n === i ? { ...v, source } : v)),
                      });
                  }}
                />
              )}
            </details>
          ))}
          <Text size="xs">
            Current read projection {record.readProjection}; write projection{" "}
            {record.writeProjection ?? "none"}; action {record.action}. Server fields, lifecycle
            transitions and exact policies remain validated.
          </Text>
        </>
      ) : null}
      {section === "hook snapshots" ? (
        <>
          <Text size="sm">
            Required hook: {p.hook ? contractKey(p.hook) : "none"}. Supplied snapshots carry no
            repository or network authority.
          </Text>
          {p.hookInputs.map((v, i) => (
            <details className="contract-field" key={v.field}>
              <summary>Snapshot {v.field}</summary>
              <Text size="sm">
                Source: {v.source}
                {v.entity ? ` · ${contractKey(v.entity)} / ${v.fields.join(", ")}` : ""}
                {v.query ? ` · ${contractKey(v.query)} / ${v.fields.join(", ")}` : ""}
                {v.derivation ? ` · ${v.derivation}` : ""}
                {v.literal !== undefined ? ` · ${String(v.literal)}` : ""}
              </Text>
              {v.input ? (
                <Pick
                  label={`Snapshot ${i + 1} input`}
                  value={v.input.join("/")}
                  options={inputs}
                  onChange={(value) =>
                    change({
                      hookInputs: p.hookInputs.map((x, n) =>
                        n === i ? { ...x, input: value.split("/") } : x,
                      ),
                    })
                  }
                />
              ) : null}
            </details>
          ))}
        </>
      ) : null}
      {section === "lifecycle dispatch" ? (
        <>
          {p.transitions.map((v, i) => (
            <details className="contract-field" key={`${contractKey(v.lifecycle)}/${v.transition}`}>
              <summary>
                {v.action} → {v.transition}
              </summary>
              <Pick
                label={`Dispatch ${i + 1} transition`}
                value={v.transition}
                options={(
                  m.lifecycles?.find((l) => contractKey(l) === contractKey(v.lifecycle))
                    ?.transitions ?? []
                ).map((t) => ({ value: t.id, label: `${t.id}: ${t.from} → ${t.to}` }))}
                onChange={(transition) =>
                  change({
                    transitions: p.transitions.map((x, n) => (n === i ? { ...x, transition } : x)),
                  })
                }
                onOpen={() => onLifecycle(contractKey(v.lifecycle))}
              />
            </details>
          ))}
          {p.versionChecks.map((v) => (
            <Text
              key={`${v.kind === "session-subject" ? "session-subject" : contractKey(v.entity)}/${v.input.join("/")}`}
              size="sm"
            >
              Fence{" "}
              {v.kind === "session-subject"
                ? "existing session subject"
                : `${contractKey(v.entity)} / ${v.field}`}{" "}
              from {v.input.join("/")}{" "}
              {v.kind === "session-subject"
                ? `for ${v.subject.join("/")}`
                : v.selector
                  ? `for ${v.selector.join("/")}`
                  : ""}
            </Text>
          ))}
        </>
      ) : null}
      {section === "outputs"
        ? p.outputs.map((v) => (
            <Text key={v.path.join("/")} size="sm">
              {v.path.join(" / ")} ← {v.source}
              {v.entity ? ` · ${contractKey(v.entity)} / ${v.fields.join(", ")}` : ""}
              {v.query ? ` · ${contractKey(v.query)} / ${v.fields.join(", ")}` : ""}
            </Text>
          ))
        : null}
    </Stack>
  );
}
