import { createHash } from "node:crypto";
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./object-roundtrip.slots.ts";
export async function objectRoundtrip(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { key, base64 } = request.body as { key: string; base64: string };
  await dependencies.objects.put(key, Buffer.from(base64, "base64"), "application/octet-stream");
  const bytes = await dependencies.objects.get(key);
  if (!bytes) throw new Error("Stored object missing");
  return {
    body: {
      key,
      base64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    },
  };
}
