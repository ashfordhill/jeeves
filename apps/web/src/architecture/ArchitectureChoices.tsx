import {
  type Architecture,
  architectureKinds,
  architectureOperations,
  architectureOwnerships,
  type Classification,
  classificationSchema,
  containerClassification,
  type Element,
  systemChoiceLabels,
  systemChoiceOptions,
} from "@jeeves/spec";
import { Alert, NativeSelect, Stack, Text } from "@mantine/core";

export function ClassificationFields({
  value,
  element,
  onChange,
}: {
  value?: Classification;
  element: Element;
  onChange: (value: Classification) => void;
}) {
  const resolved = containerClassification({ ...element, classification: value });
  return (
    <Stack gap="sm">
      <Text size="sm">
        Logical responsibility and operation are independent of runtime compatibility. Managed
        hosting does not change the C4 level.
      </Text>
      <NativeSelect
        label="Architectural classification"
        data={[
          { value: "", label: "Use catalog classification" },
          ...architectureKinds.map((value) => ({ value, label: value })),
        ]}
        value={value?.kind ?? ""}
        onChange={(event) =>
          onChange({
            ...value,
            kind: (event.currentTarget.value || undefined) as Classification["kind"],
          })
        }
      />
      <NativeSelect
        label="Responsibility ownership"
        data={[
          { value: "", label: "Use catalog ownership" },
          ...architectureOwnerships.map((value) => ({ value, label: value })),
        ]}
        value={value?.ownership ?? ""}
        onChange={(event) =>
          onChange({
            ...value,
            ownership: (event.currentTarget.value || undefined) as Classification["ownership"],
          })
        }
      />
      <NativeSelect
        label="Operation"
        data={[
          { value: "", label: "Unspecified" },
          ...architectureOperations
            .filter((value) => value !== "Unspecified")
            .map((value) => ({ value, label: value })),
        ]}
        value={value?.operation === "Unspecified" ? "" : (value?.operation ?? "")}
        onChange={(event) =>
          onChange({
            ...value,
            operation: (event.currentTarget.value || undefined) as Classification["operation"],
          })
        }
      />
      {!classificationSchema.optional().safeParse(value).success ||
      (resolved.kind === "External system" && resolved.ownership === "System responsibility") ? (
        <Alert color="red" role="alert">
          An external system cannot be a system-owned responsibility. Choose Application or Data
          store.
        </Alert>
      ) : null}
    </Stack>
  );
}

export function SystemChoiceFields({
  system,
  onChange,
}: {
  system: Architecture["system"];
  onChange: (system: Architecture["system"]) => void;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm">
        Design intent. These choices do not configure access, storage or deployment.
      </Text>
      {(Object.keys(systemChoiceOptions) as (keyof typeof systemChoiceOptions)[]).map((key) => (
        <NativeSelect
          key={key}
          label={systemChoiceLabels[key]}
          data={[...systemChoiceOptions[key]]}
          value={system[key] ?? "Unspecified"}
          onChange={(event) => onChange({ ...system, [key]: event.currentTarget.value })}
        />
      ))}
    </Stack>
  );
}
