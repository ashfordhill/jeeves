import {
  type Architecture,
  type BackendAccessPolicy,
  backendEntityFields,
  backendPolicyConsumers,
  backendRecheckSiteSchema,
  contractKey,
  type DesignDocument,
  validateBackendPolicyTransition,
} from "@jeeves/spec";
import { Alert, Button, NativeSelect, Stack, TagsInput, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import {
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  Many,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";
import { newPolicyClause, PolicyClauseFields } from "./PolicyClauseFields.tsx";
import { PolicyDesignPreview } from "./PolicyDesignPreview.tsx";
export function policyProtected(base: DesignDocument, p: BackendAccessPolicy) {
  const original = base.architecture?.backend?.accessPolicies?.find(
    (v) => contractKey(v) === contractKey(p),
  );
  if (!original || !base.architecture?.backend) return false;
  return (
    validateBackendPolicyTransition(base, {
      ...base,
      architecture: {
        ...base.architecture,
        backend: {
          ...base.architecture.backend,
          accessPolicies: base.architecture.backend.accessPolicies?.filter((v) => v !== original),
        },
      },
    }).length > 0
  );
}
export function BackendPolicyEditor({
  design,
  draft,
  policy: p,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  policy: BackendAccessPolicy;
  onChange: (p: BackendAccessPolicy) => void;
  navigate: DataNavigation;
}) {
  const [section, setSection] = useState("context");
  const locked = policyProtected(design, p);
  const service = p.context.service;
  const entities = draft.backend?.entities ?? [];
  const resource = entities.find((e) => contractKey(e) === contractKey(p.resource));
  const document = { ...design, architecture: draft };
  const fields = resource ? backendEntityFields(document, resource) : [];
  const uses = backendPolicyConsumers(document, p);
  const update = (patch: Partial<BackendAccessPolicy>) => onChange({ ...p, ...patch });
  const condition = (
    label: string,
    value: BackendAccessPolicy["rules"][number]["when"],
    change: (v: typeof value) => void,
  ) => (
    <>
      <NativeSelect
        label={`${label} operator`}
        data={["all", "any"]}
        value={value.operator}
        onChange={(e) =>
          change({ ...value, operator: e.currentTarget.value as typeof value.operator })
        }
      />
      <Many
        label={`${label} clauses`}
        value={value.clauses}
        max={20}
        options={p.clauses.map((c) => ({ value: c.id, label: `${c.id} · ${c.kind}` }))}
        onChange={(clauses) => change({ ...value, clauses })}
      />
    </>
  );
  return (
    <Stack gap="sm">
      <RecordHeader
        label="Policy"
        name={p.name}
        version={p.version}
        versionDisabled={locked}
        onChange={update}
      />
      <Text size="xs">
        Exact policy: {contractKey(p)} · resource: {contractKey(p.resource)}
      </Text>
      {locked ? (
        <Alert>
          Referenced policy version is protected. Create a policy successor and explicitly review
          consumers before retargeting. The display name remains editable.
        </Alert>
      ) : null}
      <NativeSelect
        label="Policy section"
        value={section}
        data={[
          { value: "context", label: "Resource & trusted context" },
          { value: "clauses", label: "Finite clauses" },
          { value: "rules", label: "Allow / deny rules" },
          { value: "projections", label: "Read / write field projections" },
          { value: "rechecks", label: "Revocation rechecks" },
          { value: "uses", label: "Affected paths & reuse" },
          { value: "preview", label: "Design preview" },
        ]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      {["context", "clauses", "rules", "projections", "rechecks"].includes(section) ? (
        <fieldset disabled={locked} className="policy-edit-fields">
          <Stack gap="sm">
            {section === "context" ? (
              <>
                <Pick
                  label="Protected resource entity"
                  value={contractKey(p.resource)}
                  options={namedOptions(entities)}
                  onChange={(v) => {
                    const e = entities.find((e) => contractKey(e) === v);
                    if (e)
                      update({
                        resource: exact(e),
                        context: {
                          ...p.context,
                          scope: e.scope.kind === "field" ? "authorized-scope" : "global",
                        },
                      });
                  }}
                />
                <NativeSelect
                  label="Trusted identity"
                  data={["public", "session-principal", "verified-service"]}
                  value={p.context.identity}
                  onChange={(e) => {
                    const identity = e.currentTarget.value as typeof p.context.identity;
                    update({
                      context: {
                        ...p.context,
                        identity,
                        service:
                          identity === "verified-service"
                            ? {
                                purpose: "unselected",
                                authority: "server-service-identity",
                                scope:
                                  p.context.scope === "authorized-scope"
                                    ? "authorized-scope"
                                    : "selected-resource",
                                initiatingActor: "provenance-only",
                              }
                            : undefined,
                      },
                    });
                  }}
                />
                <NativeSelect
                  label="Trusted resource scope"
                  data={["global", "authorized-scope"]}
                  value={p.context.scope}
                  onChange={(e) =>
                    update({
                      context: {
                        ...p.context,
                        scope: e.currentTarget.value as typeof p.context.scope,
                      },
                    })
                  }
                />
                {service ? (
                  <>
                    <TextInput
                      label="Verified service purpose"
                      maxLength={63}
                      value={service.purpose}
                      onChange={(e) =>
                        update({
                          context: {
                            ...p.context,
                            service: { ...service, purpose: e.currentTarget.value },
                          },
                        })
                      }
                    />
                    <NativeSelect
                      label="Bounded service scope"
                      data={["selected-resource", "authorized-scope"]}
                      value={service.scope}
                      onChange={(e) =>
                        update({
                          context: {
                            ...p.context,
                            service: {
                              ...service,
                              scope: e.currentTarget.value as
                                | "selected-resource"
                                | "authorized-scope",
                            },
                          },
                        })
                      }
                    />
                  </>
                ) : null}
                <Text size="sm">
                  Authentication and correlation are server established. The server authorizes the
                  selected workspace/organization scope before rules. Body fields, raw headers,
                  cursors, queue payloads and client roles provide no authority. Service identity
                  uses an explicit purpose; an initiating actor is provenance only. Network privacy
                  grants no access.
                </Text>
                <Text size="sm">
                  Default deny and deny wins are fixed. Read visibility and allowed writes are
                  separate. Unknown writes are rejected.
                </Text>
              </>
            ) : null}
            {section === "clauses" ? (
              <DataRows<BackendAccessPolicy["clauses"][number]>
                label="Clause"
                rows={p.clauses}
                max={20}
                create={() => newPolicyClause("authenticated", dataId("clause"), p)}
                onChange={(clauses) => update({ clauses })}
              >
                {(c, _i, change) => (
                  <PolicyClauseFields
                    design={design}
                    draft={draft}
                    policy={p}
                    clause={c}
                    onChange={change}
                    navigate={navigate}
                  />
                )}
              </DataRows>
            ) : null}
            {section === "rules" ? (
              <DataRows<BackendAccessPolicy["rules"][number]>
                label="Rule"
                rows={p.rules}
                max={20}
                create={() => ({
                  id: dataId("rule"),
                  effect: "allow",
                  actions: ["read"],
                  when: { operator: "all", clauses: p.clauses.slice(0, 1).map((c) => c.id) },
                })}
                onChange={(rules) => update({ rules })}
              >
                {(r, i, change) => (
                  <>
                    <Text size="xs">Rule identity: {r.id}</Text>
                    <NativeSelect
                      label={`Rule ${i + 1} effect`}
                      data={["allow", "deny"]}
                      value={r.effect}
                      onChange={(e) =>
                        change({ ...r, effect: e.currentTarget.value as typeof r.effect })
                      }
                    />
                    <TagsInput
                      label={`Rule ${i + 1} actions`}
                      value={r.actions}
                      maxTags={20}
                      onChange={(actions) => change({ ...r, actions })}
                    />
                    {condition(`Rule ${i + 1}`, r.when, (when) => change({ ...r, when }))}
                  </>
                )}
              </DataRows>
            ) : null}
            {section === "projections" ? (
              <DataRows<BackendAccessPolicy["projections"][number]>
                label="Projection"
                rows={p.projections}
                max={20}
                create={() => ({
                  id: dataId("projection"),
                  mode: "read",
                  fields: [],
                  when: { operator: "all", clauses: p.clauses.slice(0, 1).map((c) => c.id) },
                  unknownFields: "reject",
                })}
                onChange={(projections) => update({ projections })}
              >
                {(r, i, change) => (
                  <>
                    <Text size="xs">Projection identity: {r.id}</Text>
                    <NativeSelect
                      label={`Projection ${i + 1} mode`}
                      data={["read", "write"]}
                      value={r.mode}
                      onChange={(e) =>
                        change({ ...r, mode: e.currentTarget.value as typeof r.mode })
                      }
                    />
                    <Many
                      label={`Projection ${i + 1} fields`}
                      value={r.fields}
                      options={fields
                        .filter(
                          (f) =>
                            r.mode === "read" ||
                            !resource?.fields.find((a) => a.field === f.id)?.serverOwned,
                        )
                        .map((f) => ({ value: f.id, label: f.name }))}
                      onChange={(fields) => change({ ...r, fields })}
                    />
                    {condition(`Projection ${i + 1}`, r.when, (when) => change({ ...r, when }))}
                    <Text size="xs">
                      Unknown fields: reject. An action allow and a matching projection condition
                      are both required.
                    </Text>
                  </>
                )}
              </DataRows>
            ) : null}
            {section === "rechecks" ? (
              <>
                <Many
                  label="Current-state recheck sites"
                  value={p.revocation.recheck}
                  max={9}
                  options={backendRecheckSiteSchema.options.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(recheck) =>
                    update({
                      revocation: {
                        ...p.revocation,
                        recheck: recheck as typeof p.revocation.recheck,
                      },
                    })
                  }
                />
                <Text size="sm">
                  Current state at each sensitive observation/effect; no authorization cache.
                  Recheck before byte delivery, materialization, export, background work and
                  returning an idempotent receipt. Earlier access or a former actor's roles grant
                  nothing.
                </Text>
              </>
            ) : null}
          </Stack>
        </fieldset>
      ) : null}
      {section === "clauses" && locked
        ? p.clauses.flatMap((c) =>
            "entity" in c
              ? [
                  <Button
                    key={c.id}
                    variant="subtle"
                    onClick={() => navigate("entities", contractKey(c.entity))}
                  >
                    Open {c.id} persisted entity
                  </Button>,
                ]
              : [],
          )
        : null}
      {section === "context" ? (
        <Button variant="subtle" onClick={() => navigate("entities", contractKey(p.resource))}>
          Open policy resource entity
        </Button>
      ) : null}
      {section === "uses" ? (
        <section aria-label="Affected policy paths">
          <Text size="sm">
            Consumers select this exact version. Successors do not retarget them. Query fields
            include hidden filters, sorting and cursors; access precedes joins, pagination, counts,
            snippets and output. Byte and output sites recheck current policy independently.
          </Text>
          {uses.length ? (
            uses.map((u) => (
              <div className="policy-group" key={u.path}>
                <Text fw={700} size="sm">
                  {u.label} · {u.resolved ? "selected" : "unresolved intent"}
                </Text>
                <Text size="xs">{u.path}</Text>
                <Text size="sm">
                  {u.site ?? "Configured capability sites"} · action{" "}
                  {u.action ?? "see exact settings"} · projection{" "}
                  {u.projection ?? "unselected / see settings"}
                </Text>
                <Text size="sm">
                  Observed fields: {u.fields.join(", ") || "see exact output/settings mappings"}
                </Text>
                {u.outputPaths?.length ? (
                  <Text size="sm">
                    Declared output paths: {u.outputPaths.join(", ")}. Output fields still require
                    their own access checks.
                  </Text>
                ) : null}
                {u.kind === "query" || u.kind === "access-binding" ? (
                  <Button
                    variant="subtle"
                    onClick={() =>
                      navigate(
                        u.kind === "query" ? "queries" : "accessBindings",
                        contractKey(u.reference),
                      )
                    }
                  >
                    Open {u.kind === "query" ? "query" : "access use"} {u.label}
                  </Button>
                ) : (
                  <Text size="xs">
                    Operation/capability editors follow in P68; inspect their exact declarations in
                    the design.
                  </Text>
                )}
              </div>
            ))
          ) : (
            <Text size="sm">
              No consumers select this exact version. Reuse it from a query or an access use.
            </Text>
          )}
        </section>
      ) : null}
      {section === "preview" ? <PolicyDesignPreview key={contractKey(p)} policy={p} /> : null}
    </Stack>
  );
}
