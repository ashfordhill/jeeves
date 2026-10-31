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
import { ConfigurationDialog } from "../../components/ConfigurationDialog.tsx";
import { useDraw } from "../store.ts";
import "./delivery-editor.css";

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
function FieldInputs({
  field,
  eventIndex,
  index,
  onChange,
}: {
  field: DeliveryField;
  eventIndex: number;
  index: number;
  onChange(field: DeliveryField): void;
}) {
  const prefix = `Event ${eventIndex + 1} field ${index + 1}`;
  return (
    <Stack gap="xs">
      <Group grow>
        <TextInput
          label="Name"
          aria-label={`${prefix} name`}
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.currentTarget.value })}
        />
        <NativeSelect
          label="Kind"
          aria-label={`${prefix} kind`}
          value={field.type}
          data={["text", "integer", "boolean", "enum"]}
          onChange={(e) =>
            onChange(newField(field.name, e.currentTarget.value as DeliveryField["type"]))
          }
        />
      </Group>
      {field.type === "text" ? (
        <NumberInput
          label="Maximum length"
          aria-label={`Field ${index + 1} maximum length for event ${eventIndex + 1}`}
          min={1}
          max={4096}
          value={field.maxLength}
          onChange={(v) => onChange({ ...field, maxLength: Number(v) })}
        />
      ) : null}
      {field.type === "integer" ? (
        <Group grow>
          <NumberInput
            label="Minimum"
            aria-label={`Field ${index + 1} minimum for event ${eventIndex + 1}`}
            value={field.min}
            onChange={(v) => onChange({ ...field, min: Number(v) })}
          />
          <NumberInput
            label="Maximum"
            aria-label={`Field ${index + 1} maximum for event ${eventIndex + 1}`}
            value={field.max}
            onChange={(v) => onChange({ ...field, max: Number(v) })}
          />
        </Group>
      ) : null}
      {field.type === "enum" ? (
        <TextInput
          label="Choices"
          aria-label={`Field ${index + 1} choices for event ${eventIndex + 1}`}
          description="Separate choices with commas."
          value={field.choices.join(", ")}
          onChange={(e) =>
            onChange({ ...field, choices: e.currentTarget.value.split(",").map((v) => v.trim()) })
          }
        />
      ) : null}
    </Stack>
  );
}
function DeliveryEditor({ attachment, onClose }: { attachment: Attachment; onClose(): void }) {
  const [baseRevision] = useState(useDraw.getState().loaded?.design.revision);
  const [draft, setDraft] = useState<DeliveryConfig>(() => {
    const parsed = deliveryConfigSchema.safeParse(attachment.config);
    return parsed.success
      ? structuredClone(parsed.data)
      : { preset: "standard", events: [newEvent(1)] };
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>();
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({});
  const eventEditor = useRef<HTMLFieldSetElement>(null),
    fieldEditor = useRef<HTMLFieldSetElement>(null);
  const addEventButton = useRef<HTMLButtonElement>(null);
  // Opaque draft keys survive editable IDs/names. They never enter the semantic configuration.
  const keys = useRef(new WeakMap<object, string>());
  const keyOf = (item: object): string => {
    const existing = keys.current.get(item);
    if (existing) return existing;
    const key = crypto.randomUUID();
    keys.current.set(item, key);
    return key;
  };
  const index = Math.max(
    0,
    draft.events.findIndex((event) => keyOf(event) === selectedEvent),
  );
  const event = draft.events[index],
    eventKey = event ? keyOf(event) : "";
  const fieldIndex = Math.max(
    0,
    event?.fields.findIndex((field) => keyOf(field) === selectedFields[eventKey]) ?? 0,
  );
  const focusedField = event?.fields[fieldIndex];
  const parsed = deliveryConfigSchema.safeParse(draft),
    policy = deliveryPolicy(draft.preset);
  const issues = parsed.success ? [] : parsed.error.issues;
  const eventInvalid = (i: number) =>
    issues.some(
      (issue) =>
        issue.path[0] === "events" && (typeof issue.path[1] !== "number" || issue.path[1] === i),
    );
  const fieldInvalid = (i: number) =>
    issues.some(
      (issue) =>
        issue.path[1] === index &&
        issue.path[2] === "fields" &&
        (typeof issue.path[3] !== "number" || issue.path[3] === i),
    );
  const changeEvent = (patch: Partial<DeliveryEvent>) =>
    setDraft((value) => ({
      ...value,
      events: value.events.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...patch };
        keys.current.set(updated, keyOf(item));
        return updated;
      }),
    }));
  const chooseField = (item: DeliveryField, parentKey = eventKey) =>
    setSelectedFields((value) => ({ ...value, [parentKey]: keyOf(item) }));
  const review = (issue: (typeof issues)[number]) => {
    const at = typeof issue.path[1] === "number" ? issue.path[1] : 0;
    const parent = draft.events[at];
    if (!parent) {
      addEventButton.current?.scrollIntoView({ block: "nearest" });
      addEventButton.current?.focus({ preventScroll: true });
      return;
    }
    setSelectedEvent(keyOf(parent));
    const fi =
      issue.path[2] === "fields" && typeof issue.path[3] === "number" ? issue.path[3] : undefined;
    if (fi !== undefined && parent.fields[fi]) chooseField(parent.fields[fi], keyOf(parent));
    requestAnimationFrame(() =>
      (fi === undefined ? eventEditor : fieldEditor).current?.scrollIntoView({ block: "nearest" }),
    );
  };
  const addEvent = () => {
    let next = 1;
    while (
      draft.events.some(
        (e) => e.id === `event-${next}` || (e.type === `domain.event-${next}` && e.version === 1),
      )
    )
      next++;
    const added = newEvent(next);
    setDraft({ ...draft, events: [...draft.events, added] });
    setSelectedEvent(keyOf(added));
  };
  const addField = () => {
    if (!event) return;
    let next = 1;
    while (event.fields.some((f) => f.name === `field${next}`)) next++;
    const added = newField(`field${next}`, "text");
    changeEvent({ fields: [...event.fields, added] });
    chooseField(added);
  };
  const save = async () => {
    if (!parsed.success || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    if (
      await useDraw
        .getState()
        .edit([{ op: "updateAttachment", id: attachment.id, config: parsed.data }])
    )
      onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "Configuration could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Configure durable events"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Group gap="xs">
            {issues[0] ? (
              <Button size="xs" variant="default" onClick={() => issues[0] && review(issues[0])}>
                Review {issues.length} issue{issues.length === 1 ? "" : "s"}
              </Button>
            ) : null}
            <Button
              color="cyan.9"
              disabled={!parsed.success}
              loading={saving}
              onClick={() => void save()}
            >
              Save event configuration
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="md" className="delivery-editor">
        <div className="delivery-policy">
          <NativeSelect
            label="Retry preset"
            value={draft.preset}
            data={[
              { value: "standard", label: "Standard" },
              { value: "responsive", label: "Responsive" },
            ]}
            onChange={(e) =>
              setDraft({ ...draft, preset: e.currentTarget.value as DeliveryConfig["preset"] })
            }
          />
          <Text size="xs" role="status">
            {policy.maxAttempts} attempts · {policy.baseDelayMs / 1000}s initial backoff ·{" "}
            {policy.maxDelayMs / 1000}s cap · {policy.leaseMs / 1000}s lease ·{" "}
            {policy.deadlineMs / 1000}s cooperative deadline · {policy.pollMs}ms idle polling.
            Jitter: 75–125%, capped.
          </Text>
        </div>
        <details className="delivery-guidance">
          <summary>Published contracts are durable · handlers supply the business effect</summary>
          <p>
            One worker runs inside this service using its connected Postgres database. Jeeves owns
            delivery and retries. New deliveries use the selected preset; queued deliveries retain
            theirs.
          </p>
          <p>
            After generation, retain event IDs, types, versions and payloads. Append a new event
            version when a payload changes. Save updates the design; Generate applies it to the
            project.
          </p>
        </details>
        <div className="delivery-layout">
          <aside className="delivery-contracts" aria-label="Event contracts">
            <div className="delivery-list-heading">
              <strong>Contracts</strong>
              <span>{draft.events.length} / 20</span>
            </div>
            <nav aria-label="Select event contract" className="delivery-contract-list">
              {draft.events.map((item, i) => (
                <button
                  key={keyOf(item)}
                  type="button"
                  aria-pressed={i === index}
                  aria-label={`Edit event ${i + 1}: ${item.type || "Untitled"}${eventInvalid(i) ? ", needs review" : ""}`}
                  data-invalid={eventInvalid(i)}
                  onClick={() => setSelectedEvent(keyOf(item))}
                >
                  <strong>{item.type || "Untitled event"}</strong>
                  <span>
                    {item.id || "No ID"} · v{item.version}
                  </span>
                  <small>
                    {item.fields.length} field{item.fields.length === 1 ? "" : "s"}
                    {eventInvalid(i) ? " · Review" : ""}
                  </small>
                </button>
              ))}
            </nav>
            <Button
              size="xs"
              variant="default"
              disabled={draft.events.length >= 20}
              ref={addEventButton}
              onClick={addEvent}
            >
              Add event contract
            </Button>
          </aside>
          {event ? (
            <fieldset className="delivery-event-panel" key={eventKey} ref={eventEditor}>
              <legend>Contract</legend>
              <Stack gap="sm">
                <div className="delivery-identity">
                  <TextInput
                    label="ID"
                    aria-label={`Event ${index + 1} ID`}
                    value={event.id}
                    onChange={(e) => changeEvent({ id: e.currentTarget.value })}
                  />
                  <TextInput
                    label="Type"
                    aria-label={`Event ${index + 1} type`}
                    value={event.type}
                    onChange={(e) => changeEvent({ type: e.currentTarget.value })}
                  />
                  <NumberInput
                    label="Version"
                    aria-label={`Event ${index + 1} version`}
                    min={1}
                    max={1000}
                    allowDecimal={false}
                    value={event.version}
                    onChange={(v) => changeEvent({ version: Number(v) })}
                  />
                </div>
                <div className="delivery-list-heading">
                  <strong>Required payload</strong>
                  <Button
                    size="compact-xs"
                    variant="default"
                    disabled={event.fields.length >= 20}
                    aria-label={`Add field to event ${index + 1}`}
                    onClick={addField}
                  >
                    Add field
                  </Button>
                </div>
                <nav
                  className="delivery-field-list"
                  aria-label={`Payload fields for event ${index + 1}`}
                >
                  {event.fields.map((item, i) => (
                    <button
                      key={keyOf(item)}
                      type="button"
                      aria-pressed={i === fieldIndex}
                      aria-label={`Edit event ${index + 1} field ${i + 1}: ${item.name || "Unnamed"}${fieldInvalid(i) ? ", needs review" : ""}`}
                      data-invalid={fieldInvalid(i)}
                      onClick={() => chooseField(item)}
                    >
                      <strong>{item.name || "Unnamed"}</strong>
                      <small>
                        {item.type}
                        {fieldInvalid(i) ? " · Review" : ""}
                      </small>
                    </button>
                  ))}
                </nav>
                {focusedField ? (
                  <fieldset
                    className="delivery-field-panel"
                    key={keyOf(focusedField)}
                    ref={fieldEditor}
                  >
                    <legend>Payload field</legend>
                    <FieldInputs
                      field={focusedField}
                      eventIndex={index}
                      index={fieldIndex}
                      onChange={(next) => {
                        keys.current.set(next, keyOf(focusedField));
                        changeEvent({
                          fields: event.fields.map((f, i) => (i === fieldIndex ? next : f)),
                        });
                      }}
                    />
                    <Button
                      mt="xs"
                      size="xs"
                      className="delivery-remove"
                      aria-label={`Remove field ${fieldIndex + 1} from event ${index + 1}`}
                      variant="default"
                      onClick={() => {
                        const fields = event.fields.filter((_, i) => i !== fieldIndex);
                        changeEvent({ fields });
                        const next = fields[Math.min(fieldIndex, fields.length - 1)];
                        if (next) chooseField(next);
                      }}
                    >
                      Remove field
                    </Button>
                  </fieldset>
                ) : (
                  <Text size="sm">Add at least one required payload field.</Text>
                )}
                <Textarea
                  label="Business effect"
                  aria-label={`Event ${index + 1} business effect`}
                  description="Describe the project-owned handler. Implementation and fixed acceptance are still required."
                  value={event.notes}
                  onChange={(e) => changeEvent({ notes: e.currentTarget.value })}
                />
                <details>
                  <summary>Verification metadata</summary>
                  <TextInput
                    label="Acceptance references"
                    aria-label={`Event ${index + 1} acceptance references`}
                    description="Separate fixed acceptance IDs with commas."
                    value={event.acceptance.join(", ")}
                    onChange={(e) =>
                      changeEvent({
                        acceptance: e.currentTarget.value.split(",").map((v) => v.trim()),
                      })
                    }
                  />
                </details>
                <Button
                  size="xs"
                  className="delivery-remove"
                  aria-label={`Remove contract for event ${index + 1}`}
                  variant="default"
                  onClick={() => {
                    const events = draft.events.filter((_, i) => i !== index);
                    setDraft({ ...draft, events });
                    const next = events[Math.min(index, events.length - 1)];
                    setSelectedEvent(next ? keyOf(next) : undefined);
                  }}
                >
                  Remove contract
                </Button>
              </Stack>
            </fieldset>
          ) : (
            <Text size="sm">Add an event contract to define its payload and business effect.</Text>
          )}
        </div>
        {issues.length ? (
          <Alert color="red" role="alert" title="Review the complete draft">
            <ul className="delivery-issues">
              {issues.map((issue) => (
                <li key={`${issue.path.join(".")}:${issue.code}:${issue.message}`}>
                  <button type="button" onClick={() => review(issue)}>
                    {typeof issue.path[1] === "number" ? `Event ${issue.path[1] + 1}` : "Contracts"}
                    {typeof issue.path[3] === "number" ? `, field ${issue.path[3] + 1}` : ""}:{" "}
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
