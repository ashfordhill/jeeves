import { type DesignDocument, localHttpPoolFor } from "@jeeves/spec";
import type { TestPackContext } from "@jeeves/template-kit";
/** Physical pool checks use actual Compose. Application checks keep their logical identity. */
export function poolCheckContexts(design: DesignDocument, ctx: TestPackContext): TestPackContext[] {
  if (ctx.subject.manifest.id === "local-http-pool") return [ctx];
  const bindings = Object.fromEntries(
    design.elements.flatMap((element) => {
      const binding = localHttpPoolFor(element);
      return binding ? [[element.id, binding]] : [];
    }),
  );
  if (!Object.keys(bindings).length) return [ctx];
  const binding = bindings[ctx.subject.element.id];
  const perInstance =
    binding && ["http-service", "local-execution"].includes(ctx.subject.manifest.id);
  const targets = perInstance ? binding.instances : [undefined];
  return targets.map((target) => {
    const compose = structuredClone(ctx.compose);
    for (const [id, pool] of Object.entries(bindings)) {
      const instance = id === ctx.subject.element.id && target ? target : pool.instances[0]!;
      const actual = compose.services[instance];
      if (!actual) throw new Error(`Missing physical pool instance ${instance}`);
      compose.services[id] = actual;
    }
    return {
      ...ctx,
      compose,
      service: (name) => ctx.service(target && name === ctx.subject.element.id ? target : name),
      log: (line) => ctx.log(target ? `[${target}] ${line}` : line),
    };
  });
}
