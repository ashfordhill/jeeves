import { studioRouteGeometry } from "./routing.ts";
import type { StudioRoutingInput } from "./routing-client.ts";

// Pure geometry in the worker; font measurements come from the loaded main-thread font.
const channel = globalThis as unknown as {
  onmessage: (event: MessageEvent<StudioRoutingInput>) => void;
  postMessage: (data: unknown) => void;
};
channel.onmessage = ({ data }) => {
  try {
    channel.postMessage({
      geometry: studioRouteGeometry(
        data.paths,
        data.nodes,
        (text) => data.widths[text] ?? Array.from(text).length * 8,
        data.fixed,
      ),
    });
  } catch {
    channel.postMessage({ error: "Diagram routing could not finish." });
  }
};
