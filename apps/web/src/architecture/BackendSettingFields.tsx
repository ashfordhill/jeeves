import {
  type Architecture,
  type BackendCapabilityConfig,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Button, NativeSelect, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { type BackendNavigation, ExactPick } from "./BackendEffectFields.tsx";
import { DataRows, exact, Pick } from "./BackendFields.tsx";
import { row, settingLocalOptions, settingReferences } from "./BackendSettingReferences.ts";
import {
  requireSetting,
  type SettingSchema,
  settingLabel,
  settingSeed,
} from "./BackendSettingSchema.ts";

export function BackendSettingFields({
  schema,
  value,
  path,
  config,
  draft,
  design,
  onChange,
  navigate,
}: {
  schema: SettingSchema;
  value: unknown;
  path: (string | number)[];
  config: BackendCapabilityConfig;
  draft: Architecture;
  design: DesignDocument;
  onChange: (v: unknown) => void;
  navigate: BackendNavigation;
}) {
  const label = path
    .map((v) => (typeof v === "number" ? String(v + 1) : settingLabel(v)))
    .join(" · ");
  const last = path.at(-1);
  const parent = path
    .slice(0, typeof last === "number" ? -2 : -1)
    .reduce<unknown>((v, k) => row(v)[k], config);
  const common = { config, draft, design, navigate };
  const child = (
    s: SettingSchema,
    v: unknown,
    p: (string | number)[],
    change: (v: unknown) => void,
  ) => <BackendSettingFields {...common} schema={s} value={v} path={p} onChange={change} />;
  if (schema.oneOf) {
    const variants = schema.oneOf;
    const discriminator =
      Object.keys(variants[0]?.properties ?? {}).find((k) =>
        variants.every((s) => s.properties?.[k]?.const !== undefined),
      ) ?? "kind";
    const active =
      variants.find((s) => s.properties?.[discriminator]?.const === row(value)[discriminator]) ??
      requireSetting(variants[0]);
    return (
      <Stack gap="sm">
        <NativeSelect
          label={`${label} choice`}
          value={String(active.properties?.[discriminator]?.const)}
          data={variants.map((s) => ({
            value: String(s.properties?.[discriminator]?.const),
            label: settingLabel(String(s.properties?.[discriminator]?.const)),
          }))}
          onChange={(e) =>
            onChange(
              settingSeed(
                requireSetting(
                  variants.find(
                    (s) => String(s.properties?.[discriminator]?.const) === e.currentTarget.value,
                  ),
                ),
              ),
            )
          }
        />
        {Object.entries(active.properties ?? {})
          .filter(([k]) => k !== discriminator)
          .map(([k, s]) => (
            <div key={k}>
              {child(s, row(value)[k], [...path, k], (v) => onChange({ ...row(value), [k]: v }))}
            </div>
          ))}
      </Stack>
    );
  }
  if (schema.type === "object" && schema.properties?.id && schema.properties?.version) {
    const ref = settingReferences(config).find((r) => r.reference === value);
    const collection = ref?.collection;
    const items =
      collection === "contracts"
        ? (draft.contracts ?? [])
        : collection
          ? (draft.backend?.[collection] ?? [])
          : [];
    const kind = collection === "accessPolicies" ? "policies" : collection;
    const expectedKind =
      last === "calendar"
        ? "calendar"
        : last === "money"
          ? "money"
          : last === "cart"
            ? "cart"
            : last === "inventory"
              ? "inventory"
              : last === "order"
                ? "order"
                : last === "payment"
                  ? "payment"
                  : last === "config"
                    ? "business-time"
                    : collection === "capabilityConfigs"
                      ? "delivery"
                      : undefined;
    const filtered = expectedKind
      ? items.filter((v) => "kind" in v && v.kind === expectedKind)
      : items;
    return (
      <ExactPick
        label={label}
        value={value as { id: string; version: string }}
        items={filtered}
        onChange={(v) => onChange(exact(v))}
        onOpen={
          kind
            ? () => navigate(kind, contractKey(value as { id: string; version: string }))
            : undefined
        }
      />
    );
  }
  if (schema.type === "object")
    return (
      <Stack gap="sm">
        {Object.entries(schema.properties ?? {}).map(([k, s]) => {
          const optional = !schema.required?.includes(k),
            current = row(value)[k];
          return (
            <div key={k}>
              {optional && current === undefined ? (
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => onChange({ ...row(value), [k]: settingSeed(s) })}
                >
                  Add {label} · {settingLabel(k)}
                </Button>
              ) : (
                <>
                  {child(s, current, [...path, k], (v) => onChange({ ...row(value), [k]: v }))}
                  {optional ? (
                    <Button
                      size="compact-xs"
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        const next = { ...row(value) };
                        delete next[k];
                        onChange(next);
                      }}
                    >
                      Remove {label} · {settingLabel(k)}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </Stack>
    );
  if (schema.type === "array")
    return (
      <DataRows<{ value: unknown }>
        label={label}
        rows={(Array.isArray(value) ? value : []).map((value) => ({ value }))}
        max={schema.maxItems ?? 100}
        create={() => ({ value: settingSeed(requireSetting(schema.items)) })}
        onChange={(rows) => onChange(rows.map((r) => r.value))}
      >
        {(v, i, change) =>
          child(requireSetting(schema.items), v.value, [...path, i], (value) => change({ value }))
        }
      </DataRows>
    );
  if (schema.const !== undefined)
    return (
      <Text size="sm">
        {label}: <strong>{settingLabel(String(schema.const))}</strong>
      </Text>
    );
  if (schema.enum)
    return (
      <NativeSelect
        label={label}
        value={String(value ?? "")}
        data={schema.enum.map((v) => ({ value: v, label: settingLabel(v) }))}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  if (schema.type === "number" || schema.type === "integer")
    return (
      <NumberInput
        label={label}
        description={`${schema.minimum ?? 0}–${schema.maximum ?? Number.MAX_SAFE_INTEGER}`}
        value={typeof value === "number" ? value : ""}
        min={schema.minimum}
        max={schema.maximum}
        allowDecimal={false}
        clampBehavior="none"
        onChange={(v) => onChange(typeof v === "number" ? v : 0)}
      />
    );
  const local = settingLocalOptions({ design, draft, config, parent, path });
  if (local)
    return (
      <Pick
        label={label}
        value={String(value ?? "")}
        options={local.options}
        onChange={onChange}
        onOpen={
          local.open
            ? () => {
                if (local.open) navigate(local.open.kind, local.open.key);
              }
            : undefined
        }
      />
    );
  return (
    <TextInput
      label={label}
      value={String(value ?? "")}
      maxLength={schema.maxLength ?? 120}
      type={last === "date" ? "date" : "text"}
      description={
        last === "timezone"
          ? "IANA timezone, for example America/Chicago"
          : last === "credentialRef"
            ? "Private credential registry identity; never a credential value"
            : undefined
      }
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
