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
      {(() => {
        const render = (
          field: NonNullable<ReturnType<typeof plannedCapability>>["fields"][number],
        ) => {
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
        };
        const fields = plannedCapability(capability)?.fields ?? [];
        const workload = new Set(["workloadShape", "peakRate", "workloadUnit", "p95LatencyMs"]);
        return (
          <>
            {fields
              .filter((field) => !workload.has(field.key) && field.key !== "tenancy")
              .map(render)}
            {fields.some((field) => workload.has(field.key)) ? (
              <details className="capability-field-group">
                <summary>Traffic & performance targets</summary>
                <p>Planning assumptions. Record measurement boundaries under Data & objectives.</p>
                <Stack gap="sm">
                  {fields.filter((field) => workload.has(field.key)).map(render)}
                </Stack>
              </details>
            ) : null}
            {fields.some((field) => field.key === "tenancy") ? (
              <details className="capability-field-group">
                <summary>Legacy tenancy settings</summary>
                {fields.filter((field) => field.key === "tenancy").map(render)}
              </details>
            ) : null}
          </>
        );
      })()}
    </Stack>
  );
}
