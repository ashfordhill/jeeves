import { type ContractShape, operationBehaviorSchema, operationOutcomeSchema } from "@jeeves/spec";
import { Button, NativeSelect, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { PayloadFields } from "./ContractFields.tsx";

type Operation = ContractShape["operations"][number];
export function OperationBehaviorFields({
  operation,
  onChange,
  disabled,
}: {
  operation: Operation;
  onChange: (patch: Partial<Operation>) => void;
  disabled: boolean;
}) {
  const behavior = operation.behavior ?? {};
  const outcomes = operation.outcomes ?? [];
  return (
    <>
      <details className="contract-operation">
        <summary>Behavior & implementation boundary</summary>
        <Stack gap="sm" mt="sm">
          {(
            [
              ["kind", "Operation intent"],
              ["idempotency", "Retry / idempotency"],
              ["implementation", "Implementation boundary"],
            ] as const
          ).map(([key, label]) => (
            <NativeSelect
              key={key}
              label={label}
              value={behavior[key] ?? "Unspecified"}
              data={operationBehaviorSchema.shape[key].unwrap().options}
              onChange={(e) =>
                onChange({ behavior: { ...behavior, [key]: e.currentTarget.value } })
              }
            />
          ))}
          {(
            [
              [
                "authorization",
                "Authorization rule",
                "Principal, action, resource scope and membership checks.",
              ],
              [
                "preconditions",
                "Preconditions & invariants",
                "Rules that must hold before the operation is allowed.",
              ],
              [
                "stateChanges",
                "Authoritative state changes",
                "What is read or changed, and which component owns it.",
              ],
              [
                "transaction",
                "Transaction boundary",
                "Atomic changes, concurrency checks and anything outside the transaction.",
              ],
              [
                "idempotencyKey",
                "Deduplication scope & lifetime",
                "Key, principal scope, retention and replay result; leave open if undecided.",
              ],
              [
                "sideEffects",
                "Side effects & recovery",
                "When events/jobs are emitted; delivery failure and reconciliation.",
              ],
              [
                "extensionPoint",
                "Application hook contract",
                "Inputs, permitted effects and outputs of application-specific logic.",
              ],
              [
                "acceptance",
                "Acceptance criteria",
                "Observable examples for success, rejection, retries and concurrent changes.",
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <Textarea
              key={key}
              label={label}
              placeholder={placeholder}
              value={behavior[key] ?? ""}
              maxLength={1200}
              autosize
              minRows={2}
              maxRows={6}
              onChange={(e) =>
                onChange({ behavior: { ...behavior, [key]: e.currentTarget.value } })
              }
            />
          ))}
        </Stack>
      </details>
      <details className="contract-operation">
        <summary>Outcomes ({outcomes.length})</summary>
        {outcomes.map((outcome, index) => {
          const change = (patch: Partial<typeof outcome>) =>
            onChange({ outcomes: outcomes.map((o, i) => (i === index ? { ...o, ...patch } : o)) });
          return (
            <fieldset className="contract-operation" key={outcome.id} disabled={disabled}>
              <legend>{outcome.name}</legend>
              <Stack gap="sm">
                <TextInput
                  label={`Outcome ${index + 1} name`}
                  value={outcome.name}
                  maxLength={120}
                  onChange={(e) => change({ name: e.currentTarget.value })}
                />
                {(
                  [
                    ["kind", "Kind"],
                    ["state", "State after outcome"],
                    ["retry", "Retry decision"],
                  ] as const
                ).map(([key, label]) => (
                  <NativeSelect
                    key={key}
                    label={label}
                    value={outcome[key]}
                    data={operationOutcomeSchema.shape[key].options}
                    onChange={(e) => change({ [key]: e.currentTarget.value })}
                  />
                ))}
                <NumberInput
                  label="HTTP status (optional)"
                  min={100}
                  max={599}
                  allowDecimal={false}
                  value={outcome.status ?? ""}
                  onChange={(v) => change({ status: typeof v === "number" ? v : undefined })}
                />
                <Textarea
                  label="When this outcome occurs"
                  maxLength={1200}
                  value={outcome.condition}
                  onChange={(e) => change({ condition: e.currentTarget.value })}
                />
                <PayloadFields
                  label={`Outcome ${index + 1} payload`}
                  fields={outcome.payload ?? []}
                  disabled={disabled}
                  onChange={(payload) => change({ payload })}
                />
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => onChange({ outcomes: outcomes.filter((_, i) => i !== index) })}
                >
                  Remove outcome {index + 1}
                </Button>
              </Stack>
            </fieldset>
          );
        })}
        <Button
          mt="sm"
          variant="default"
          size="xs"
          disabled={disabled || outcomes.length >= 30}
          onClick={() =>
            onChange({
              outcomes: [
                ...outcomes,
                {
                  id: `outcome-${crypto.randomUUID().slice(0, 8)}`,
                  name: "New outcome",
                  kind: "Failure",
                  condition: "",
                  state: "Unspecified",
                  retry: "Unspecified",
                },
              ],
            })
          }
        >
          Add outcome
        </Button>
      </details>
    </>
  );
}
