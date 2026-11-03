import {
  CONTRACT_NESTING_LIMIT,
  type ContractField,
  type ContractValue,
  contractTextConstraints,
  contractValueTypes,
} from "@jeeves/spec";
import {
  Button,
  Checkbox,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

import { useContractTypes } from "./ContractTypeScope.tsx";

export function ValueFields({
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
  const { types, navigate, target } = useContractTypes();
  const reference = value.ref ? `${value.ref.id}@${value.ref.version}` : "";
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
            ...(e.currentTarget.value === "tagged-union" ? { discriminator: "kind" } : {}),
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
      {value.type === "text" ? (
        <NativeSelect
          label={`${label} protocol constraint`}
          data={[{ value: "", label: "None" }, ...Object.keys(contractTextConstraints)]}
          value={value.textConstraint ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              textConstraint: (e.currentTarget.value ||
                undefined) as ContractValue["textConstraint"],
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
      {value.type === "unresolved" ? (
        <Text size="sm">Unresolved design value. Choose a type before compilation.</Text>
      ) : null}
      {value.type === "ref" ? (
        <>
          <NativeSelect
            label={`${label} exact type reference`}
            value={reference}
            data={[
              { value: "", label: "Unresolved · select a local type version" },
              ...types.map((t) => ({
                value: `${t.id}@${t.version}`,
                label: `${t.name} · ${t.version}`,
              })),
              ...(reference && !types.some((t) => `${t.id}@${t.version}` === reference)
                ? [{ value: reference, label: `${reference} · missing` }]
                : []),
            ]}
            onChange={(e) => {
              const t = types.find((t) => `${t.id}@${t.version}` === e.currentTarget.value);
              onChange({ ...value, ref: t ? { id: t.id, version: t.version } : undefined });
            }}
          />
          {reference ? (
            <Button
              component="a"
              href={`#${target}`}
              size="compact-xs"
              variant="subtle"
              onClick={(event) => {
                event.preventDefault();
                navigate(reference);
              }}
            >
              Open exact type definition
            </Button>
          ) : null}
        </>
      ) : null}
      {value.type === "map" ? (
        <>
          <Group grow>
            <NumberInput
              label={`${label} key minimum length`}
              value={value.keys?.minLength ?? ""}
              min={0}
              max={1e9}
              allowDecimal={false}
              onChange={(v) =>
                onChange({
                  ...value,
                  keys: {
                    maxLength: value.keys?.maxLength ?? 64,
                    minLength: typeof v === "number" ? v : undefined,
                  },
                })
              }
            />
            <NumberInput
              label={`${label} key maximum length`}
              value={value.keys?.maxLength ?? ""}
              min={1}
              max={1e9}
              allowDecimal={false}
              onChange={(v) =>
                onChange({
                  ...value,
                  keys: typeof v === "number" ? { ...value.keys, maxLength: v } : undefined,
                })
              }
            />
          </Group>
          <Group grow>
            {(["minEntries", "maxEntries"] as const).map((key) => (
              <NumberInput
                key={key}
                label={`${label} ${key}`}
                value={value[key] ?? ""}
                min={0}
                max={10000}
                allowDecimal={false}
                onChange={(v) =>
                  onChange({ ...value, [key]: typeof v === "number" ? v : undefined })
                }
              />
            ))}
          </Group>
          {depth < CONTRACT_NESTING_LIMIT ? (
            <fieldset className="contract-payload" disabled={disabled}>
              <legend>{label} map values</legend>
              <ValueFields
                label={`${label} map value`}
                value={value.values ?? { type: "unresolved" }}
                depth={depth + 1}
                disabled={disabled}
                onChange={(values) => onChange({ ...value, values })}
              />
            </fieldset>
          ) : null}
        </>
      ) : null}
      {value.type === "tagged-union" ? (
        <>
          <TextInput
            label={`${label} discriminator`}
            value={value.discriminator ?? ""}
            maxLength={64}
            onChange={(e) => onChange({ ...value, discriminator: e.currentTarget.value })}
          />
          <Text size="sm">
            Each variant needs a required discriminator field with one distinct allowed text value.
            At least two variants are required.
          </Text>
          {depth < CONTRACT_NESTING_LIMIT ? (
            <>
              {(value.variants ?? []).map((variant, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: schema variants are positional and controls are fully controlled
                <fieldset className="contract-payload" key={i} disabled={disabled}>
                  <legend>
                    {label} variant {i + 1}
                  </legend>
                  <ValueFields
                    label={`${label} variant ${i + 1}`}
                    value={variant}
                    depth={depth + 1}
                    disabled={disabled}
                    onChange={(next) =>
                      onChange({
                        ...value,
                        variants: value.variants?.map((v, n) => (n === i ? next : v)),
                      })
                    }
                  />
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    onClick={() =>
                      onChange({ ...value, variants: value.variants?.filter((_, n) => n !== i) })
                    }
                  >
                    Remove variant {i + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                size="xs"
                variant="default"
                disabled={disabled || (value.variants?.length ?? 0) >= 20}
                onClick={() =>
                  onChange({
                    ...value,
                    variants: [
                      ...(value.variants ?? []),
                      {
                        type: "object",
                        fields: [
                          {
                            id: `field-${crypto.randomUUID().slice(0, 8)}`,
                            name: value.discriminator ?? "kind",
                            type: "text",
                            enumValues: [`variant${(value.variants?.length ?? 0) + 1}`],
                            required: true,
                            description: "",
                          },
                        ],
                      },
                    ],
                  })
                }
              >
                Add union variant
              </Button>
            </>
          ) : null}
        </>
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
      {["object", "array", "map", "tagged-union"].includes(value.type) &&
      depth === CONTRACT_NESTING_LIMIT ? (
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
