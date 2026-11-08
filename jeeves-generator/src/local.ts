import { readFileSync } from "node:fs";
import type { ExperimentalInput } from "./input.ts";
import { youtubeLocalProfile } from "./profile.ts";

/** Trusted, repository-owned frozen profile assets. Ship this directory with server Docker. */
export function loadYoutubeLocalInput(): ExperimentalInput {
  const root = new URL("../../field-projects/youtube/v1/", import.meta.url);
  return {
    profileId: youtubeLocalProfile.id,
    artifacts: Object.fromEntries(
      Object.keys(youtubeLocalProfile.artifacts).map((name) => [
        name,
        readFileSync(new URL(`inputs/${name}`, root), "utf8"),
      ]),
    ) as ExperimentalInput["artifacts"],
    diagramPng: readFileSync(new URL("diagrams/005-local-intent-aligned/diagram.png", root)),
  };
}
