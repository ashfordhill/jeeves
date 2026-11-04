import ELK from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import { layoutStudio, type StudioLayoutInput } from "./layout.ts";

// The studio worker owns the whole layout; ELK itself runs in a nested worker it controls.
const channel = globalThis as unknown as {
  onmessage: (event: MessageEvent<StudioLayoutInput>) => void;
  postMessage: (data: unknown) => void;
};
channel.onmessage = ({ data }) => {
  const elk = new ELK({ workerFactory: () => new Worker(elkWorkerUrl) });
  void layoutStudio(data, elk).then(
    (layout) => {
      elk.terminateWorker();
      channel.postMessage({ layout });
    },
    () => {
      elk.terminateWorker();
      channel.postMessage({ error: "Diagram layout could not finish." });
    },
  );
};
