import { createServer, type Server } from "node:http";

/** A local destination server: every request counts, and nothing public is contacted. */
export class Destination {
  private count = 0;
  private readonly server: Server;
  readonly url: string;

  private constructor(url: string, server: Server) {
    this.url = url;
    this.server = server;
    server.on("request", (request, response) => {
      void request.resume();
      this.count += 1;
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
    });
  }

  static async start(path = "/destination"): Promise<Destination> {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No destination port");
    return new Destination(`http://127.0.0.1:${address.port}${path}`, server);
  }

  requests(): number {
    return this.count;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export async function fetchDestination(url: string): Promise<number> {
  const response = await fetch(url, { redirect: "manual" });
  await response.arrayBuffer();
  return response.status;
}
