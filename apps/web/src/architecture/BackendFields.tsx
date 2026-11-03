import { type BackendReference, contractKey } from "@jeeves/spec";
import {
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  NumberInput,
  Stack,
  TextInput,
} from "@mantine/core";
import type { ReactNode } from "react";
export const dataId = (kind: string) => `${kind}-${crypto.randomUUID().slice(0, 8)}`;
export const exact = ({ id, version }: BackendReference): BackendReference => ({ id, version });
export type DataNavigation = (
  kind:
    | "contracts"
    | "datasets"
    | "entities"
    | "aggregates"
    | "queries"
    | "policies"
    | "accessBindings",
  key: string,
) => void;
export type Option = { value: string; label: string };
export function Pick({
  label,
  value,
  options,
  onChange,
  disabled,
  onOpen,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  onOpen?: () => void;
}) {
  return (
    <Stack gap={4}>
      <NativeSelect
        label={label}
        value={value}
        disabled={disabled}
        data={[
          { value: "", label: "Select · unresolved" },
          ...options.filter((o) => o.value).map(({ value, label }) => ({ value, label })),
          ...(value && !options.some((o) => o.value === value)
            ? [{ value, label: `${value} · missing / unresolved` }]
            : []),
        ]}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      {onOpen ? (
        <Button size="compact-xs" variant="subtle" disabled={!value} onClick={onOpen}>
          Open {label.toLowerCase()}
        </Button>
      ) : null}
    </Stack>
  );
}
export function Many({
  label,
  value,
  options,
  onChange,
  max = 100,
}: {
  label: string;
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  return (
    <MultiSelect
      label={label}
      searchable
      value={value}
      maxValues={max}
      data={[
        ...options.map(({ value, label }) => ({ value, label })),
        ...value
          .filter((v) => !options.some((o) => o.value === v))
          .map((value) => ({ value, label: `${value} · missing` })),
      ]}
      onChange={onChange}
    />
  );
}
export const namedOptions = (items: (BackendReference & { name: string })[]) =>
  items.map((v) => ({ value: contractKey(v), label: `${v.name} · ${v.version}` }));
export function Count({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <NumberInput
      label={label}
      value={value}
      min={min}
      max={max}
      allowDecimal={false}
      clampBehavior="none"
      onChange={(v) => onChange(typeof v === "number" ? v : 0)}
    />
  );
}
export function RecordHeader({
  label,
  name,
  version,
  onChange,
  versionDisabled = false,
}: {
  label: string;
  name: string;
  version: string;
  versionDisabled?: boolean;
  onChange: (patch: { name?: string; version?: string }) => void;
}) {
  return (
    <div className="architecture-form-pair">
      <TextInput
        label={`${label} name`}
        value={name}
        maxLength={120}
        onChange={(e) => onChange({ name: e.currentTarget.value })}
      />
      <TextInput
        label={`${label} version`}
        value={version}
        maxLength={40}
        disabled={versionDisabled}
        onChange={(e) => onChange({ version: e.currentTarget.value })}
      />
    </div>
  );
}
export function DataRows<T>({
  label,
  rows,
  max,
  create,
  onChange,
  children,
}: {
  label: string;
  rows: T[];
  max: number;
  create: () => T;
  onChange: (rows: T[]) => void;
  children: (row: T, index: number, change: (row: T) => void) => ReactNode;
}) {
  return (
    <section className="backend-rows" aria-label={label}>
      <h3>{label}</h3>
      {rows.map((row, index) => (
        <details
          className="contract-field"
          key={rowKey(row, index)}
          open={rows.length === 1 || undefined}
        >
          <summary>
            {label} {index + 1}
          </summary>
          <Stack gap="xs" mt="xs">
            {children(row, index, (next) => onChange(rows.map((v, i) => (i === index ? next : v))))}
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Remove {label.toLowerCase()} {index + 1}
            </Button>
          </Stack>
        </details>
      ))}
      <Group>
        <Button
          variant="default"
          size="xs"
          disabled={rows.length >= max}
          onClick={() => onChange([...rows, create()])}
        >
          Add {label.toLowerCase()}
        </Button>
      </Group>
    </section>
  );
}

function rowKey(row: unknown, index: number) {
  if (row && typeof row === "object" && "id" in row && typeof row.id === "string") return row.id;
  return `position-${index}`;
}
