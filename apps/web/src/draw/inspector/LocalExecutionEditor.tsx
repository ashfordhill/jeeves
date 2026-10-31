import {
  type Attachment,
  type LocalExecutionPolicy,
  type LocalExecutionPreset,
  localExecutionConfigSchema,
  localExecutionPolicy,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../../components/ConfigurationDialog.tsx";
import { useDraw } from "../store.ts";

export function ExecutionPolicySummary({ policy }: { policy: LocalExecutionPolicy }) {
  return (
    <Stack gap="xs" role="status" aria-label="Effective local execution policy">
      <Text size="sm">
        {policy.cpus} CPU · {policy.memoryMiB} MiB memory · {policy.pids} processes
      </Text>
      <Text size="sm">
        On failure: up to {policy.restartAttempts} restarts · shutdown deadline{" "}
        {policy.shutdownMs / 1000}s · Docker grace {policy.graceSeconds}s · init enabled
      </Text>
      <Text size="xs">
        Resource ceilings limit one local container. They do not guarantee throughput. A failed
        health check alone does not restart it.
      </Text>
    </Stack>
  );
}
export function LocalExecutionConfiguration({ attachment }: { attachment: Attachment }) {
  const [opened, setOpened] = useState(false);
  const parsed = localExecutionConfigSchema.safeParse(attachment.config);
  return (
    <Stack gap="xs">
      <Text size="xs">
        {parsed.success
          ? `${parsed.data.preset} · local policy 0.1.0`
          : "Configure local execution."}
      </Text>
      <Button size="xs" variant="default" onClick={() => setOpened(true)}>
        Configure local execution
      </Button>
      {opened ? (
        <LocalExecutionEditor attachment={attachment} onClose={() => setOpened(false)} />
      ) : null}
    </Stack>
  );
}
function LocalExecutionEditor({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const [baseRevision] = useState(useDraw.getState().loaded?.design.revision);
  const [preset, setPreset] = useState<LocalExecutionPreset>(() => {
    const parsed = localExecutionConfigSchema.safeParse(attachment.config);
    return parsed.success ? parsed.data.preset : "balanced";
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "updateAttachment", id: attachment.id, config: { preset } }]);
    if (ok) onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "Configuration could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Configure local execution"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan.9" loading={saving} onClick={() => void save()}>
            Save local execution
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          Choose limits for this HTTP service on local Docker Compose. Other services keep their own
          settings.
        </Text>
        <NativeSelect
          label="Execution preset"
          value={preset}
          data={[
            { value: "compact", label: "Compact" },
            { value: "balanced", label: "Balanced" },
            { value: "expanded", label: "Expanded" },
          ]}
          onChange={(event) => setPreset(event.currentTarget.value as LocalExecutionPreset)}
        />
        <ExecutionPolicySummary policy={localExecutionPolicy(preset)} />
        <Alert title="Applies at the next generation" color="blue">
          Save updates this design. Generate writes the policy; starting or recreating the local
          container applies it. Saving never restarts an application.
        </Alert>
        <Text size="sm">
          Docker retries nonzero process exits. Manual stops suppress restart. Docker controls the
          restart delay. This policy does not add replicas, failover or cloud capacity.
        </Text>
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
