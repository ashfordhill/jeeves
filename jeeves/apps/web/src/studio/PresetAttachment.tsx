import { applyOperations, type DesignDocument, supportedGenerationPresets } from "@jeeves/spec";
import { useState } from "react";
import { commitAction } from "./actions.ts";
import { buildEditorCommand, useGenerationSupport } from "./generation-support.ts";

/** Feature selection lives in the existing system inspector, with an explicit atomic preview. */
export function PresetAttachment({
  projectId,
  design,
}: {
  projectId: string;
  design: DesignDocument;
}) {
  const installed = useGenerationSupport();
  const presets = supportedGenerationPresets(installed);
  const [preset, setPreset] = useState<"video" | "youtube">("video");
  const [preview, setPreview] = useState<{
    revision: number;
    prefix?: string;
    tiles: number;
    modules: number;
  }>();
  const [error, setError] = useState<string>();
  if (design.schemaVersion === 3 && design.generation?.preset)
    return (
      <p className="studio-field-help">
        Experimental local TypeScript feature selected. Custom hooks and unsupported preserved
        intent remain generation gaps.
      </p>
    );
  if (!presets.length)
    return <p className="studio-field-help">Feature support is unavailable from this server.</p>;
  const review = () => {
    try {
      let prefix: string | undefined;
      let batch: ReturnType<typeof buildEditorCommand> | undefined;
      for (let attempt = 0; attempt < 100; attempt++) {
        prefix = attempt ? `${preset}-${attempt}` : undefined;
        try {
          batch = buildEditorCommand(design, { type: "attachGenerationPreset", preset, prefix });
          break;
        } catch (failure) {
          if (!(failure instanceof Error) || !failure.message.includes("already exists"))
            throw failure;
        }
      }
      if (!batch) throw new Error("No free attachment identity is available.");
      const result = applyOperations(design, batch.ops);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Attachment refused");
      setPreview({
        revision: design.revision,
        prefix,
        tiles: result.design.elements.length - design.elements.length,
        modules:
          (result.design.architecture?.studio?.components?.length ?? 0) -
          (design.architecture?.studio?.components?.length ?? 0),
      });
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  return (
    <fieldset>
      <legend>Add a supported feature</legend>
      <label>
        Feature preset
        <select
          aria-label="Feature preset"
          value={preset}
          onChange={(event) => {
            setPreset(event.target.value as typeof preset);
            setPreview(undefined);
          }}
        >
          {presets.map((value) => (
            <option key={value} value={value}>
              {value === "video" ? "Owned upload + video processing" : "Historical YouTube design"}
            </option>
          ))}
        </select>
      </label>
      <p className="studio-field-help">
        {preset === "video"
          ? "Reusable upload and CPU HLS processing. Your application supplies product codecs and service hooks; this remains a partial application."
          : "Historical product declarations require custom implementation after generation."}
      </p>
      <button type="button" onClick={review}>
        Preview attachment
      </button>
      {preview && preview.revision === design.revision ? (
        <div role="status">
          <p>
            Add {preview.tiles} tiles and {preview.modules} bound modules with their connected
            resources. Existing declarations are retained.{" "}
            {design.schemaVersion === 2 ? "Explicitly upgrades source to schema v3. " : ""}One Undo
            step.
          </p>
          <button
            type="button"
            onClick={() =>
              void commitAction(projectId, (latest) => {
                if (latest.revision !== preview.revision)
                  throw new Error("Source changed; preview the attachment again.");
                return buildEditorCommand(latest, {
                  type: "attachGenerationPreset",
                  preset,
                  prefix: preview.prefix,
                }).ops;
              })
            }
          >
            Attach feature
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  );
}
