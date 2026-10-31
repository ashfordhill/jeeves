import type { TemplateRef, TemplateUpgradeReview } from "@jeeves/spec";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "./store.ts";

export function TemplateUpgradeDialog({
  name,
  target,
  review,
  onClose,
}: {
  name: string;
  target: TemplateRef;
  review: TemplateUpgradeReview;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string>();
  const save = async () => {
    if (!review.ok || saving) return;
    if (useDraw.getState().loaded?.design.revision !== review.revision) {
      setError(
        "The design changed while this review was open. Close and review the current design before upgrading.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "upgradeTemplate",
        id: review.id,
        from: review.from,
        to: review.to,
        revision: review.revision,
      },
    ]);
    if (ok) onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "The upgrade could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Review template upgrade"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan.9" disabled={!review.ok} loading={saving} onClick={() => void save()}>
            Upgrade template
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Text fw={600}>
          {name} · {target.id} {target.version}
        </Text>
        {review.ok ? (
          <>
            <Text size="sm">
              Version {review.from.version} → {review.to.version} · reviewed at design revision{" "}
              {review.revision}
            </Text>
            <Alert title="Preserves your application" color="blue">
              Configuration, attachment IDs, resources, connections, notes, context bindings and
              board layout are retained. Existing runtime behavior stays the same until you select a
              newly available capability.
            </Alert>
            <div>
              <Text size="sm" fw={600}>
                New available capabilities
              </Text>
              {review.available.length ? (
                <ul>
                  {review.available.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Text size="sm">No additional attachment slots.</Text>
              )}
              <Text size="xs">
                These are available choices; upgrading does not add or configure them.
              </Text>
            </div>
            <details>
              <summary>Retained identities and configuration</summary>
              <Text size="sm">
                Configuration: {review.retained.configuration.join(", ") || "template defaults"}
              </Text>
              <Text size="sm">Attachments: {review.retained.attachments.join(", ") || "none"}</Text>
              <Text size="sm">Connections: {review.retained.connections.join(", ") || "none"}</Text>
            </details>
            <Text size="sm">
              This saves one design change with undo. Generate applies the selected template to
              owned output and checks for hand edits. It does not deploy or restart your
              application.
            </Text>
          </>
        ) : (
          <Alert title="Upgrade unavailable" color="orange" role="alert">
            {review.reason}
          </Alert>
        )}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
