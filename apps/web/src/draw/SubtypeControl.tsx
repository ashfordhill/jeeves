import { builtinRegistry } from "@jeeves/registry";
import {
  type Element,
  reviewTemplateUpgrade,
  subtypeDiscards,
  type TemplateRef,
  type TemplateUpgradeReview,
} from "@jeeves/spec";
import { Button, Menu, Modal } from "@mantine/core";
import { useState } from "react";
import { templateKey } from "./flow.ts";
import { useDraw } from "./store.ts";
import { TemplateUpgradeDialog } from "./TemplateUpgradeDialog.tsx";

const registry = builtinRegistry();

/** Both inline and inspector controls submit the exact same reviewed operation. */
export function SubtypeControl({
  element,
  disabled = false,
  implementationDetails = false,
  cardLabel,
}: {
  element: Element;
  disabled?: boolean;
  implementationDetails?: boolean;
  cardLabel?: string;
}) {
  const loaded = useDraw((s) => s.loaded);
  const edit = useDraw((s) => s.edit);
  const [review, setReview] = useState<
    { template: TemplateRef | null; revision: number; discarded: string[] } | undefined
  >();
  const [upgrade, setUpgrade] = useState<{ target: TemplateRef; review: TemplateUpgradeReview }>();
  if (!loaded) return null;
  const releases = loaded.catalog.templates.filter(
    (t) => t.kind === "element" && t.elementKind !== "database",
  );
  // The registry explicitly orders semantic versions. Existing instances always keep their pin.
  const options = [...new Set(releases.map((t) => t.id))].flatMap((id) => {
    const ref = element.template?.id === id ? element.template : registry.latest(id);
    return releases.find((t) => t.id === ref?.id && t.version === ref.version) ?? [];
  });
  const apply = (
    template: TemplateRef | null,
    confirmation?: { revision: number; discarded: string[] },
  ) =>
    void edit([
      { op: "changeSubtype", id: element.id, template, ...(confirmation && { confirmation }) },
    ]);
  const choose = (template: TemplateRef | null) => {
    if (element.template && template?.id === element.template.id) return;
    const discarded = subtypeDiscards(loaded.design, element);
    if (discarded.length) setReview({ template, discarded, revision: loaded.design.revision });
    else apply(template);
  };
  return (
    <fieldset
      className="nodrag nopan"
      onKeyDown={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label="Service subtype"
    >
      {cardLabel ? (
        <Menu position="bottom-start" shadow="md">
          <Menu.Target>
            <button
              type="button"
              className="element-card-template subtype-menu"
              disabled={disabled}
              aria-label={`Change subtype of ${element.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              {cardLabel} ▾
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Service subtype</Menu.Label>
            {options.map((t) => (
              <Menu.Item key={t.id} onClick={() => choose({ id: t.id, version: t.version })}>
                {t.displayName}
              </Menu.Item>
            ))}
            <Menu.Item onClick={() => choose(null)}>Needs a template</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ) : (
        <label>
          Subtype
          <select
            aria-label={`Subtype of ${element.name}`}
            value={element.template ? templateKey(element.template) : ""}
            onChange={(event) => {
              const picked = options.find((t) => templateKey(t) === event.currentTarget.value);
              choose(picked ? { id: picked.id, version: picked.version } : null);
            }}
          >
            <option value="">Choose subtype</option>
            {options.map((t) => (
              <option key={templateKey(t)} value={templateKey(t)}>
                {t.displayName}
              </option>
            ))}
          </select>
        </label>
      )}
      {element.template && implementationDetails ? (
        <details className="subtype-implementation">
          <summary>Implementation version</summary>
          <label>
            Template release
            <select
              aria-label={`Template release of ${element.name}`}
              value={templateKey(element.template)}
              onChange={(event) => {
                const picked = releases.find((t) => templateKey(t) === event.currentTarget.value);
                if (!picked || picked.version === element.template?.version) return;
                const target = { id: picked.id, version: picked.version };
                setUpgrade({
                  target,
                  review: reviewTemplateUpgrade(loaded.design, element.id, target, registry),
                });
              }}
            >
              {releases
                .filter((t) => t.id === element.template?.id)
                .map((t) => (
                  <option key={templateKey(t)} value={templateKey(t)}>
                    {t.displayName} · {t.version}
                  </option>
                ))}
            </select>
          </label>
        </details>
      ) : null}
      {upgrade ? (
        <TemplateUpgradeDialog
          name={element.name}
          target={upgrade.target}
          review={upgrade.review}
          onClose={() => setUpgrade(undefined)}
        />
      ) : null}
      <Modal opened={!!review} onClose={() => setReview(undefined)} title="Change service subtype?">
        <p>This change discards:</p>
        <ul>
          {review?.discarded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Button variant="default" onClick={() => setReview(undefined)}>
          Cancel
        </Button>{" "}
        <Button
          color="red.9"
          onClick={() => {
            if (review)
              apply(review.template, { revision: review.revision, discarded: review.discarded });
            setReview(undefined);
          }}
        >
          Discard and change subtype
        </Button>
      </Modal>
    </fieldset>
  );
}
