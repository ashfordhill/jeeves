import durableEvents from "@jeeves/template-durable-events";
import httpService from "@jeeves/template-http-service";
import httpServiceV02 from "@jeeves/template-http-service/v02";
import postgres from "@jeeves/template-postgres";
import restApiClient from "@jeeves/template-rest-api-client";
import restApiServer from "@jeeves/template-rest-api-server";
import webApp from "@jeeves/template-web-app";
import { createRegistry, type Registry } from "./registry.ts";

/** Manifests of the templates that ship in this repo (`templates/*`). */
export const builtinManifests = [
  httpService,
  httpServiceV02,
  durableEvents,
  restApiServer,
  postgres,
  webApp,
  restApiClient,
];

let builtin: Registry | undefined;

/** Registry of the built-in templates, created on first use. */
export function builtinRegistry(): Registry {
  builtin ??= createRegistry(builtinManifests);
  return builtin;
}
