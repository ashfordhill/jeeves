import { type Architecture, contractKey, type DesignDocument } from "@jeeves/spec";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { dataId, Pick } from "./BackendFields.tsx";
import { PayloadFields } from "./ContractFields.tsx";
import { ContractTypeScope } from "./ContractTypeScope.tsx";
import { contractShapeProtected } from "./contract-editing.ts";
export function DataContractEditor({
  base,
  draft,
  selected,
  onSelect,
  onChange,
}: {
  base: DesignDocument;
  draft: Architecture;
  selected: string;
  onSelect: (key: string) => void;
  onChange: (draft: Architecture) => void;
}) {
  const contracts = draft.contracts ?? [];
  const contract = contracts.find((c) => contractKey(c) === selected);
  const original = base.architecture?.contracts?.find(
    (c) => contract && contractKey(c) === contractKey(contract),
  );
  const locked = !!contract && contractShapeProtected(base, contract);
  const shape = contract?.shape;
  const update = (patch: Partial<NonNullable<typeof contract>>) => {
    if (!contract) return;
    const next = { ...contract, ...patch };
    onChange({ ...draft, contracts: contracts.map((c) => (c === contract ? next : c)) });
    onSelect(contractKey(next));
  };
  return (
    <Stack gap="sm">
      <Pick
        label="Data contract definition"
        value={selected}
        options={contracts
          .filter((c) => c.kind === "data")
          .map((c) => ({
            value: contractKey(c),
            label: `${c.name} · ${c.version}${c.source ? " · source (read-only)" : ""}`,
          }))}
        onChange={onSelect}
      />
      <Button
        variant="default"
        disabled={contracts.length >= 200}
        onClick={() => {
          const next = {
            id: dataId("contract"),
            version: "v1",
            name: "New data contract",
            kind: "data" as const,
            description: "",
            shape: { operations: [], payload: [] },
          };
          onChange({ ...draft, contracts: [...contracts, next] });
          onSelect(contractKey(next));
        }}
      >
        Add data contract
      </Button>
      {contract ? (
        <>
          <div className="architecture-form-pair">
            <TextInput
              label="Data contract name"
              value={contract.name}
              maxLength={120}
              onChange={(e) => update({ name: e.currentTarget.value })}
            />
            <TextInput
              label="Data contract version"
              value={contract.version}
              maxLength={40}
              disabled={locked || !!contract.source}
              onChange={(e) => update({ version: e.currentTarget.value })}
            />
          </div>
          {locked ? (
            <Text size="sm">
              This exact contract is referenced. Its shape is protected. Create a successor version
              and review consumers before selecting it.
            </Text>
          ) : null}
          {contract.source ? (
            <Text size="sm">
              Authoritative legacy source · inspect through Interfaces. Persistence remains owned by
              the original resource; an editable entity copy is not supported.
            </Text>
          ) : shape ? (
            <ContractTypeScope
              key={contractKey(contract)}
              shape={shape}
              original={original?.shape}
              disabled={locked}
              onChange={(shape) => update({ shape })}
            >
              <PayloadFields
                label="Data payload"
                fields={shape.payload}
                disabled={locked}
                onChange={(payload) => update({ shape: { ...shape, payload } })}
              />
            </ContractTypeScope>
          ) : null}
          <Group>
            <Button
              variant="default"
              disabled={!!contract.source || contracts.length >= 200}
              onClick={() => {
                let n = 2;
                while (contracts.some((c) => c.id === contract.id && c.version === `v${n}`)) n++;
                const next = { ...structuredClone(contract), version: `v${n}` };
                onChange({ ...draft, contracts: [...contracts, next] });
                onSelect(contractKey(next));
              }}
            >
              Create contract successor
            </Button>
            <Button
              color="red"
              variant="subtle"
              disabled={locked || !!contract.source}
              onClick={() => {
                onChange({ ...draft, contracts: contracts.filter((c) => c !== contract) });
                onSelect("");
              }}
            >
              Remove data contract
            </Button>
          </Group>
          <details>
            <summary>Exact consumers · {selected}</summary>
            <Text size="sm">
              Consumers retain their exact version. Retarget a dataset only after reviewing its
              entity and other consumers.
            </Text>
            <ul>
              {(draft.datasets ?? [])
                .filter((d) => contractKey(d.contract) === selected)
                .map((d) => (
                  <li key={d.id}>{d.name} · dataset</li>
                ))}
              {(draft.backend?.entities ?? [])
                .filter((e) => contractKey(e.contract) === selected)
                .map((e) => (
                  <li key={contractKey(e)}>
                    {e.name} · entity {e.version}
                  </li>
                ))}
              {(draft.interfaces ?? [])
                .filter((i) => contractKey(i.contract) === selected)
                .map((i) => (
                  <li key={i.id}>
                    {i.name} · {i.direction}
                  </li>
                ))}
            </ul>
          </details>
        </>
      ) : null}
    </Stack>
  );
}
