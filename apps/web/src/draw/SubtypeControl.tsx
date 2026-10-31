import { builtinRegistry } from "@jeeves/registry";
import {
  type Element,
  reviewTemplateUpgrade,
  subtypeDiscards,
  type TemplateRef,
  type TemplateUpgradeReview,
} from "@jeeves/spec";
import { Button, Modal } from "@mantine/core";
import { useState } from "react";
import { templateKey } from "./flow.ts";
import { useDraw } from "./store.ts";
import { TemplateUpgradeDialog } from "./TemplateUpgradeDialog.tsx";

const registry = builtinRegistry();

/** Both inline and inspector controls submit the exact same reviewed operation. */
export function SubtypeControl({
  element,
  disabled = false,
}: {
  element: Element;
  disabled?: boolean;
}) {
  const loaded = useDraw((s) => s.loaded);
  const edit = useDraw((s) => s.edit);
  const [review, setReview] = useState<
    { template: TemplateRef | null; revision: number; discarded: string[] } | undefined
  >();
  const [upgrade, setUpgrade] = useState<{ target: TemplateRef; review: TemplateUpgradeReview }>();
  if (!loaded) return null;
  const options = loaded.catalog.templates.filter(
    (t) => t.kind === "element" && t.elementKind !== "database",
  );
  const apply = (
    template: TemplateRef | null,
    confirmation?: { revision: number; discarded: string[] },
  ) =>
    void edit([
      { op: "changeSubtype", id: element.id, template, ...(confirmation && { confirmation }) },
    ]);
  return (
    <fieldset
      className="nodrag nopan"
      onKeyDown={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label="Service subtype"
    >
      <label>
        Subtype
        <select
          aria-label={`Subtype of ${element.name}`}
          value={element.template ? templateKey(element.template) : ""}
          onChange={(e) => {
            const picked = options.find((t) => templateKey(t) === e.currentTarget.value);
            const template = picked ? { id: picked.id, version: picked.version } : null;
            if (element.template && template?.id === element.template.id) {
              if (template.version !== element.template.version)
                setUpgrade({
                  target: template,
                  review: reviewTemplateUpgrade(loaded.design, element.id, template, registry),
                });
              return;
            }
            const discarded = subtypeDiscards(loaded.design, element);
            if (discarded.length)
              setReview({ template, discarded, revision: loaded.design.revision });
            else apply(template);
          }}
        >
          <option value="">Choose subtype</option>
          {options.map((t) => (
            <option key={templateKey(t)} value={templateKey(t)}>
              {t.displayName}
              {options.filter((option) => option.id === t.id).length > 1 ? ` · ${t.version}` : ""}
            </option>
          ))}
        </select>
      </label>
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
