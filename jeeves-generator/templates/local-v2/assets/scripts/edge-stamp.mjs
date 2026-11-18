import { createHmac } from "node:crypto";
import { createServer, request as forward } from "node:http";
import { pathToFileURL } from "node:url";

/** Generated local edge component. Targets are compiled, never supplied by an incoming header. */
export function createStampEdge({ key, targets }) {
  if (typeof key !== "string" || !/^[\x21-\x7e]{32,512}$/.test(key))
    throw new Error("Invalid setting JEEVES_EDGE_STAMP_KEY");
  return createServer((request, response) => {
    const url = request.url ?? "";
    if (url === "/healthz") {
      response.end("ready");
      return;
    }
    const match = /^\/api\/([^/]+)(\/.*)$/.exec(url);
    const target = match && Object.hasOwn(targets, match[1]) ? targets[match[1]] : undefined;
    if (!target) {
      response.writeHead(404);
      response.end();
      return;
    }
    const path = match[2];
    const seconds = String(Math.floor(Date.now() / 1000));
    const stamp = `v1.${seconds}.${createHmac("sha256", key)
      .update(`${seconds}.${request.method}.${path.split("?", 1)[0]}`)
      .digest("hex")}`;
    const headers = { ...request.headers, host: target, "x-edge-stamp": stamp };
    // A client's hop-by-hop declarations cannot remove the generated stamp or transport auth.
    for (const name of (request.headers.connection ?? "").split(","))
      delete headers[name.trim().toLowerCase()];
    for (const name of [
      "connection",
      "proxy-connection",
      "keep-alive",
      "upgrade",
      "trailer",
      "te",
      "transfer-encoding",
    ])
      delete headers[name];
    headers["x-edge-stamp"] = stamp;
    const [hostname, port] = target.split(":");
    const upstream = forward({ hostname, port, path, method: request.method, headers }, (reply) => {
      const outgoing = { ...reply.headers };
      delete outgoing["x-edge-stamp"];
      response.writeHead(reply.statusCode ?? 503, outgoing);
      reply.pipe(response);
    });
    upstream.setTimeout(300000, () => upstream.destroy());
    upstream.on("error", () => {
      if (response.headersSent) response.destroy();
      else {
        response.writeHead(503, { "Content-Type": "application/json", "Retry-After": "1" });
        response.end(JSON.stringify({ error: "UNAVAILABLE", message: "Service unavailable." }));
      }
    });
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableEnded) upstream.destroy();
    });
    request.pipe(upstream);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readFileSync } = await import("node:fs");
  const { edgeStamp } = JSON.parse(readFileSync("infra/local.json", "utf8"));
  const server = createStampEdge({
    key: process.env.JEEVES_EDGE_STAMP_KEY,
    targets: Object.fromEntries(edgeStamp.map((host) => [host, `app-${host}:3000`])),
  });
  server.listen(3000, "0.0.0.0");
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      server.close();
      server.closeIdleConnections();
    });
}
