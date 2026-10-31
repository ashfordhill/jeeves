import { type DesignDocument, type LocalHttpPoolBinding, localHttpPoolFor } from "@jeeves/spec";
import type { ComposeFile } from "@jeeves/template-kit";
import { poolDefinition } from "@jeeves/template-local-http-pool/template";

/** Run after the ordinary strict merge so every clone gets the complete API/database wiring. */
export function composeHttpPools(
  design: DesignDocument,
  compose: ComposeFile,
): Record<string, LocalHttpPoolBinding> {
  const bindings: Record<string, LocalHttpPoolBinding> = {};
  for (const element of design.elements) {
    const binding = localHttpPoolFor(element);
    if (!binding) continue;
    const pool = poolDefinition(element),
      base = compose.services[element.id];
    if (!base?.build || !base.environment?.DATABASE_HOST)
      throw new Error(`Pool ${element.id} is missing its complete application wiring`);
    for (const name of binding.instances) {
      if (compose.services[name])
        throw new Error(`Pool instance ${name} conflicts with a generated service`);
      compose.services[name] = structuredClone(base);
    }
    compose.services[element.id] = { ...pool.proxyCompose, ports: base.ports };
    bindings[element.id] = binding;
  }
  return bindings;
}
