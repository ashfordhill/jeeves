import {
  type Architecture,
  type BackendGuard,
  type BackendOperation,
  type BackendValueSource,
  backendEntityFields,
  type ContractField,
  type ContractTypeDefinition,
  contractKey,
  type DesignDocument,
  resolveContractValue,
} from "@jeeves/spec";
import { NativeSelect, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import {
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  namedOptions,
  type Option,
  Pick,
} from "./BackendFields.tsx";

export type BehaviorContext = {
  design: DesignDocument;
  draft: Architecture;
  operation?: BackendOperation;
  before?: number;
  navigate: DataNavigation;
};
export type Mapping = { field: string; value: BackendValueSource };
export const inputValue = (id = "unselected"): BackendValueSource => ({
  kind: "input",
  path: [id],
});
export function fieldPaths(
  fields: ContractField[],
  types: ContractTypeDefinition[] = [],
  parent: string[] = [],
): Option[] {
  return fields.flatMap((f) => {
    const path = [...parent, f.id];
    const v = resolveContractValue(f, types).value;
    return [
      { value: path.join("/"), label: `${path.join(" / ")} · ${v?.type ?? f.type}` },
      ...(v?.type === "object" && path.length < 5 ? fieldPaths(v.fields ?? [], [], path) : []),
    ];
  });
}
export function operationContract(ctx: BehaviorContext) {
  return ctx.draft.contracts?.find(
    (c) => ctx.operation && contractKey(c) === contractKey(ctx.operation.target.contract),
  );
}
export function inputPaths(ctx: BehaviorContext) {
  const c = operationContract(ctx);
  return fieldPaths(
    c?.shape?.operations.find((o) => o.id === ctx.operation?.target.operation)?.input ?? [],
    c?.shape?.types,
  );
}
export function ValueSourceFields({
  label,
  value: v,
  onChange,
  context: ctx,
  guard = false,
}: {
  label: string;
  value: BackendValueSource;
  onChange: (v: BackendValueSource) => void;
  context: BehaviorContext;
  guard?: boolean;
}) {
  const entities = ctx.draft.backend?.entities ?? [];
  const previous =
    ctx.operation?.actions.slice(0, ctx.before ?? ctx.operation.actions.length) ?? [];
  const producers = previous.filter(
    (a) =>
      a.kind === "hook" ||
      a.kind === "capability" ||
      ["create", "create-child", "append-revision"].includes(a.kind),
  );
  const producer = v.kind === "result" ? previous.find((a) => a.id === v.action) : undefined;
  const resultRef =
    producer?.kind === "capability"
      ? producer.strategy.result
      : producer?.kind === "hook"
        ? ctx.draft.backend?.hooks?.find((h) => contractKey(h) === contractKey(producer.hook))
            ?.contracts.output
        : undefined;
  const result = ctx.draft.contracts?.find(
    (c) => resultRef && contractKey(c) === contractKey(resultRef),
  );
  const created =
    producer &&
    "entity" in producer &&
    ["create", "create-child", "append-revision"].includes(producer.kind)
      ? entities.find((e) => contractKey(e) === contractKey(producer.entity))
      : undefined;
  const resultFields = created
    ? backendEntityFields({ ...ctx.design, architecture: ctx.draft }, created)
    : (result?.shape?.payload ?? []);
  const current =
    v.kind === "current"
      ? entities.find((e) => contractKey(e) === contractKey(v.entity))
      : undefined;
  const kinds = [
    ...(ctx.operation ? ["input"] : []),
    "current",
    "context",
    "literal",
    ...(!guard
      ? [
          "server",
          ...(ctx.operation
            ? ["result", ...(ctx.operation.kind === "query" ? ["query-result"] : [])]
            : []),
        ]
      : []),
  ];
  return (
    <Stack gap="xs">
      <NativeSelect
        label={`${label} source`}
        value={v.kind}
        data={kinds}
        onChange={(e) => {
          switch (e.currentTarget.value) {
            case "input":
              onChange(inputValue());
              break;
            case "current":
              onChange({
                kind: "current",
                entity: exact(entities[0] ?? { id: "unselected", version: "v1" }),
                field: "unselected",
              });
              break;
            case "context":
              onChange({ kind: "context", value: "principal" });
              break;
            case "server":
              onChange({ kind: "server", factory: "clock" });
              break;
            case "result":
              onChange({
                kind: "result",
                action: producers[0]?.id ?? "unselected",
                path: ["unselected"],
              });
              break;
            case "query-result":
              onChange({ kind: "query-result" });
              break;
            default:
              onChange({ kind: "literal", value: "" });
          }
        }}
      />
      {v.kind === "input" ? (
        <Pick
          label={`${label} input path`}
          value={v.path.join("/")}
          options={inputPaths(ctx)}
          onChange={(p) => onChange({ ...v, path: p.split("/") })}
        />
      ) : null}
      {v.kind === "current" ? (
        <>
          <Pick
            label={`${label} entity`}
            value={contractKey(v.entity)}
            options={namedOptions(entities)}
            onChange={(key) => {
              const e = entities.find((e) => contractKey(e) === key);
              if (e) onChange({ ...v, entity: exact(e), field: "unselected" });
            }}
            onOpen={() => ctx.navigate("entities", contractKey(v.entity))}
          />
          <Pick
            label={`${label} current field`}
            value={v.field}
            options={
              current
                ? backendEntityFields({ ...ctx.design, architecture: ctx.draft }, current).map(
                    (f) => ({ value: f.id, label: `${f.name} · ${f.type}` }),
                  )
                : []
            }
            onChange={(field) => onChange({ ...v, field })}
          />
        </>
      ) : null}
      {v.kind === "context" ? (
        <NativeSelect
          label={`${label} trusted context`}
          value={v.value}
          data={["principal", "scope", "correlation"]}
          onChange={(e) => onChange({ ...v, value: e.currentTarget.value as typeof v.value })}
        />
      ) : null}
      {v.kind === "server" ? (
        <NativeSelect
          label={`${label} server factory`}
          value={v.factory}
          data={["uuid", "clock", "initial-version", "next-version"]}
          onChange={(e) => onChange({ ...v, factory: e.currentTarget.value as typeof v.factory })}
        />
      ) : null}
      {v.kind === "result" ? (
        <>
          <Pick
            label={`${label} prior action`}
            value={v.action}
            options={producers.map((a) => ({ value: a.id, label: `${a.id} · ${a.kind}` }))}
            onChange={(action) => onChange({ ...v, action, path: ["unselected"] })}
          />
          <Pick
            label={`${label} result path`}
            value={v.path.join("/")}
            options={fieldPaths(resultFields, result?.shape?.types)}
            onChange={(p) => onChange({ ...v, path: p.split("/") })}
          />
        </>
      ) : null}
      {v.kind === "literal" ? (
        <>
          <NativeSelect
            label={`${label} literal type`}
            value={v.value === null ? "null" : typeof v.value}
            data={["string", "number", "boolean", "null"]}
            onChange={(e) =>
              onChange({
                kind: "literal",
                value:
                  e.currentTarget.value === "number"
                    ? 0
                    : e.currentTarget.value === "boolean"
                      ? false
                      : e.currentTarget.value === "null"
                        ? null
                        : "",
              })
            }
          />
          {typeof v.value === "string" ? (
            <TextInput
              label={`${label} literal`}
              value={v.value}
              maxLength={16000}
              onChange={(e) => onChange({ ...v, value: e.currentTarget.value })}
            />
          ) : typeof v.value === "number" ? (
            <NumberInput
              label={`${label} literal`}
              value={v.value}
              allowDecimal={false}
              clampBehavior="none"
              onChange={(n) => onChange({ ...v, value: typeof n === "number" ? n : 0 })}
            />
          ) : typeof v.value === "boolean" ? (
            <NativeSelect
              label={`${label} literal`}
              value={String(v.value)}
              data={["true", "false"]}
              onChange={(e) => onChange({ ...v, value: e.currentTarget.value === "true" })}
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
export function ValueMappings({
  label,
  rows,
  options,
  onChange,
  context,
  max = 100,
}: {
  label: string;
  rows: Mapping[];
  options: Option[];
  onChange: (v: Mapping[]) => void;
  context: BehaviorContext;
  max?: number;
}) {
  return (
    <DataRows
      label={label}
      rows={rows}
      max={max}
      create={() => ({ field: options[0]?.value ?? "unselected", value: inputValue() })}
      onChange={onChange}
    >
      {(v, i, change) => (
        <>
          <Pick
            label={`${label} ${i + 1} field`}
            value={v.field}
            options={options}
            onChange={(field) => change({ ...v, field })}
          />
          <ValueSourceFields
            label={`${label} ${i + 1}`}
            value={v.value}
            onChange={(value) => change({ ...v, value })}
            context={context}
          />
        </>
      )}
    </DataRows>
  );
}
export function GuardFields({
  guards,
  onChange,
  context,
}: {
  guards: BackendGuard[];
  onChange: (v: BackendGuard[]) => void;
  context: BehaviorContext;
}) {
  return (
    <DataRows<BackendGuard>
      label="Guard"
      rows={guards}
      max={20}
      create={() => ({
        id: dataId("guard"),
        kind: "present",
        value: { kind: "literal", value: true },
      })}
      onChange={onChange}
    >
      {(g, i, change) => (
        <>
          <Text size="xs">Guard identity: {g.id}</Text>
          <NativeSelect
            label={`Guard ${i + 1} kind`}
            data={["present", "compare"]}
            value={g.kind}
            onChange={(e) =>
              change(
                e.currentTarget.value === "compare"
                  ? {
                      id: g.id,
                      kind: "compare",
                      left: { kind: "literal", value: true },
                      operator: "eq",
                      right: { kind: "literal", value: true },
                    }
                  : { id: g.id, kind: "present", value: { kind: "literal", value: true } },
              )
            }
          />
          {g.kind === "present" ? (
            <ValueSourceFields
              label={`Guard ${i + 1} value`}
              value={g.value}
              onChange={(value) => change({ ...g, value })}
              context={context}
              guard
            />
          ) : (
            <>
              <ValueSourceFields
                label={`Guard ${i + 1} left`}
                value={g.left}
                onChange={(left) => change({ ...g, left })}
                context={context}
                guard
              />
              <NativeSelect
                label={`Guard ${i + 1} comparison`}
                data={["eq", "ne", "lt", "lte", "gt", "gte"]}
                value={g.operator}
                onChange={(e) =>
                  change({ ...g, operator: e.currentTarget.value as typeof g.operator })
                }
              />
              <ValueSourceFields
                label={`Guard ${i + 1} right`}
                value={g.right}
                onChange={(right) => change({ ...g, right })}
                context={context}
                guard
              />
            </>
          )}
        </>
      )}
    </DataRows>
  );
}
