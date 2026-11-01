import { builtinRegistry } from "@jeeves/registry";
import {
  type Architecture,
  type ArchitectureReviewFinding,
  architectureReview,
  architectureSchema,
  type BindingRelationship,
  contractKey,
  type DesignDocument,
  type RelationshipBinding,
  type RelationshipPolicies,
  sameBindingRelationship,
  validateArchitecture,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

export const architectureId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export const tenantChoices = ["Unknown", "Public", "Tenant scoped", "Cross tenant"];
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      label={label}
      value={value}
      data={options}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
export function Amount({
  label,
  value,
  onChange,
  max = 31_536_000,
  min = 0,
}: {
  label: string;
  value?: number;
  max?: number;
  min?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <NumberInput
      label={label}
      description="Blank means unknown"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(value) => onChange(typeof value === "number" ? value : undefined)}
    />
  );
}

/** Shared atomic draft shell retains its opening revision even after a server conflict. */
export function useArchitectureDraft(design: DesignDocument, onClose: () => void) {
  const [base] = useState(() => structuredClone(design));
  const [draft, setDraft] = useState<Architecture>(() =>
    structuredClone(
      design.architecture ?? {
        system: { name: "System", description: "" },
        nodes: [],
        relationships: [],
      },
    ),
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const parsed = architectureSchema.safeParse(draft);
  const structural = parsed.success
    ? validateArchitecture({ ...base, architecture: parsed.data }, builtinRegistry()).filter(
        (item) => item.severity === "error" && item.code !== "NEEDS_TEMPLATE",
      )
    : [];
  const issues = parsed.success
    ? structural.map((item) => item.message)
    : parsed.error.issues.map((item) => `${item.path.join(".")}: ${item.message}`);
  const review = parsed.success ? architectureReview({ ...base, architecture: parsed.data }) : [];
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== base.revision) {
      setError(
        "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([{ op: "setArchitecture", architecture: draft }]);
    setSaving(false);
    if (ok) onClose();
    else setError(useDraw.getState().notice?.message ?? "Could not save architecture.");
  };
  return { draft, setDraft, error, saving, issues, review, save };
}
export function ArchitectureDraftErrors({ error, issues }: { error?: string; issues: string[] }) {
  return (
    <>
      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : null}
      {issues.length ? (
        <Alert color="red" role="alert">
          {[...new Set(issues)].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </Alert>
      ) : null}
    </>
  );
}

const relatedReview = (review: ArchitectureReviewFinding[], bindings: RelationshipBinding[]) =>
  review.filter((item) =>
    bindings.some(
      (binding) =>
        binding.id === item.binding ||
        binding.required === item.interface ||
        binding.provided === item.interface ||
        contractKey(binding.contract) === item.contract,
    ),
  );

export function BindingSummary({ relationship }: { relationship: BindingRelationship }) {
  const design = useDraw((state) => state.loaded)!.design;
  const [open, setOpen] = useState(false);
  const bindings =
    design.architecture?.bindings?.filter((item) =>
      sameBindingRelationship(item.relationship, relationship),
    ) ?? [];
  const review = relatedReview(architectureReview(design), bindings);
  return (
    <section className="interface-summary" aria-label="Relationship contracts and policies">
      <h3>Contracts and policies</h3>
      {bindings.length ? (
        <ul>
          {bindings.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {item.role} · {contractKey(item.contract)} · {item.businessSynchrony}
              </span>
              <span>{item.transport ?? "Transport unspecified"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No interface bindings declared.</p>
      )}
      {review.map((item) => (
        <p className="contract-review" key={`${item.code}:${item.message}`}>
          {item.message}
        </p>
      ))}
      <Button variant="default" fullWidth onClick={() => setOpen(true)}>
        Manage relationship contracts
      </Button>
      {open ? (
        <RelationshipBindings
          design={design}
          relationship={relationship}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

const policyDefaults: Required<RelationshipPolicies> = {
  access: { identity: "Unknown", tenant: "Unknown", network: "Unknown" },
  failure: { outcome: "Unknown", detail: "" },
  retry: { idempotency: "Unknown", key: "" },
  delivery: { guarantee: "Unknown", ordering: "Unknown", acknowledgement: "Unknown" },
  freshness: { invalidation: "Unknown", detail: "" },
};
function PolicyFields({
  policies,
  onChange,
}: {
  policies: RelationshipPolicies;
  onChange: (policies: RelationshipPolicies) => void;
}) {
  const groupLabels = {
    access: "Identity and tenant scope",
    failure: "Timeout and failure",
    retry: "Retry and idempotency",
    delivery: "Event delivery",
    freshness: "Freshness and invalidation",
  };
  const group = <K extends keyof RelationshipPolicies>(
    key: K,
    fields: (
      value: Required<RelationshipPolicies>[K],
      change: (patch: Partial<Required<RelationshipPolicies>[K]>) => void,
    ) => React.ReactNode,
  ) => {
    const value = policies[key];
    return (
      <section className="policy-group" key={key} aria-label={groupLabels[key]}>
        <h3>{groupLabels[key]}</h3>
        {value ? (
          <Stack gap="sm">
            {fields(value as Required<RelationshipPolicies>[K], (patch) =>
              onChange({ ...policies, [key]: { ...value, ...patch } }),
            )}
            <Button
              variant="subtle"
              color="red"
              onClick={() => {
                const next = { ...policies };
                delete next[key];
                onChange(next);
              }}
            >
              Remove {groupLabels[key].toLowerCase()} policy
            </Button>
          </Stack>
        ) : (
          <Button
            variant="default"
            onClick={() => onChange({ ...policies, [key]: structuredClone(policyDefaults[key]) })}
          >
            Add {groupLabels[key].toLowerCase()} policy
          </Button>
        )}
      </section>
    );
  };
  return (
    <>
      <Text size="sm">
        Add only applicable policies. Unknown is a saved design decision to resolve. Private network
        and caller identity are independent.
      </Text>
      {group("access", (p, change) => (
        <>
          <Choice
            label="Caller identity"
            value={p.identity}
            options={["Unknown", "Public", "User", "Service", "API key", "Signed callback"]}
            onChange={(v) => change({ identity: v as typeof p.identity })}
          />
          <Choice
            label="Tenant scope"
            value={p.tenant}
            options={tenantChoices}
            onChange={(v) => change({ tenant: v as typeof p.tenant })}
          />
          <Choice
            label="Network reachability"
            value={p.network}
            options={["Unknown", "Public", "Private"]}
            onChange={(v) => change({ network: v as typeof p.network })}
          />
        </>
      ))}
      {group("failure", (p, change) => (
        <>
          <Amount
            label="Timeout (milliseconds)"
            value={p.timeoutMs}
            min={1}
            max={86_400_000}
            onChange={(v) => change({ timeoutMs: v })}
          />
          <Choice
            label="Failure outcome"
            value={p.outcome}
            options={[
              "Unknown",
              "Fail request",
              "Source fallback",
              "Serve stale",
              "Buffer",
              "Bounded loss",
            ]}
            onChange={(v) => change({ outcome: v as typeof p.outcome })}
          />
          <Textarea
            label="Failure boundary and outcome detail"
            value={p.detail}
            maxLength={1200}
            onChange={(e) => change({ detail: e.currentTarget.value })}
          />
        </>
      ))}
      {group("retry", (p, change) => (
        <>
          <Amount
            label="Maximum attempts (including first)"
            value={p.maxAttempts}
            min={1}
            max={1000}
            onChange={(v) => change({ maxAttempts: v })}
          />
          <Choice
            label="Idempotency requirement"
            value={p.idempotency}
            options={["Unknown", "Required", "Not required"]}
            onChange={(v) => change({ idempotency: v as typeof p.idempotency })}
          />
          <Textarea
            label="Idempotency key and boundary"
            value={p.key}
            maxLength={1200}
            onChange={(e) => change({ key: e.currentTarget.value })}
          />
        </>
      ))}
      {group("delivery", (p, change) => (
        <>
          <Choice
            label="Delivery guarantee"
            value={p.guarantee}
            options={["Unknown", "At most once", "At least once"]}
            onChange={(v) => change({ guarantee: v as typeof p.guarantee })}
          />
          <Choice
            label="Ordering"
            value={p.ordering}
            options={["Unknown", "Unordered", "Per key", "Total"]}
            onChange={(v) => change({ ordering: v as typeof p.ordering })}
          />
          <Choice
            label="Acknowledgement"
            value={p.acknowledgement}
            options={["Unknown", "None", "Accepted", "Persisted", "Processed"]}
            onChange={(v) => change({ acknowledgement: v as typeof p.acknowledgement })}
          />
          <Amount
            label="Maximum loss window (seconds)"
            value={p.lossWindowSeconds}
            onChange={(v) => change({ lossWindowSeconds: v })}
          />
        </>
      ))}
      {group("freshness", (p, change) => (
        <>
          <Amount
            label="Maximum stale age (seconds)"
            value={p.maxAgeSeconds}
            onChange={(v) => change({ maxAgeSeconds: v })}
          />
          <Choice
            label="Invalidation"
            value={p.invalidation}
            options={["Unknown", "TTL", "On write", "Event driven", "No cache"]}
            onChange={(v) => change({ invalidation: v as typeof p.invalidation })}
          />
          <Textarea
            label="Invalidation responsibility and boundary"
            value={p.detail}
            maxLength={1200}
            onChange={(e) => change({ detail: e.currentTarget.value })}
          />
        </>
      ))}
    </>
  );
}

export function RelationshipBindings({
  design,
  relationship,
  initialBinding,
  onClose,
}: {
  design: DesignDocument;
  relationship: BindingRelationship;
  initialBinding?: string;
  onClose: () => void;
}) {
  const { draft, setDraft, error, saving, issues, review, save } = useArchitectureDraft(
    design,
    onClose,
  );
  const bindings =
    draft.bindings?.filter((item) => sameBindingRelationship(item.relationship, relationship)) ??
    [];
  const [selected, setSelected] = useState(initialBinding ?? bindings[0]?.id);
  const binding = bindings.find((item) => item.id === selected);
  const update = (patch: Partial<RelationshipBinding>) =>
    setDraft({
      ...draft,
      bindings: draft.bindings?.map((item) =>
        item.id === selected ? { ...item, ...patch } : item,
      ),
    });
  const interfaces = (direction: "provided" | "required") => [
    { value: "", label: `Select ${direction} interface` },
    ...(draft.interfaces ?? [])
      .filter((item) => item.direction === direction)
      .map((item) => ({
        value: item.id,
        label: `${item.name} · ${item.owner.id} · ${contractKey(item.contract)}`,
      })),
  ];
  return (
    <ConfigurationDialog
      title="Relationship contracts and policies"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            className="contract-save"
            disabled={!!issues.length}
            loading={saving}
            onClick={() => void save()}
          >
            Save contracts and policies
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          {relationship.kind === "connection" ? "C2 connection" : "Local C3 relationship"}:{" "}
          {relationship.id}. C3 uses of a cross-container contract trace through this same C2
          identity. Declarations do not implement runtime behavior.
        </Text>
        <NativeSelect
          label="Binding"
          value={selected ?? ""}
          data={[
            { value: "", label: "Select a binding" },
            ...bindings.map((item) => ({ value: item.id, label: item.name })),
          ]}
          onChange={(e) => setSelected(e.currentTarget.value)}
        />
        <Button
          variant="default"
          onClick={() => {
            const id = architectureId("binding");
            const contract = draft.contracts?.[0];
            setDraft({
              ...draft,
              bindings: [
                ...(draft.bindings ?? []),
                {
                  id,
                  name: "New interaction",
                  relationship,
                  provided: "",
                  required: "",
                  contract: contract
                    ? { id: contract.id, version: contract.version }
                    : { id: "unselected", version: "v1" },
                  role: "request",
                  businessSynchrony: "Unknown",
                },
              ],
            });
            setSelected(id);
          }}
        >
          Add binding
        </Button>
        {binding ? (
          <>
            <TextInput
              label="Binding name"
              value={binding.name}
              maxLength={120}
              onChange={(e) => update({ name: e.currentTarget.value })}
            />
            <NativeSelect
              label="Provided interface"
              value={binding.provided}
              data={interfaces("provided")}
              onChange={(e) => {
                const provided = draft.interfaces?.find(
                  (item) => item.id === e.currentTarget.value,
                );
                update({
                  provided: e.currentTarget.value,
                  ...(provided && { contract: provided.contract, operation: undefined }),
                });
              }}
            />
            <NativeSelect
              label="Required interface"
              value={binding.required}
              data={interfaces("required")}
              onChange={(e) => update({ required: e.currentTarget.value })}
            />
            <NativeSelect
              label="Exact binding contract"
              value={contractKey(binding.contract)}
              data={[
                { value: "", label: "Select exact contract" },
                ...(draft.contracts ?? []).map((item) => ({
                  value: contractKey(item),
                  label: `${item.name} · ${item.version}`,
                })),
              ]}
              onChange={(e) => {
                const contract = draft.contracts?.find(
                  (item) => contractKey(item) === e.currentTarget.value,
                );
                if (contract)
                  update({
                    contract: { id: contract.id, version: contract.version },
                    operation: undefined,
                  });
              }}
            />
            <NativeSelect
              label="Operation"
              value={binding.operation ?? ""}
              data={[
                { value: "", label: "Whole contract / authoritative source member" },
                ...(
                  draft.contracts?.find(
                    (item) => contractKey(item) === contractKey(binding.contract),
                  )?.shape?.operations ?? []
                ).map((item) => ({ value: item.id, label: item.name })),
              ]}
              onChange={(e) => update({ operation: e.currentTarget.value || undefined })}
            />
            <Choice
              label="Interaction role"
              value={binding.role}
              options={["request", "publish", "consume", "callback", "read", "write"]}
              onChange={(v) => update({ role: v as RelationshipBinding["role"] })}
            />
            <TextInput
              label="Declared transport"
              placeholder="HTTPS, SQL, in process, named channel…"
              value={binding.transport ?? ""}
              maxLength={80}
              onChange={(e) => update({ transport: e.currentTarget.value || undefined })}
            />
            <Choice
              label="Business synchrony"
              value={binding.businessSynchrony}
              options={["Unknown", "Synchronous", "Asynchronous"]}
              onChange={(v) =>
                update({ businessSynchrony: v as RelationshipBinding["businessSynchrony"] })
              }
            />
            <PolicyFields
              policies={binding.policies ?? {}}
              onChange={(policies) => update({ policies })}
            />
            <Button
              variant="subtle"
              color="red"
              onClick={() => {
                setDraft({
                  ...draft,
                  bindings: draft.bindings?.filter((item) => item.id !== selected),
                });
                setSelected(undefined);
              }}
            >
              Remove binding
            </Button>
          </>
        ) : (
          <Text size="sm">
            Declare interfaces in their owner’s Manage interfaces editor, then bind them here.
            Several bindings can share this relationship.
          </Text>
        )}
        <ArchitectureDraftErrors error={error} issues={issues} />
        <section aria-label="Relationship design review">
          <h3>
            Design review ·{" "}
            {relatedReview(review, bindings).length ? "incomplete" : "no selected conflicts"}
          </h3>
          {relatedReview(review, bindings).map((item) => (
            <p className="contract-review" key={`${item.code}:${item.message}`}>
              {item.message}
            </p>
          ))}
        </section>
      </Stack>
    </ConfigurationDialog>
  );
}
