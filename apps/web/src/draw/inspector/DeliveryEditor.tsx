import { deliveryPolicy } from "@jeeves/durable-events/policy";
import {
  type Attachment,
  type DeliveryConfig,
  type DeliveryEvent,
  type DeliveryField,
  deliveryConfigSchema,
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
import { useRef, useState } from "react";
import { ArchitectureDialog } from "../../architecture/ArchitectureEditors.tsx";
import { useDraw } from "../store.ts";

const newEvent = (index: number): DeliveryEvent => ({
  id: `event-${index}`,
  type: `domain.event-${index}`,
  version: 1,
  fields: [{ name: "referenceId", type: "text", maxLength: 200 }],
  notes: "",
  acceptance: [`EVENT-${index}`],
});
const newField = (name: string, type: DeliveryField["type"]): DeliveryField => {
  if (type === "text") return { name, type, maxLength: 200 };
  if (type === "integer") return { name, type, min: 0, max: 1000000 };
  if (type === "enum") return { name, type, choices: ["pending", "complete"] };
  return { name, type };
};
export function DeliveryConfiguration({ attachment }: { attachment: Attachment }) {
  const [opened, setOpened] = useState(false);
  const parsed = deliveryConfigSchema.safeParse(attachment.config);
  return (
    <Stack gap="xs">
      <Text size="xs">
        {parsed.success
          ? `${parsed.data.events.length} event contract(s) · ${parsed.data.preset}`
          : "Configure at least one event contract."}
      </Text>
      <Button size="xs" variant="default" onClick={() => setOpened(true)}>
        Configure durable events
      </Button>
      {opened ? <DeliveryEditor attachment={attachment} onClose={() => setOpened(false)} /> : null}
    </Stack>
  );
}
function DeliveryEditor({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [baseRevision] = useState(useDraw.getState().loaded?.design.revision);
  const [draft, setDraft] = useState<DeliveryConfig>(() => {
    const parsed = deliveryConfigSchema.safeParse(attachment.config);
    return parsed.success
      ? structuredClone(parsed.data)
      : { preset: "standard", events: [newEvent(1)] };
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const parsed = deliveryConfigSchema.safeParse(draft);
  const policy = deliveryPolicy(draft.preset);
  // Draft identities survive editable IDs/names and removals, without entering the semantic config.
  const keys = useRef(new WeakMap<object, string>());
  const keyOf = (item: object): string => {
    const existing = keys.current.get(item);
    if (existing) return existing;
    const key = crypto.randomUUID();
    keys.current.set(item, key);
    return key;
  };
  const changeEvent = (index: number, patch: Partial<DeliveryEvent>) =>
    setDraft((value) => ({
      ...value,
      events: value.events.map((event, i) => {
        if (i !== index) return event;
        const updated = { ...event, ...patch };
        keys.current.set(updated, keyOf(event));
        return updated;
      }),
    }));
  const save = async () => {
    if (!parsed.success || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "updateAttachment", id: attachment.id, config: parsed.data }]);
    if (ok) onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "Configuration could not be saved.");
    }
  };
  return (
    <ArchitectureDialog title="Configure durable events" size="xl" onClose={onClose}>
      <Stack gap="md">
        <Text size="sm">
          One worker runs inside this service, using its connected Postgres database. Jeeves owns
          delivery and retries; each event handler supplies the business effect.
        </Text>
        <NativeSelect
          label="Retry preset"
          value={draft.preset}
          data={[
            { value: "standard", label: "Standard" },
            { value: "responsive", label: "Responsive" },
          ]}
          onChange={(event) =>
            setDraft({ ...draft, preset: event.currentTarget.value as DeliveryConfig["preset"] })
          }
        />
        <Text size="sm" role="status">
          {policy.maxAttempts} attempts · {policy.baseDelayMs / 1000}s initial backoff ·{" "}
          {policy.maxDelayMs / 1000}s cap · {policy.leaseMs / 1000}s lease ·{" "}
          {policy.deadlineMs / 1000}s cooperative deadline · {policy.pollMs}ms idle polling. Jitter:
          75–125%, capped. New deliveries use this preset; queued deliveries retain theirs.
        </Text>
        <Alert title="Published contracts are durable" color="blue">
          After generation, keep event IDs, types, versions and payloads. Append a new event version
          when a payload changes. Save updates this design; Generate applies it to the project.
        </Alert>
        {draft.events.map((event, index) => {
          const field = (fieldIndex: number, value: DeliveryField) => {
            const previous = event.fields[fieldIndex];
            if (previous) keys.current.set(value, keyOf(previous));
            changeEvent(index, {
              fields: event.fields.map((f, i) => (i === fieldIndex ? value : f)),
            });
          };
          return (
            <fieldset
              key={keyOf(event)}
              style={{
                minWidth: 0,
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <legend>Event {index + 1}</legend>
              <Stack gap="sm">
                <Group grow align="start">
                  <TextInput
                    label={`Event ${index + 1} ID`}
                    value={event.id}
                    onChange={(e) => changeEvent(index, { id: e.currentTarget.value })}
                  />
                  <TextInput
                    label={`Event ${index + 1} type`}
                    value={event.type}
                    onChange={(e) => changeEvent(index, { type: e.currentTarget.value })}
                  />
                  <NumberInput
                    label={`Event ${index + 1} version`}
                    min={1}
                    max={1000}
                    allowDecimal={false}
                    value={event.version}
                    onChange={(v) => changeEvent(index, { version: Number(v) })}
                  />
                </Group>
                <Text size="sm" fw={600}>
                  Required payload fields
                </Text>
                {event.fields.map((f, fi) => (
                  <fieldset
                    key={keyOf(f)}
                    style={{
                      minWidth: 0,
                      border: "1px solid var(--mantine-color-default-border)",
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <legend>
                      Event {index + 1} field {fi + 1}
                    </legend>
                    <Stack gap="xs">
                      <Group grow>
                        <TextInput
                          label={`Event ${index + 1} field ${fi + 1} name`}
                          value={f.name}
                          onChange={(e) => field(fi, { ...f, name: e.currentTarget.value })}
                        />
                        <NativeSelect
                          label={`Event ${index + 1} field ${fi + 1} kind`}
                          value={f.type}
                          data={["text", "integer", "boolean", "enum"]}
                          onChange={(e) =>
                            field(
                              fi,
                              newField(f.name, e.currentTarget.value as DeliveryField["type"]),
                            )
                          }
                        />
                      </Group>
                      {f.type === "text" ? (
                        <NumberInput
                          label={`Field ${fi + 1} maximum length for event ${index + 1}`}
                          min={1}
                          max={4096}
                          value={f.maxLength}
                          onChange={(v) => field(fi, { ...f, maxLength: Number(v) })}
                        />
                      ) : null}
                      {f.type === "integer" ? (
                        <Group grow>
                          <NumberInput
                            label={`Field ${fi + 1} minimum for event ${index + 1}`}
                            value={f.min}
                            onChange={(v) => field(fi, { ...f, min: Number(v) })}
                          />
                          <NumberInput
                            label={`Field ${fi + 1} maximum for event ${index + 1}`}
                            value={f.max}
                            onChange={(v) => field(fi, { ...f, max: Number(v) })}
                          />
                        </Group>
                      ) : null}
                      {f.type === "enum" ? (
                        <TextInput
                          label={`Field ${fi + 1} choices for event ${index + 1}`}
                          description="Separate choices with commas."
                          value={f.choices.join(", ")}
                          onChange={(e) =>
                            field(fi, {
                              ...f,
                              choices: e.currentTarget.value.split(",").map((v) => v.trim()),
                            })
                          }
                        />
                      ) : null}
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          changeEvent(index, { fields: event.fields.filter((_, i) => i !== fi) })
                        }
                      >
                        Remove field {fi + 1} from event {index + 1}
                      </Button>
                    </Stack>
                  </fieldset>
                ))}
                <Button
                  size="xs"
                  variant="default"
                  disabled={event.fields.length >= 20}
                  onClick={() =>
                    changeEvent(index, {
                      fields: [
                        ...event.fields,
                        newField(`field${event.fields.length + 1}`, "text"),
                      ],
                    })
                  }
                >
                  Add payload field to event {index + 1}
                </Button>
                <Textarea
                  label={`Event ${index + 1} business effect`}
                  description="Describe what the handler must do. Empty notes still require implementation and fixed acceptance."
                  value={event.notes}
                  onChange={(e) => changeEvent(index, { notes: e.currentTarget.value })}
                />
                <TextInput
                  label={`Event ${index + 1} acceptance references`}
                  description="Separate fixed acceptance IDs with commas."
                  value={event.acceptance.join(", ")}
                  onChange={(e) =>
                    changeEvent(index, {
                      acceptance: e.currentTarget.value.split(",").map((v) => v.trim()),
                    })
                  }
                />
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    setDraft({ ...draft, events: draft.events.filter((_, i) => i !== index) })
                  }
                >
                  Remove event {index + 1}
                </Button>
              </Stack>
            </fieldset>
          );
        })}
        <Button
          variant="default"
          disabled={draft.events.length >= 20}
          onClick={() => {
            let next = draft.events.length + 1;
            while (draft.events.some((e) => e.id === `event-${next}`)) next++;
            setDraft({ ...draft, events: [...draft.events, newEvent(next)] });
          }}
        >
          Add event contract
        </Button>
        {!parsed.success ? (
          <Alert color="red" role="alert">
            {parsed.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")}
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!parsed.success} loading={saving} onClick={() => void save()}>
            Save event configuration
          </Button>
        </Group>
      </Stack>
    </ArchitectureDialog>
  );
}
