import { formatTemplateRef, type TemplateLookup, type TemplateRef } from "@jeeves/spec";
import { durableEventsTemplate } from "@jeeves/template-durable-events/template";
import {
  httpServiceTemplate,
  httpServiceV02Template,
} from "@jeeves/template-http-service/template";
import { manifestLookup, type TemplateModule } from "@jeeves/template-kit";
import { postgresTemplate } from "@jeeves/template-postgres/template";
import { restApiClientTemplate } from "@jeeves/template-rest-api-client/template";
import { restApiServerTemplate } from "@jeeves/template-rest-api-server/template";
import { webAppTemplate } from "@jeeves/template-web-app/template";

/** The five v1 templates (PLAN §8), as generate-capable modules. */
export function builtinModules(): TemplateModule[] {
  return [
    httpServiceTemplate,
    httpServiceV02Template,
    durableEventsTemplate,
    restApiServerTemplate,
    postgresTemplate,
    webAppTemplate,
    restApiClientTemplate,
  ];
}

/** Modules plus a manifest lookup over them, which is what generation and test packs need. */
export interface TemplateSet {
  modules: TemplateModule[];
  lookup: TemplateLookup;
  module(ref: TemplateRef): TemplateModule;
}

export class UnknownTemplateError extends Error {}

export function templateSet(modules: TemplateModule[] = builtinModules()): TemplateSet {
  return {
    modules,
    lookup: manifestLookup(modules.map((m) => m.manifest)),
    module(ref) {
      const found = modules.find(
        (m) => m.manifest.id === ref.id && m.manifest.version === ref.version,
      );
      if (!found) {
        throw new UnknownTemplateError(`No template module for ${formatTemplateRef(ref)}`);
      }
      return found;
    },
  };
}
