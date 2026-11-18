import type { NormalizedGeneration } from "@jeeves/spec";

export const hasFrontDoor = (model: NormalizedGeneration) =>
  !!model.processes?.some((p) => p.frontDoor === "required");

/** Template-only optional surface; absent settings retain the previous runtime's exact bytes. */
export function frontDoorHttp(source: Uint8Array, enabled: boolean) {
  return new TextDecoder()
    .decode(source)
    .replace(
      /(?:\n)?\/\* @frontDoor-start \*\/(?:\n)?([\s\S]*?)\/\* @frontDoor-end \*\//g,
      (_block, body: string) => (enabled ? `\n${body}` : ""),
    );
}
