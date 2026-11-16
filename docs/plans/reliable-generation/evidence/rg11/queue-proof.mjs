import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Installed, pinned dependency; no socket, connect, credentials, install or network.
const fromApp = createRequire("/home/ash/github/qrwty/app/package.json");
const redisPath = fromApp.resolve("redis");
const fromRedis = createRequire(redisPath);
const clientEntry = fromRedis.resolve("@redis/client");
const clientRoot = dirname(clientEntry);
const { default: Queue } = fromRedis(join(clientRoot, "lib/client/commands-queue.js"));
const { ErrorReply } = fromApp("redis");
const redisPackage = JSON.parse(readFileSync(join(dirname(redisPath), "../package.json")));
assert.equal(redisPackage.version, "6.3.0");
const queue = new Queue(3, 1);
const first = queue.addCommand(["SET", "key", "value"]);
assert.equal(queue.pendingCount, 1);
await assert.rejects(queue.addCommand(["EVAL", "never sent", "1", "key"]), (e) => {
  assert.equal(e.message, "The queue is full");
  assert.equal(e instanceof ErrorReply, false);
  return true;
});
assert.equal(queue.pendingCount, 1);
const wire = [...queue.commandsToWrite()];
assert.match(Buffer.concat(wire.flat().map((part) => Buffer.from(part))).toString(), /SET/);
assert.doesNotMatch(
  Buffer.concat(wire.flat().map((part) => Buffer.from(part))).toString(),
  /never sent/,
);
queue.decoder.write(Buffer.from("+OK\r\n"));
assert.equal(await first, "OK");
assert.equal(queue.pendingCount, 0);
const second = queue.addCommand(["PING"]);
[...queue.commandsToWrite()];
queue.decoder.write(Buffer.from("+PONG\r\n"));
assert.equal(await second, "PONG");
assert.equal(queue.pendingCount, 0);
console.log(
  "Pinned node-redis 6.3.0: full-queue rejection is local Error, before enqueue/wire; pendingCount unchanged; existing command and subsequent PING succeed.",
);
console.log(
  "No native socket/connect or Valkey operation executed; transport integration remains RG14.",
);
