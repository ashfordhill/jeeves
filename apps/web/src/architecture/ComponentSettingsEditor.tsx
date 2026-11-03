import {
  type Architecture,
  type ArchitectureComponent,
  architectureSchema,
  type BackendCapabilityConfig,
  backendCapabilityConfigSchema,
  backendCapabilityExactReferences,
  contractKey,
  type DesignDocument,
  isStructural,
  validateBackendCapabilityConfigs,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  type BackendNavigation,
  type BackendNavigationRequest,
  ReferenceLinks,
} from "./BackendEffectFields.tsx";
import { dataId, namedOptions, Pick } from "./BackendFields.tsx";
import { BackendSettingFields } from "./BackendSettingFields.tsx";
import {
  settingGroups,
  settingKinds,
  settingLabel,
  settingSchema,
  settingSeed,
} from "./BackendSettingSchema.ts";

export function ComponentSettingsEditor({
  design,
  draft,
  component,
  onChange,
  navigate,
  navigation,
}: {
  design: DesignDocument;
  draft: Architecture;
  component: ArchitectureComponent;
  onChange: (v: Architecture) => void;
  navigate: BackendNavigation;
  navigation?: BackendNavigationRequest;
}) {
  const [selected, select] = useState("");
  const [kind, setKind] = useState<BackendCapabilityConfig["kind"]>("delivery");
  const [section, setSection] = useState("0");
  const [successor, setSuccessor] = useState("");
  const [inspection, setInspection] = useState<{ kind: "interfaces" | "bindings"; key: string }>();
  useEffect(() => {
    if (navigation?.kind === "interfaces" || navigation?.kind === "bindings")
      setInspection({ kind: navigation.kind, key: navigation.key });
    else setInspection(undefined);
  }, [navigation]);
  const model = draft.backend ?? { schemaVersion: 1 as const, entities: [], aggregates: [] };
  const configs = model.capabilityConfigs ?? [];
  const current = configs.find((c) => contractKey(c) === selected);
  const update = (values: BackendCapabilityConfig[]) =>
    onChange({ ...draft, backend: { ...model, capabilityConfigs: values } });
  const change = (patch: Partial<BackendCapabilityConfig>) =>
    update(
      configs.map((c) => (c === current ? ({ ...c, ...patch } as BackendCapabilityConfig) : c)),
    );
  const navigationKind = configs.find((c) => contractKey(c) === navigation?.key)?.kind;
  useEffect(() => {
    if (navigation?.kind !== "capabilityConfigs") return;
    select(navigation.key);
    if (navigationKind) {
      const requested = String(navigation.path?.[0]);
      const field =
        requested === "access" && navigationKind === "files" ? "parentAccess" : requested;
      const index = (settingGroups[navigationKind] ?? []).findIndex((g) => g.includes(field));
      setSection(String(index < 0 ? 0 : index));
    }
  }, [navigation, navigationKind]);
  const original = design.architecture?.backend?.capabilityConfigs?.find(
    (c) => contractKey(c) === selected,
  );
  const protectedVersion =
    !!original &&
    (original.kind === "calendar" ||
      design.architecture?.backend?.capabilityConfigs?.some((c) =>
        backendCapabilityExactReferences(c).some(
          (r) => r.collection === "capabilityConfigs" && contractKey(r.reference) === selected,
        ),
      ));
  const visible = configs.filter(
    (c) =>
      contractKey(c) === selected ||
      (c.owner.kind === "component" && c.owner.id === component.id) ||
      (c.owner.kind === "element" && c.owner.id === component.element),
  );
  const parsed = architectureSchema.safeParse(draft);
  const findings = parsed.success
    ? validateBackendCapabilityConfigs({ ...design, architecture: parsed.data }).filter(
        (f) => f.target.path?.[3] === selected,
      )
    : [];
  const schema = current && settingSchema(current.kind);
  const groups = current ? (settingGroups[current.kind] ?? []) : [];
  const active = groups[Number(section)] ?? groups[0] ?? [];
  const issues = current ? backendCapabilityConfigSchema.safeParse(current) : undefined;
  return (
    <Stack gap="md">
      <Text size="sm">
        Typed capability settings describe design intent. Template support, provider availability
        and observed verification are separate. No configured work executes here.
      </Text>
      {inspection ? (
        <section className="policy-group" aria-label="Exact provider definition">
          <Text fw={600}>
            Exact provider {inspection.kind === "interfaces" ? "interface" : "binding"}:{" "}
            {inspection.key}
          </Text>
          {inspection.kind === "interfaces"
            ? (() => {
                const v = draft.interfaces?.find((v) => v.id === inspection.key);
                return v ? (
                  <>
                    <Text size="sm">
                      {v.name} · {v.direction} · {v.owner.kind}/{v.owner.id} ·{" "}
                      {contractKey(v.contract)}
                    </Text>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => navigate("contracts", contractKey(v.contract))}
                    >
                      Open provider interface contract
                    </Button>
                  </>
                ) : (
                  <Text>Missing exact interface</Text>
                );
              })()
            : (() => {
                const v = draft.bindings?.find((v) => v.id === inspection.key);
                return v ? (
                  <>
                    <Text size="sm">
                      {v.name} · operation {v.operation} · {v.role} · {v.relationship.kind}/
                      {v.relationship.id}
                    </Text>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => navigate("interfaces", v.provided)}
                    >
                      Open binding provided interface
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => navigate("interfaces", v.required)}
                    >
                      Open binding required interface
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => navigate("contracts", contractKey(v.contract))}
                    >
                      Open provider binding contract
                    </Button>
                  </>
                ) : (
                  <Text>Missing exact binding</Text>
                );
              })()}
          <Button size="xs" variant="default" onClick={() => setInspection(undefined)}>
            Return to settings
          </Button>
        </section>
      ) : null}
      <Pick
        label="Settings definition"
        value={selected}
        options={namedOptions(visible)}
        onChange={(v) => {
          select(v);
          setSection("0");
          setSuccessor("");
        }}
      />
      <Group align="end">
        <NativeSelect
          label="New settings kind"
          value={kind}
          data={settingKinds.map((v) => ({ value: v, label: settingLabel(v) }))}
          onChange={(e) => setKind(e.currentTarget.value as typeof kind)}
        />
        <Button
          variant="default"
          size="xs"
          disabled={configs.length >= 100}
          onClick={() => {
            const next = {
              ...(settingSeed(settingSchema(kind)) as BackendCapabilityConfig),
              id: dataId(kind),
              version: "v1",
              name: `${settingLabel(kind)} settings`,
              owner: { kind: "component" as const, id: component.id },
            };
            update([...configs, next]);
            select(contractKey(next));
            setSection("0");
            setSuccessor("");
          }}
        >
          Add settings
        </Button>
      </Group>
      {current && schema ? (
        <>
          <Text size="xs">
            {current.kind} · {contractKey(current)} · owner {current.owner.kind}/{current.owner.id}
          </Text>
          <TextInput
            label="Settings name"
            maxLength={120}
            value={current.name}
            onChange={(e) => change({ name: e.currentTarget.value })}
          />
          {protectedVersion ? (
            <Alert title="Protected settings version">
              Saved calendars and referenced settings preserve their semantics. Create a successor,
              then retarget each intended consumer explicitly. Existing consumers keep {selected}.
            </Alert>
          ) : null}
          <Group align="end">
            <TextInput
              label="Settings successor version"
              maxLength={40}
              value={successor}
              onChange={(e) => setSuccessor(e.currentTarget.value)}
            />
            <Button
              size="xs"
              variant="default"
              disabled={
                !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(successor) ||
                configs.length >= 100 ||
                configs.some((c) => c.id === current.id && c.version === successor)
              }
              onClick={() => {
                const next = { ...structuredClone(current), version: successor };
                update([...configs, next]);
                select(contractKey(next));
                setSuccessor("");
              }}
            >
              Create settings successor
            </Button>
          </Group>
          <NativeSelect
            label="Settings section"
            value={section === "requirements" ? section : String(groups.indexOf(active))}
            data={[
              ...groups.map((g, i) => ({
                value: String(i),
                label: g.map(settingLabel).join(" / "),
              })),
              { value: "requirements", label: "Fixed requirements" },
            ]}
            onChange={(e) => setSection(e.currentTarget.value)}
          />
          <fieldset disabled={protectedVersion} className="backend-settings-fields">
            <legend>
              {section === "requirements"
                ? "Fixed requirements"
                : active.map(settingLabel).join(" / ")}
            </legend>
            <Stack gap="md">
              {Object.entries(schema.properties ?? {})
                .filter(([k, s]) =>
                  section === "requirements"
                    ? s.const !== undefined && !["kind", "schemaVersion"].includes(k)
                    : active.includes(k),
                )
                .map(([k, s]) => {
                  const value = (current as unknown as Record<string, unknown>)[k],
                    optional = !schema.required?.includes(k);
                  return (
                    <section
                      key={k}
                      className="backend-setting-group"
                      aria-label={`${settingLabel(current.kind)} ${settingLabel(k)}`}
                    >
                      {optional && value === undefined ? (
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => change({ [k]: settingSeed(s) })}
                        >
                          Add {settingLabel(k)}
                        </Button>
                      ) : (
                        <>
                          <BackendSettingFields
                            schema={s}
                            value={value}
                            path={[k]}
                            config={current}
                            draft={draft}
                            design={design}
                            navigate={navigate}
                            onChange={(v) => change({ [k]: v })}
                          />
                          {optional ? (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                const next = { ...current } as unknown as Record<string, unknown>;
                                delete next[k];
                                update(
                                  configs.map((c) =>
                                    c === current
                                      ? (next as unknown as BackendCapabilityConfig)
                                      : c,
                                  ),
                                );
                              }}
                            >
                              Remove {settingLabel(k)}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </section>
                  );
                })}
            </Stack>
          </fieldset>
          <details>
            <summary>Referenced definitions</summary>
            {[...new Set(backendCapabilityExactReferences(current).map((r) => r.collection))].map(
              (collection) => (
                <ReferenceLinks
                  key={collection}
                  label={`Settings ${collection}`}
                  refs={backendCapabilityExactReferences(current)
                    .filter((r) => r.collection === collection)
                    .map((r) => r.reference)}
                  items={
                    collection === "contracts" ? (draft.contracts ?? []) : (model[collection] ?? [])
                  }
                  kind={
                    collection === "accessPolicies"
                      ? "policies"
                      : (collection as Parameters<BackendNavigation>[0])
                  }
                  navigate={navigate}
                />
              ),
            )}
          </details>
          {issues && !issues.success ? (
            <Alert color="red" title="Settings schema diagnostics">
              <Stack gap="xs">
                {issues.error.issues.map((i) => (
                  <Text key={`${i.path.join("/")}/${i.message}`} size="sm">
                    {i.path.map(String).join(" / ")}: {i.message}
                  </Text>
                ))}
              </Stack>
            </Alert>
          ) : null}
          {findings.length ? (
            <Alert
              color={findings.some(isStructural) ? "red" : "yellow"}
              title="Settings decisions"
              styles={{ label: { color: "var(--ink)" } }}
            >
              <Stack gap="xs">
                {findings.map((f) => (
                  <Text key={`${f.target.path?.join("/")}/${f.message}`} size="sm">
                    {f.target.path?.slice(4).join(" / ")}: {f.message}
                  </Text>
                ))}
              </Stack>
            </Alert>
          ) : null}
          <Button
            size="xs"
            color="red"
            variant="subtle"
            disabled={protectedVersion}
            onClick={() => {
              update(configs.filter((c) => c !== current));
              select("");
            }}
          >
            Remove settings
          </Button>
        </>
      ) : (
        <Text size="sm">Choose an exact settings definition or add a bounded declaration.</Text>
      )}
    </Stack>
  );
}
