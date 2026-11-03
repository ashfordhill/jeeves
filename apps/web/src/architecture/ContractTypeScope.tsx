import {
  type ContractShape,
  type ContractTypeDefinition,
  contractTypeKey,
  inspectContractShape,
} from "@jeeves/spec";
import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { createContext, type ReactNode, useContext, useId, useRef, useState } from "react";
import { ValueFields } from "./ContractFields.tsx";

const TypeContext = createContext<{
  target: string;
  types: ContractTypeDefinition[];
  navigate: (key: string) => void;
}>({ target: "local-types", types: [], navigate: () => {} });
export const useContractTypes = () => useContext(TypeContext);

/** Local definitions and payloads share one exact scope and one parent save. */
export function ContractTypeScope({
  shape,
  original,
  disabled,
  onChange,
  children,
}: {
  shape: ContractShape;
  original?: ContractShape;
  disabled: boolean;
  onChange: (shape: ContractShape) => void;
  children: ReactNode;
}) {
  const target = useId();
  const panel = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const types = shape.types ?? [];
  const type = types.find((t) => contractTypeKey(t) === selected);
  const referenced = new Set(
    original ? inspectContractShape(original).references.map(contractTypeKey) : [],
  );
  const locked = disabled || (!!type && referenced.has(contractTypeKey(type)));
  const update = (patch: Partial<ContractTypeDefinition>) => {
    if (!type) return;
    const next = { ...type, ...patch };
    onChange({ ...shape, types: types.map((t) => (t === type ? next : t)) });
    setSelected(contractTypeKey(next));
  };
  return (
    <TypeContext.Provider
      value={{
        types,
        target,
        navigate: (key) => {
          setSelected(key);
          setOpen(true);
          requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest" }));
        },
      }}
    >
      <details
        ref={panel}
        id={target}
        tabIndex={-1}
        className="contract-types"
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary>Reusable local types · {types.length}</summary>
        <Stack gap="sm" mt="sm">
          <NativeSelect
            label="Local type definition"
            value={selected}
            data={[
              { value: "", label: "Choose an exact local type" },
              ...types.map((t) => ({
                value: contractTypeKey(t),
                label: `${t.name} · ${t.version}`,
              })),
              ...(selected && !type
                ? [{ value: selected, label: `${selected} · unresolved` }]
                : []),
            ]}
            onChange={(e) => setSelected(e.currentTarget.value)}
          />
          <Button
            variant="default"
            disabled={disabled || types.length >= 100}
            onClick={() => {
              const next = {
                id: `type-${crypto.randomUUID().slice(0, 8)}`,
                version: "v1",
                name: "New type",
                description: "",
                value: { type: "unresolved" as const },
              };
              onChange({ ...shape, types: [...types, next] });
              setSelected(contractTypeKey(next));
            }}
          >
            Add local type
          </Button>
          {type ? (
            <>
              <TextInput
                label="Local type name"
                value={type.name}
                maxLength={120}
                onChange={(e) => update({ name: e.currentTarget.value })}
              />
              <TextInput
                label="Local type version"
                value={type.version}
                maxLength={40}
                disabled={locked}
                onChange={(e) => update({ version: e.currentTarget.value })}
              />
              {locked ? (
                <Text size="sm">
                  This exact type is protected. Create a successor and explicitly select it at each
                  reference; existing consumers keep their version.
                </Text>
              ) : null}
              <fieldset className="contract-payload" disabled={locked}>
                <legend>Local type value</legend>
                <ValueFields
                  label="Local type"
                  value={type.value}
                  disabled={locked}
                  depth={0}
                  onChange={(value) => update({ value })}
                />
              </fieldset>
              <Group>
                <Button
                  variant="default"
                  disabled={disabled || types.length >= 100}
                  onClick={() => {
                    let n = 2;
                    while (types.some((t) => t.id === type.id && t.version === `v${n}`)) n++;
                    const next = { ...structuredClone(type), version: `v${n}` };
                    onChange({ ...shape, types: [...types, next] });
                    setSelected(contractTypeKey(next));
                  }}
                >
                  Create type successor
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={
                    locked ||
                    inspectContractShape(shape).references.some(
                      (r) => contractTypeKey(r) === selected,
                    )
                  }
                  onClick={() => {
                    onChange({ ...shape, types: types.filter((t) => t !== type) });
                    setSelected("");
                  }}
                >
                  Remove local type
                </Button>
              </Group>
            </>
          ) : null}
        </Stack>
      </details>
      {children}
    </TypeContext.Provider>
  );
}
