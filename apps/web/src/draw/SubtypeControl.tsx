import { type Element, subtypeDiscards, type TemplateRef } from "@jeeves/spec";
import { Button, Modal } from "@mantine/core";
import { useState } from "react";
import { templateKey } from "./flow.ts";
import { useDraw } from "./store.ts";

/** Both inline and inspector controls submit the exact same reviewed operation. */
export function SubtypeControl({ element }: { element: Element }) {
  const loaded = useDraw((s) => s.loaded);
  const edit = useDraw((s) => s.edit);
  const [review, setReview] = useState<
    { template: TemplateRef | null; revision: number; discarded: string[] } | undefined
  >();
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
            </option>
          ))}
        </select>
      </label>
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
