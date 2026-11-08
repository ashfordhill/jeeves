import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("", "upload-jobs");
// Transport for upload-jobs-only relay; pending+intent commits in state/video.ts.
