import {
  type Architecture,
  type BackendAggregate,
  backendEntityFields,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { NativeSelect, Stack, Text } from "@mantine/core";
import {
  Count,
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  Many,
  namedOptions,
  Pick,
} from "./BackendFields.tsx";

type AggregateField = { entity: BackendAggregate["root"]; field: string };
export function BackendAggregateEditor({
  design,
  draft,
  aggregate: a,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  aggregate: BackendAggregate;
  onChange: (value: BackendAggregate) => void;
  navigate: DataNavigation;
}) {
  const entities = draft.backend?.entities ?? [];
  const options = namedOptions(entities);
  const update = (patch: Partial<BackendAggregate>) => onChange({ ...a, ...patch });
  const participants = [a.root, ...a.children];
  const refs = participants.flatMap((ref) => {
    const e = entities.find((e) => contractKey(e) === contractKey(ref));
    return e
      ? backendEntityFields({ ...design, architecture: draft }, e).map((f) => ({
          value: `${contractKey(e)}/${f.id}`,
          label: `${e.name} · ${f.name}`,
          ref: { entity: exact(e), field: f.id },
        }))
      : [];
  });
  const field = (label: string, value: AggregateField, change: (ref: AggregateField) => void) => (
    <Pick
      label={label}
      value={`${contractKey(value.entity)}/${value.field}`}
      options={refs}
      onChange={(v) => {
        const found = refs.find((f) => f.value === v);
        if (found) change(found.ref);
      }}
      onOpen={() => navigate("entities", contractKey(value.entity))}
    />
  );
  const emptyField = () => refs[0]?.ref ?? { entity: a.root, field: "unselected" };
  return (
    <Stack gap="sm">
      <Pick
        label="Aggregate root entity"
        value={contractKey(a.root)}
        options={options}
        onChange={(v) => {
          const e = entities.find((e) => contractKey(e) === v);
          if (e) update({ root: exact(e) });
        }}
        onOpen={() => navigate("entities", contractKey(a.root))}
      />
      <Many
        label="Aggregate child entities"
        value={a.children.map(contractKey)}
        options={options.filter((o) => o.value !== contractKey(a.root))}
        max={30}
        onChange={(values) =>
          update({
            children: entities
              .filter((e) => values.includes(contractKey(e)))
              .map(exact)
              .sort((a, b) =>
                contractKey(a) < contractKey(b) ? -1 : contractKey(a) > contractKey(b) ? 1 : 0,
              ),
          })
        }
      />
      <Pick
        label="Aggregate authority"
        value={`${a.owner.kind}:${a.owner.id}`}
        options={[
          ...design.elements.map((e) => ({
            value: `element:${e.id}`,
            label: `${e.name} · container`,
          })),
          ...(draft.components ?? []).map((c) => ({
            value: `component:${c.id}`,
            label: `${c.name} · component`,
          })),
        ]}
        onChange={(v) => {
          const [kind, id] = v.split(":");
          if (id) update({ owner: { kind: kind as "component" | "element", id } });
        }}
      />
      <Pick
        label="Aggregate store"
        value={a.store}
        options={design.elements.map((e) => ({ value: e.id, label: e.name }))}
        onChange={(store) => update({ store })}
      />
      <NativeSelect
        label="Concurrency strategy"
        data={["row-lock", "optimistic"]}
        value={a.concurrency.kind}
        onChange={(e) =>
          update({
            concurrency:
              e.currentTarget.value === "optimistic"
                ? { kind: "optimistic", version: emptyField() }
                : { kind: "row-lock", entities: participants, order: "entity-id-primary-key" },
          })
        }
      />
      {a.concurrency.kind === "optimistic" ? (
        field("Expected version field", a.concurrency.version, (version) =>
          update({ concurrency: { kind: "optimistic", version } }),
        )
      ) : (
        <Many
          label="Locked entities"
          value={a.concurrency.entities.map(contractKey)}
          options={options}
          max={31}
          onChange={(values) =>
            update({
              concurrency: {
                kind: "row-lock",
                entities: entities
                  .filter((e) => values.includes(contractKey(e)))
                  .map(exact)
                  .sort((a, b) =>
                    contractKey(a) < contractKey(b) ? -1 : contractKey(a) > contractKey(b) ? 1 : 0,
                  ),
                order: "entity-id-primary-key",
              },
            })
          }
        />
      )}
      <Text size="sm">
        Row locks use stable entity-ID / primary-key order. All participants must share one
        application and relational store. Strategies express intent; runtime availability is
        separate.
      </Text>
      <DataRows<BackendAggregate["invariants"][number]>
        label="Invariant"
        rows={a.invariants}
        max={20}
        create={() => ({ id: dataId("invariant"), strategy: "nonnegative", value: emptyField() })}
        onChange={(invariants) => update({ invariants })}
      >
        {(v, i, change) => (
          <>
            <NativeSelect
              label={`Invariant ${i + 1} strategy`}
              value={v.strategy}
              data={["required-child", "nonnegative", "field-comparison", "inventory-balance"]}
              onChange={(e) => {
                const common = { id: v.id };
                switch (e.currentTarget.value) {
                  case "required-child":
                    change({
                      ...common,
                      strategy: "required-child",
                      child: a.children[0] ?? a.root,
                      relation: "unselected",
                      minimum: 1,
                      maximum: 1,
                    });
                    break;
                  case "field-comparison":
                    change({
                      ...common,
                      strategy: "field-comparison",
                      left: emptyField(),
                      operator: "lte",
                      right: emptyField(),
                    });
                    break;
                  case "inventory-balance":
                    change({
                      ...common,
                      strategy: "inventory-balance",
                      stock: emptyField(),
                      reserved: emptyField(),
                      relation: "unselected",
                    });
                    break;
                  default:
                    change({ ...common, strategy: "nonnegative", value: emptyField() });
                }
              }}
            />
            {v.strategy === "nonnegative"
              ? field(`Invariant ${i + 1} value`, v.value, (value) => change({ ...v, value }))
              : null}
            {v.strategy === "field-comparison" ? (
              <>
                {field(`Invariant ${i + 1} left`, v.left, (left) => change({ ...v, left }))}
                <NativeSelect
                  label={`Invariant ${i + 1} comparison`}
                  data={["eq", "lte", "gte"]}
                  value={v.operator}
                  onChange={(e) =>
                    change({ ...v, operator: e.currentTarget.value as typeof v.operator })
                  }
                />
                {field(`Invariant ${i + 1} right`, v.right, (right) => change({ ...v, right }))}
              </>
            ) : null}
            {v.strategy === "inventory-balance" ? (
              <>
                {field(`Invariant ${i + 1} stock`, v.stock, (stock) => change({ ...v, stock }))}
                {field(`Invariant ${i + 1} reserved`, v.reserved, (reserved) =>
                  change({ ...v, reserved }),
                )}
              </>
            ) : null}
            {v.strategy === "required-child" ? (
              <>
                <Pick
                  label={`Invariant ${i + 1} child`}
                  value={contractKey(v.child)}
                  options={namedOptions(
                    entities.filter((e) =>
                      a.children.some((r) => contractKey(r) === contractKey(e)),
                    ),
                  )}
                  onChange={(key) => {
                    const e = entities.find((e) => contractKey(e) === key);
                    if (e) change({ ...v, child: exact(e) });
                  }}
                />
                <Count
                  label={`Invariant ${i + 1} minimum`}
                  value={v.minimum}
                  min={1}
                  max={1000}
                  onChange={(minimum) => change({ ...v, minimum })}
                />
                <Count
                  label={`Invariant ${i + 1} maximum`}
                  value={v.maximum}
                  min={1}
                  max={1000}
                  onChange={(maximum) => change({ ...v, maximum })}
                />
              </>
            ) : null}
            {"relation" in v ? (
              <Pick
                label={`Invariant ${i + 1} relation`}
                value={v.relation}
                options={entities
                  .filter((e) => participants.some((p) => contractKey(p) === contractKey(e)))
                  .flatMap((e) =>
                    e.relations.map((r) => ({ value: r.id, label: `${e.name} · ${r.id}` })),
                  )}
                onChange={(relation) => change({ ...v, relation })}
              />
            ) : null}
          </>
        )}
      </DataRows>
    </Stack>
  );
}
