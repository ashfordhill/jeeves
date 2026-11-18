// Task-only fault infrastructure. Production recovery remains the generated callee protocol.

import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";

const control = () => JSON.parse(readFileSync("/rg/control.json", "utf8"));
const events = [];
const acks = [];
let ingress = 0;
const waitRelease = async (name) => {
  while (control()[name]) await new Promise((r) => setTimeout(r, 25));
};
http
  .createServer(async (req, res) => {
    try {
      if (req.url === "/stats") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ events, acks, ingress, commits }));
        return;
      }
      const body = Buffer.concat(await Array.fromAsync(req));
      const incoming = req.url.startsWith("/inbox");
      let envelope;
      try {
        envelope = JSON.parse(body);
      } catch {}
      const phase = incoming ? "ingress" : envelope?.phase;
      const record = {
        phase,
        key: envelope?.key ?? envelope?.id,
        from: req.socket.remoteAddress,
        status: null,
      };
      if (incoming) ingress++;
      events.push(record);
      const target = incoming
        ? "http://app-caller:3000/modules/catalog-events"
        : "http://app-callee:3000" + req.url;
      const result = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: body.length ? body : undefined,
        redirect: "manual",
      });
      const bytes = Buffer.from(await result.arrayBuffer());
      record.status = result.status;
      if (incoming && control().holdIngress) await waitRelease("holdIngress");
      if (phase === "execute" && control().holdExecute) await waitRelease("holdExecute");
      const headers = Object.fromEntries(result.headers);
      delete headers["content-length"];
      delete headers["content-encoding"];
      delete headers["transfer-encoding"];
      res.writeHead(result.status, headers);
      res.end(bytes);
    } catch {
      res.writeHead(502);
      res.end();
    }
  })
  .listen(8080, "0.0.0.0");
// AMQP 0-9-1 framing. Withhold Basic.Ack after the real receipt transaction commits.
net
  .createServer((client) => {
    const upstream = net.connect(5672, "local-broker");
    let bytes = Buffer.alloc(0),
      header = true;
    client.on("data", (chunk) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (header) {
        if (bytes.length < 8) return;
        upstream.write(bytes.subarray(0, 8));
        bytes = bytes.subarray(8);
        header = false;
      }
      while (bytes.length >= 8) {
        const length = bytes.readUInt32BE(3) + 8;
        if (bytes.length < length) return;
        const frame = bytes.subarray(0, length);
        bytes = bytes.subarray(length);
        const ack = frame[0] === 1 && frame.readUInt16BE(7) === 60 && frame.readUInt16BE(9) === 80;
        if (ack) {
          acks.push({ from: client.remoteAddress, held: !!control().holdAck });
          if (control().holdAck) continue;
        }
        upstream.write(frame);
      }
    });
    upstream.pipe(client);
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  })
  .listen(5673, "0.0.0.0");

// Task-only PostgreSQL wire gate: retain the actual acceptance COMMIT before dispatch.
// Credentials and bind values pass through without recording. No generated source is altered.
const commits = [];
net
  .createServer((client) => {
    const upstream = net.connect(5432, "local-postgres");
    let buffered = Buffer.alloc(0),
      startup = true,
      insert = false,
      held = [];
    const forward = (frame) => {
      if (held.length) held.push(frame);
      else upstream.write(frame);
    };
    client.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (startup) {
        if (buffered.length < 4) return;
        const length = buffered.readUInt32BE(0);
        if (buffered.length < length) return;
        upstream.write(buffered.subarray(0, length));
        buffered = buffered.subarray(length);
        startup = false;
      }
      while (buffered.length >= 5) {
        const length = buffered.readUInt32BE(1) + 1;
        if (buffered.length < length) return;
        const frame = buffered.subarray(0, length);
        buffered = buffered.subarray(length);
        const type = String.fromCharCode(frame[0]);
        if (
          (type === "P" || type === "Q") &&
          frame.toString("utf8", 5).includes("INSERT INTO jeeves.work_records")
        )
          insert = true;
        const sql =
          type === "Q"
            ? frame
                .toString("utf8", 5, frame.length - 1)
                .trim()
                .toUpperCase()
            : "";
        if (sql === "COMMIT" && insert && control().holdCommit) {
          const record = { released: false, from: client.remoteAddress };
          commits.push(record);
          held.push(frame);
          insert = false;
          void waitRelease("holdCommit")
            .then(() => {
              for (const item of held) upstream.write(item);
              held = [];
              record.released = true;
            })
            .catch(() => client.destroy());
        } else {
          forward(frame);
          if (sql === "COMMIT" || sql === "ROLLBACK") insert = false;
        }
      }
    });
    upstream.pipe(client);
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  })
  .listen(5433, "0.0.0.0");
