import {
  type Attachment,
  type Element,
  type LocalHttpPoolBinding,
  localHttpPoolConfigSchema,
  localHttpPoolProblems,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../../components/ConfigurationDialog.tsx";
import { useDraw } from "../store.ts";

export function LocalHttpPoolSummary({
  binding,
}: {
  binding: Pick<LocalHttpPoolBinding, "replicas">;
}) {
  return (
    <Stack gap="xs" role="status" aria-label="Effective local HTTP pool">
      <Text size="sm">
        One application · {binding.replicas} local instances · one shared database
      </Text>
      <Text size="sm">
        Database budget: {binding.replicas * 5} application connections, before other consumers. The
        selected execution limits apply to each instance.
      </Text>
      <Text size="xs">
        Ready instances receive requests in turn. Failed or ambiguous writes are not retried. One
        proxy and one database remain failure points; this policy does not provide host failover or
        public ingress.
      </Text>
    </Stack>
  );
}
export function LocalHttpPoolConfiguration({
  element,
  attachment,
}: {
  element: Element;
  attachment: Attachment;
}) {
  const [opened, setOpened] = useState(false);
  const parsed = localHttpPoolConfigSchema.safeParse(attachment.config);
  return (
    <Stack gap="xs">
      <Text size="xs">
        {parsed.success
          ? `${parsed.data.replicas === 2 ? "Pair" : "Trio"} · local pool 0.1.0`
          : "Configure local HTTP pool."}
      </Text>
      <Button size="xs" variant="default" onClick={() => setOpened(true)}>
        Configure local HTTP pool
      </Button>
      {opened ? (
        <LocalHttpPoolEditor
          element={element}
          attachment={attachment}
          onClose={() => setOpened(false)}
        />
      ) : null}
    </Stack>
  );
}
function LocalHttpPoolEditor({
  element,
  attachment,
  onClose,
}: {
  element: Element;
  attachment: Attachment;
  onClose(): void;
}) {
  const [baseRevision] = useState(useDraw.getState().loaded?.design.revision);
  const [replicas, setReplicas] = useState<2 | 3>(() => {
    const parsed = localHttpPoolConfigSchema.safeParse(attachment.config);
    return parsed.success ? parsed.data.replicas : 2;
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const design = useDraw((s) => s.loaded?.design);
  const prerequisites = design ? localHttpPoolProblems(design, element) : [];
  const save = async () => {
    if (saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    if (
      await useDraw
        .getState()
        .edit([{ op: "updateAttachment", id: attachment.id, config: { replicas } }])
    )
      onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "Configuration could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Configure local HTTP pool"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan.9" loading={saving} onClick={() => void save()}>
            Save local HTTP pool
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          Run the same generated resource API in a small local pool. Its URL, sessions and records
          stay shared.
        </Text>
        <NativeSelect
          label="Pool size"
          value={replicas}
          data={[
            { value: "2", label: "Pair · 2 instances" },
            { value: "3", label: "Trio · 3 instances" },
          ]}
          onChange={(event) => setReplicas(Number(event.currentTarget.value) as 2 | 3)}
        />
        <LocalHttpPoolSummary binding={{ replicas }} />
        {prerequisites.length ? (
          <Alert title="Complete before generation" color="blue">
            <ul>
              {prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <Text size="sm">
          This release supports generated owner resources and session authentication. Generate
          checks that the API retains its reviewed source, dependencies, migrations and build
          configuration. Custom handlers and background workers require a separate reviewed
          capability.
        </Text>
        <Alert title="Applies at the next generation" color="blue">
          Save changes the design. Generate writes the configuration; recreating the local
          containers applies it. Saving never restarts an application.
        </Alert>
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
