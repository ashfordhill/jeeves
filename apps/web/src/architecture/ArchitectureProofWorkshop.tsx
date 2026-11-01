import "./architecture-library.css";
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  architectureProof,
  architectureProofOperations,
  type OperationInput,
  type ProofProduct,
  proofSteps,
} from "@jeeves/spec";
import { Alert, Badge, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

/** Bounded, reviewable composition exercises using the same operations as ordinary authoring/chat. */
export function ArchitectureProofWorkshop({ onClose }: { onClose: () => void }) {
  const [base] = useState(() => structuredClone(useDraw.getState().loaded!));
  const [product, setProduct] = useState<ProofProduct>(() =>
    base.design.architecture?.system.name === "Inventory reuse study" ? "inventory" : "qrwty",
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const model = base.design.architecture;
  const step = proofSteps(product).find((s) =>
    s.id === "start"
      ? !model
      : s.id === "behavior"
        ? !model?.decisions?.some((d) => d.id === "hosted-first")
        : !model?.patternInstances?.some((p) => p.id === s.id),
  );
  let ops: OperationInput[] = [];
  let problem: string | undefined;
  try {
    if (step) ops = architectureProofOperations(base.design, product, step.id, builtinRegistry());
  } catch (e) {
    problem = (e as Error).message;
  }
  const result = ops.length ? applyOperations(base.design, ops, builtinRegistry()) : undefined;
  if (result && !result.ok) problem = result.errors.map((e) => e.message).join(" ");
  const next = result?.ok ? result.design : undefined;
  const added = next?.architecture;
  const save = async () => {
    const current = useDraw.getState().loaded;
    if (
      current?.project.id !== base.project.id ||
      current.design.revision !== base.design.revision
    ) {
      setError(
        "The design changed. This preview is retained. Cancel and reopen to review the current revision.",
      );
      return;
    }
    setSaving(true);
    try {
      const ok = await useDraw.getState().edit(ops);
      if (!ok) throw new Error(useDraw.getState().notice?.message ?? "Could not save this stage.");
      if (step?.id === "behavior") {
        const layout = architectureProof(product).layout.architecture;
        for (const [id, view] of Object.entries(layout ?? {}))
          useDraw.getState().setArchitectureView(id, view);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ConfigurationDialog
      title="Architecture proof workshop"
      size="xl"
      onClose={onClose}
      footer={
        <Stack gap="xs">
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="architecture-template-primary"
              color="cyan.9"
              disabled={!next || !!problem}
              loading={saving}
              onClick={() => void save()}
            >
              Apply reviewed stage
            </Button>
          </Group>
        </Stack>
      }
    >
      <Stack gap="md">
        <Badge variant="light">Architecture intent only</Badge>
        <NativeSelect
          label="Study"
          value={product}
          disabled={!!model}
          data={[
            { value: "qrwty", label: "QRWTY — six scenario families" },
            { value: "inventory", label: "Inventory — tenant and durable delivery reuse" },
          ]}
          onChange={(e) => setProduct(e.currentTarget.value as ProofProduct)}
        />
        <Text size="sm">
          Start in an empty project. Review and apply each stage, then inspect or edit its normal
          components, contracts, policies and scenarios. Each stage has one undo step. All numerical
          policies are illustrative examples; production objectives remain open decisions.
        </Text>
        <ol>
          {proofSteps(product).map((s) => (
            <li key={s.id}>
              {s.name}
              {s.id === step?.id ? " — next" : ""}
            </li>
          ))}
        </ol>
        <h3>{step?.name ?? "Study assembled"}</h3>
        {!step ? (
          <Text>
            Use Architecture review and the scenario picker to inspect remaining decisions. No
            runtime evidence is supplied.
          </Text>
        ) : null}
        {problem ? (
          <Alert color="red" role="alert">
            {problem}
          </Alert>
        ) : null}
        {next ? (
          <>
            <Text size="sm">
              Preview: {next.elements.length} logical blocks, {added?.components?.length ?? 0}{" "}
              responsibilities, {added?.contracts?.length ?? 0} exact contracts. Existing instances
              remain editable.
            </Text>
            <details open>
              <summary>Responsibilities and boundaries</summary>
              <ul>
                {next.elements.map((e) => (
                  <li key={e.id}>
                    <strong>{e.name}</strong>: {e.description ?? e.planned}
                  </li>
                ))}
                {added?.components?.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong> ({c.element}): {c.responsibility}
                  </li>
                ))}
              </ul>
            </details>
            <details>
              <summary>Exact contracts and relationship policies</summary>
              {added?.contracts?.map((c) => (
                <p key={`${c.id}@${c.version}`}>
                  <strong>
                    {c.name} {c.version}
                  </strong>
                  : {c.shape?.payload.map((f) => `${f.name}: ${f.type}`).join(", ")}
                  {c.shape?.operations
                    .map(
                      (o) =>
                        `${o.name} (${o.input.map((f) => `${f.name}: ${f.type}`).join(", ")}) → ${o.output.map((f) => `${f.name}: ${f.type}`).join(", ")}`,
                    )
                    .join("; ")}
                </p>
              ))}
              {added?.bindings?.map((b) => (
                <p key={b.id}>
                  <strong>{b.name}</strong> ({b.contract.id}@{b.contract.version}, {b.role}):{" "}
                  {Object.entries(b.policies ?? {})
                    .map(
                      ([kind, values]) =>
                        `${kind}: ${Object.entries(values)
                          .map(([key, value]) => `${key} ${value}`)
                          .join(", ")}`,
                    )
                    .join("; ")}
                </p>
              ))}
            </details>
            <details open={step?.id === "behavior"}>
              <summary>Decisions, consequences and unresolved objectives</summary>
              {added?.decisions?.map((d) => (
                <p key={d.id}>
                  <strong>
                    {d.name} · {d.status}
                  </strong>
                  <br />
                  {d.decision}
                  <br />
                  {d.consequence}
                </p>
              ))}
            </details>
            <details>
              <summary>Scenario expectations and failure outcomes</summary>
              {added?.scenarios?.map((s) => (
                <section key={s.id}>
                  <h4>{s.name}</h4>
                  <p>{s.startCondition}</p>
                  <ol>
                    {s.steps.map((s) => (
                      <li key={s.id}>
                        {s.text} ({s.binding ?? s.relationship.id})
                      </li>
                    ))}
                  </ol>
                  {s.outcomes?.map((o) => (
                    <p key={o.id}>{o.text}</p>
                  ))}
                </section>
              ))}
            </details>
          </>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
