import { formatTemplateRef, type TemplateLookup, type TemplateRef } from "@jeeves/spec";
import { durableEventsTemplate } from "@jeeves/template-durable-events/template";
import {
  httpServiceTemplate,
  httpServiceV02Template,
  httpServiceV03Template,
} from "@jeeves/template-http-service/template";
import { manifestLookup, type TemplateModule } from "@jeeves/template-kit";
import { localExecutionTemplate } from "@jeeves/template-local-execution/template";
import { postgresTemplate } from "@jeeves/template-postgres/template";
import { resourceWorkspaceTemplate } from "@jeeves/template-resource-workspace/template";
import { restApiClientTemplate } from "@jeeves/template-rest-api-client/template";
import { restApiServerTemplate } from "@jeeves/template-rest-api-server/template";
import { webAppTemplate, webAppV02Template } from "@jeeves/template-web-app/template";

/** The five v1 templates (PLAN §8), as generate-capable modules. */
export function builtinModules(): TemplateModule[] {
  return [
    httpServiceTemplate,
    httpServiceV02Template,
    httpServiceV03Template,
    localExecutionTemplate,
    durableEventsTemplate,
    restApiServerTemplate,
    postgresTemplate,
    webAppTemplate,
    webAppV02Template,
    resourceWorkspaceTemplate,
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
