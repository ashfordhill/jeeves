import type { NormalizedProcess } from "@jeeves/spec";
import { endpointId } from "./local-contract.ts";

export const auth0Prefix = (identity: string) => `JEEVES_AUTH0_${endpointId(identity)}`;

export function auth0Workload(process: NormalizedProcess) {
  if (process.workload?.provider !== "auth0") return undefined;
  const prefix = auth0Prefix(process.workload.identity);
  const service = (tile: string) => `${prefix}_SERVICE_${endpointId(tile)}`;
  return {
    issuer: `${prefix}_ISSUER`,
    ownClient: `${service(process.tile)}_CLIENT_ID`,
    ownAudience: `${service(process.tile)}_AUDIENCE`,
    userAudience: `${prefix}_AUDIENCE`,
    callers: Object.fromEntries(
      (process.workloadCallers ?? []).map((caller) => [caller, `${service(caller)}_CLIENT_ID`]),
    ),
    targets: Object.fromEntries(
      (process.serviceCalls ?? []).map(({ target }) => [target, `${service(target)}_AUDIENCE`]),
    ),
  };
}

export function auth0WorkloadEnvironment(process: NormalizedProcess) {
  const binding = auth0Workload(process);
  return binding
    ? [
        binding.issuer,
        binding.ownClient,
        binding.ownAudience,
        binding.userAudience,
        ...Object.values(binding.callers),
        ...Object.values(binding.targets),
        "JEEVES_WORKLOAD_SECRET_FILE",
      ]
    : [];
}
