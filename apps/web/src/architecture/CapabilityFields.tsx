import { type ConfigValues, plannedCapability } from "@jeeves/spec";
import { NativeSelect, NumberInput, Stack, Switch, TextInput } from "@mantine/core";

/** The planning catalog owns both options and their field labels. No raw JSON menu. */
export function CapabilityFields({
  capability,
  config,
  onChange,
}: {
  capability: string;
  config: ConfigValues;
  onChange: (config: ConfigValues) => void;
}) {
  return (
    <Stack gap="sm">
      {plannedCapability(capability)?.fields.map((field) => {
        const value = config[field.key] ?? field.default;
        const change = (next: unknown) => onChange({ ...config, [field.key]: next });
        const common = { label: field.label, description: field.description, size: "sm" };
        if (field.options)
          return (
            <NativeSelect
              key={field.key}
              {...common}
              data={[...field.options]}
              value={String(value)}
              onChange={(event) => change(event.currentTarget.value)}
            />
          );
        if (typeof field.default === "boolean")
          return (
            <Switch
              key={field.key}
              {...common}
              checked={Boolean(value)}
              onChange={(event) => change(event.currentTarget.checked)}
            />
          );
        if (typeof field.default === "number")
          return (
            <NumberInput
              key={field.key}
              {...common}
              min={0}
              max={1_000_000_000}
              allowDecimal={false}
              value={typeof value === "number" ? value : ""}
              onChange={change}
            />
          );
        return (
          <TextInput
            key={field.key}
            {...common}
            value={String(value)}
            onChange={(event) => change(event.currentTarget.value)}
          />
        );
      })}
    </Stack>
  );
}
