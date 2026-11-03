import { type BackendAction, backendEntityFields, contractKey } from "@jeeves/spec";
import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { Count, DataRows, dataId, exact, namedOptions, Pick } from "./BackendFields.tsx";
import { type BehaviorContext, inputValue, ValueMappings } from "./BehaviorValueFields.tsx";

export type { BackendNavigation as BehaviorNavigation } from "./BackendEffectFields.tsx";

import type { BackendNavigation as BehaviorNavigation } from "./BackendEffectFields.tsx";
export function BackendActionEditor({
  context: ctx,
  actions,
  onChange,
  onNavigate,
}: {
  context: BehaviorContext;
  actions: BackendAction[];
  onChange: (v: BackendAction[]) => void;
  onNavigate: BehaviorNavigation;
}) {
  const model = ctx.draft.backend;
  const entities = model?.entities ?? [];
  const emptyEntity = exact(entities[0] ?? { id: "unselected", version: "v1" });
  return (
    <DataRows<BackendAction>
      label="Action"
      rows={actions}
      max={20}
      create={() => ({ id: dataId("action"), kind: "patch", entity: emptyEntity, values: [] })}
      onChange={onChange}
    >
      {(a, i, change) => {
        const context = { ...ctx, before: i };
        const entity =
          "entity" in a
            ? entities.find((e) => contractKey(e) === contractKey(a.entity))
            : undefined;
        const lifecycle =
          a.kind === "transition"
            ? model?.lifecycles?.find((l) => contractKey(l) === contractKey(a.lifecycle))
            : undefined;
        const target = lifecycle
          ? entities.find((e) => contractKey(e) === contractKey(lifecycle.state.entity))
          : entity;
        const fields = entity
          ? backendEntityFields({ ...ctx.design, architecture: ctx.draft }, entity).map((f) => ({
              value: f.id,
              label: `${f.name} · ${f.type}`,
            }))
          : [];
        const keyFields = (target?.primaryKey ?? []).map((f) => ({ value: f, label: f }));
        const hook =
          a.kind === "hook"
            ? model?.hooks?.find((h) => contractKey(h) === contractKey(a.hook))
            : undefined;
        const input =
          a.kind === "hook"
            ? (ctx.draft.contracts
                ?.find((c) => hook && contractKey(c) === contractKey(hook.contracts.input))
                ?.shape?.payload.map((f) => ({ value: f.id, label: f.name })) ?? [])
            : [{ value: "cart-id", label: "cart-id · UUID" }];
        return (
          <Stack gap="sm">
            <Text size="xs">
              Action identity: {a.id} · position {i + 1}
            </Text>
            <Group>
              <Button
                size="compact-xs"
                variant="default"
                disabled={i === 0}
                onClick={() => {
                  const next = [...actions];
                  const previous = next[i - 1];
                  if (!previous) return;
                  [next[i - 1], next[i]] = [a, previous];
                  onChange(next);
                }}
              >
                Move action {i + 1} up
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                disabled={i === actions.length - 1}
                onClick={() => {
                  const next = [...actions];
                  const following = next[i + 1];
                  if (!following) return;
                  [next[i], next[i + 1]] = [following, a];
                  onChange(next);
                }}
              >
                Move action {i + 1} down
              </Button>
            </Group>
            <NativeSelect
              label={`Action ${i + 1} kind`}
              value={a.kind}
              data={[
                "create",
                "create-child",
                "patch",
                "append-revision",
                "transition",
                "add-relation",
                "remove-relation",
                "capability",
                "hook",
              ]}
              onChange={(e) => {
                const kind = e.currentTarget.value as BackendAction["kind"];
                if (kind === "transition")
                  change({
                    id: a.id,
                    kind,
                    lifecycle: exact(model?.lifecycles?.[0] ?? { id: "unselected", version: "v1" }),
                    transition: model?.lifecycles?.[0]?.transitions[0]?.id ?? "unselected",
                  });
                else if (kind === "capability")
                  change({
                    id: a.id,
                    kind,
                    strategy: {
                      kind: "registered",
                      name: "checkout-order",
                      version: "v1",
                      options: { maximumLines: 100 },
                      result: exact(
                        ctx.draft.contracts?.find((c) => c.kind === "data") ?? {
                          id: "unselected",
                          version: "v1",
                        },
                      ),
                    },
                    input: [{ field: "cart-id", value: inputValue() }],
                  });
                else if (kind === "hook")
                  change({
                    id: a.id,
                    kind,
                    hook: exact(
                      model?.hooks?.find(
                        (h) =>
                          h.kind === "pure" &&
                          ctx.operation &&
                          contractKey(h.operation) === contractKey(ctx.operation),
                      ) ?? { id: "unselected", version: "v1" },
                    ),
                    input: [],
                  });
                else change({ id: a.id, kind, entity: emptyEntity, values: [] });
              }}
            />
            {"entity" in a ? (
              <>
                <Pick
                  label={`Action ${i + 1} entity`}
                  value={contractKey(a.entity)}
                  options={namedOptions(entities)}
                  onChange={(key) => {
                    const e = entities.find((e) => contractKey(e) === key);
                    if (e) change({ ...a, entity: exact(e) });
                  }}
                  onOpen={() => ctx.navigate("entities", contractKey(a.entity))}
                />
                {a.kind === "add-relation" || a.kind === "remove-relation" ? (
                  <Pick
                    label={`Action ${i + 1} relation`}
                    value={a.relation ?? ""}
                    options={entity?.relations.map((r) => ({ value: r.id, label: r.id })) ?? []}
                    onChange={(relation) => change({ ...a, relation: relation || undefined })}
                  />
                ) : null}
                <ValueMappings
                  label={`Action ${i + 1} value`}
                  rows={a.values}
                  options={fields}
                  onChange={(values) => change({ ...a, values })}
                  context={context}
                />
              </>
            ) : null}
            {a.kind === "transition" ? (
              <>
                <Pick
                  label={`Action ${i + 1} lifecycle`}
                  value={contractKey(a.lifecycle)}
                  options={namedOptions(model?.lifecycles ?? [])}
                  onChange={(key) => {
                    const l = model?.lifecycles?.find((l) => contractKey(l) === key);
                    if (l)
                      change({
                        ...a,
                        lifecycle: exact(l),
                        transition: l.transitions[0]?.id ?? "unselected",
                      });
                  }}
                  onOpen={() => onNavigate("lifecycles", contractKey(a.lifecycle))}
                />
                <Pick
                  label={`Action ${i + 1} transition`}
                  value={a.transition}
                  options={
                    lifecycle?.transitions.map((t) => ({
                      value: t.id,
                      label: `${t.from} → ${t.to} · ${t.id}`,
                    })) ?? []
                  }
                  onChange={(transition) => change({ ...a, transition })}
                />
              </>
            ) : null}
            {"key" in a ||
            a.kind === "transition" ||
            a.kind === "patch" ||
            a.kind === "add-relation" ||
            a.kind === "remove-relation" ? (
              <details>
                <summary>Addressed child key (root uses command identity)</summary>
                <ValueMappings
                  label={`Action ${i + 1} key`}
                  rows={"key" in a ? (a.key ?? []) : []}
                  options={keyFields}
                  max={10}
                  context={context}
                  onChange={(key) => {
                    change({ ...a, key: key.length ? key : undefined });
                  }}
                />
              </details>
            ) : null}
            {a.kind === "hook" ? (
              <>
                <Pick
                  label={`Action ${i + 1} pure hook`}
                  value={contractKey(a.hook)}
                  options={namedOptions(
                    (model?.hooks ?? []).filter(
                      (h) =>
                        h.kind === "pure" &&
                        h.boundary === "before-commit" &&
                        ctx.operation &&
                        contractKey(h.operation) === contractKey(ctx.operation),
                    ),
                  )}
                  onChange={(key) => {
                    const h = model?.hooks?.find((h) => contractKey(h) === key);
                    if (h) change({ ...a, hook: exact(h) });
                  }}
                  onOpen={() => onNavigate("hooks", contractKey(a.hook))}
                />
                <Text size="sm">
                  Select an existing exact pure hook. Hook definitions and effectful delivery are
                  authored separately. Its validated result is a proposal; explicit actions own
                  writes.
                </Text>
                <ValueMappings
                  label={`Action ${i + 1} input`}
                  rows={a.input}
                  options={input}
                  max={40}
                  onChange={(input) => change({ ...a, input })}
                  context={context}
                />
              </>
            ) : null}
            {a.kind === "capability" ? (
              <>
                <NativeSelect
                  label={`Action ${i + 1} strategy`}
                  value={a.strategy.kind}
                  data={[
                    { value: "registered", label: "checkout-order@v1 · design strategy" },
                    { value: "unsupported", label: "Explicit unsupported strategy" },
                  ]}
                  onChange={(e) =>
                    change({
                      ...a,
                      strategy:
                        e.currentTarget.value === "registered"
                          ? {
                              kind: "registered",
                              name: "checkout-order",
                              version: "v1",
                              options: { maximumLines: 100 },
                              result: a.strategy.result,
                            }
                          : {
                              kind: "unsupported",
                              reference: { id: "unselected", version: "v1" },
                              result: a.strategy.result,
                            },
                    })
                  }
                />
                {a.strategy.kind === "registered" ? (
                  <Count
                    label={`Action ${i + 1} maximum lines`}
                    value={a.strategy.options.maximumLines}
                    min={1}
                    max={1000}
                    onChange={(maximumLines) => {
                      if (a.strategy.kind === "registered")
                        change({ ...a, strategy: { ...a.strategy, options: { maximumLines } } });
                    }}
                  />
                ) : (
                  <>
                    <TextInput
                      label={`Action ${i + 1} unsupported strategy ID`}
                      value={a.strategy.reference.id}
                      onChange={(e) => {
                        if (a.strategy.kind === "unsupported")
                          change({
                            ...a,
                            strategy: {
                              ...a.strategy,
                              reference: { ...a.strategy.reference, id: e.currentTarget.value },
                            },
                          });
                      }}
                    />
                    <TextInput
                      label={`Action ${i + 1} unsupported strategy version`}
                      value={a.strategy.reference.version}
                      onChange={(e) => {
                        if (a.strategy.kind === "unsupported")
                          change({
                            ...a,
                            strategy: {
                              ...a.strategy,
                              reference: {
                                ...a.strategy.reference,
                                version: e.currentTarget.value,
                              },
                            },
                          });
                      }}
                    />
                  </>
                )}
                <Pick
                  label={`Action ${i + 1} result contract`}
                  value={contractKey(a.strategy.result)}
                  options={namedOptions(
                    (ctx.draft.contracts ?? []).filter((c) => c.kind === "data"),
                  )}
                  onChange={(key) => {
                    const c = ctx.draft.contracts?.find((c) => contractKey(c) === key);
                    if (c) change({ ...a, strategy: { ...a.strategy, result: exact(c) } });
                  }}
                  onOpen={() => ctx.navigate("contracts", contractKey(a.strategy.result))}
                />
                <ValueMappings
                  label={`Action ${i + 1} input`}
                  rows={a.input}
                  options={input}
                  max={20}
                  onChange={(input) => change({ ...a, input })}
                  context={context}
                />
                <Text size="sm">
                  Strategy registration records design meaning. Runtime support remains a separate
                  obligation.
                </Text>
              </>
            ) : null}
          </Stack>
        );
      }}
    </DataRows>
  );
}
