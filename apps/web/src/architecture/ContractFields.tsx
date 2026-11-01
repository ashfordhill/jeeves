import {
  CONTRACT_NESTING_LIMIT,
  type ContractField,
  type ContractValue,
  contractValueTypes,
} from "@jeeves/spec";
import {
  Button,
  Checkbox,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  TextInput,
} from "@mantine/core";

function ValueFields({
  label,
  value,
  onChange,
  disabled,
  depth,
}: {
  label: string;
  value: ContractValue;
  onChange: (value: ContractValue) => void;
  disabled: boolean;
  depth: number;
}) {
  const bounds =
    value.type === "text"
      ? (["minLength", "maxLength"] as const)
      : value.type === "array"
        ? (["minItems", "maxItems"] as const)
        : ["integer", "number"].includes(value.type)
          ? (["minimum", "maximum"] as const)
          : [];
  return (
    <Stack gap="xs">
      <NativeSelect
        label={`${label} type`}
        value={value.type}
        data={[...contractValueTypes]}
        onChange={(e) =>
          onChange({
            type: e.currentTarget.value as ContractValue["type"],
            ...(value.nullable !== undefined && { nullable: value.nullable }),
          })
        }
      />
      <Checkbox
        label={`${label} nullable`}
        checked={value.nullable ?? false}
        onChange={(e) => onChange({ ...value, nullable: e.currentTarget.checked })}
      />
      {value.type === "text" ? (
        <TextInput
          label={`${label} allowed values`}
          description="Optional; separate values with commas."
          value={value.enumValues?.join(", ") ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              enumValues: e.currentTarget.value
                ? e.currentTarget.value.split(",").map((v) => v.trim())
                : undefined,
            })
          }
        />
      ) : null}
      {bounds.length ? (
        <Group grow>
          {bounds.map((key) => (
            <NumberInput
              key={key}
              label={`${label} ${key}`}
              value={value[key] ?? ""}
              allowDecimal={value.type === "number"}
              min={key === "minimum" || key === "maximum" ? undefined : 0}
              onChange={(v) => onChange({ ...value, [key]: typeof v === "number" ? v : undefined })}
            />
          ))}
        </Group>
      ) : null}
      {value.type === "object" && depth < CONTRACT_NESTING_LIMIT ? (
        <PayloadFields
          label={`${label} object`}
          fields={value.fields ?? []}
          disabled={disabled}
          depth={depth + 1}
          onChange={(fields) => onChange({ ...value, fields })}
        />
      ) : null}
      {value.type === "array" && depth < CONTRACT_NESTING_LIMIT ? (
        <fieldset className="contract-payload" disabled={disabled}>
          <legend>{label} items</legend>
          <ValueFields
            label={`${label} item`}
            value={value.items ?? { type: "unresolved" }}
            disabled={disabled}
            depth={depth + 1}
            onChange={(items) => onChange({ ...value, items })}
          />
        </fieldset>
      ) : null}
      {["object", "array"].includes(value.type) && depth === CONTRACT_NESTING_LIMIT ? (
        <p>Nesting limit reached. This shape remains unresolved.</p>
      ) : null}
    </Stack>
  );
}

export function PayloadFields({
  label,
  fields,
  onChange,
  disabled,
  depth = 0,
}: {
  label: string;
  fields: ContractField[];
  onChange: (fields: ContractField[]) => void;
  disabled: boolean;
  depth?: number;
}) {
  return (
    <fieldset className="contract-payload" disabled={disabled}>
      <legend>{label}</legend>
      {fields.map((field, index) => {
        const title = `${label} field ${index + 1}`;
        const change = (next: ContractField) =>
          onChange(fields.map((f, i) => (i === index ? next : f)));
        const { id, name, required, description, ...value } = field;
        return (
          <details className="contract-field" key={id} open={fields.length === 1 || undefined}>
            <summary>
              {name} · {field.type}
              {required ? " · required" : ""}
            </summary>
            <Stack gap="xs" mt="xs">
              <TextInput
                label={`${title} name`}
                value={name}
                maxLength={64}
                onChange={(e) => change({ ...field, name: e.currentTarget.value })}
              />
              <ValueFields
                label={title}
                value={value}
                disabled={disabled}
                depth={depth}
                onChange={(next) => change({ id, name, required, description, ...next })}
              />
              <TextInput
                label={`${title} description`}
                value={description}
                maxLength={1200}
                onChange={(e) => change({ ...field, description: e.currentTarget.value })}
              />
              <Group justify="space-between">
                <Checkbox
                  label={`${title} required`}
                  checked={required}
                  onChange={(e) => change({ ...field, required: e.currentTarget.checked })}
                />
                <Button
                  size="compact-xs"
                  color="red"
                  variant="subtle"
                  onClick={() => onChange(fields.filter((_, i) => i !== index))}
                >
                  Remove {label.toLowerCase()} field {index + 1}
                </Button>
              </Group>
            </Stack>
          </details>
        );
      })}
      <Button
        size="xs"
        variant="default"
        disabled={disabled || fields.length >= 40}
        onClick={() =>
          onChange([
            ...fields,
            {
              id: `field-${crypto.randomUUID().slice(0, 8)}`,
              name: `field${fields.length + 1}`,
              type: "unresolved",
              required: true,
              description: "",
            },
          ])
        }
      >
        Add {label.toLowerCase()} field
      </Button>
    </fieldset>
  );
}
