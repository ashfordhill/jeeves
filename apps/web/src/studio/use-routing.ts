import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  movedStudioGeometry,
  type RouteBox,
  type StudioGeometry,
  type StudioPath,
  studioFallbackGeometry,
  studioIncidentPaths,
  studioLabelTexts,
} from "./routing.ts";
import { routeStudio, type StudioRoutingInput } from "./routing-client.ts";

/** Last valid geometry stays mounted while newer work runs, fails, or is cancelled. */
export function useStudioRouting(
  scope: string,
  paths: StudioPath[],
  nodes: Record<string, RouteBox>,
  moving: boolean,
) {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) setFontReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const input = useMemo((): StudioRoutingInput => {
    const context = fontReady ? document.createElement("canvas").getContext("2d") : null;
    if (context) context.font = '12px "Nunito Variable", Nunito, system-ui, sans-serif';
    const texts = studioLabelTexts(paths);
    return {
      scope,
      sizingVersion: 1,
      paths,
      nodes,
      widths: Object.fromEntries(
        texts.map((text) => [
          text,
          context?.measureText(text).width ?? Array.from(text).length * 8,
        ]),
      ),
    };
  }, [scope, paths, nodes, fontReady]);
  const key = useMemo(() => JSON.stringify(input), [input]);
  const latest = useRef(input);
  latest.current = input;
  const generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
  }, []);
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => ({ key, attempt }), [key, attempt]);
  const [result, setResult] = useState<{ key: string; routes: StudioGeometry }>();
  const [error, setError] = useState<string>();
  const previous = useRef<
    | { paths: Map<string, StudioPath>; nodes: Record<string, RouteBox>; routes: StudioGeometry }
    | undefined
  >(undefined);
  const geometry = useMemo(() => {
    if (result?.key === key) return result.routes;
    const fallback = studioFallbackGeometry(paths, nodes),
      old = previous.current;
    if (!old) return fallback;
    const retained: StudioGeometry = {};
    for (const path of paths) {
      const before = old.paths.get(path.id);
      const route = old.routes[path.id];
      if (before?.item.from === path.item.from && before?.item.to === path.item.to && route)
        retained[path.id] = route;
    }
    return {
      ...fallback,
      ...movedStudioGeometry(
        retained,
        new Map(paths.map((p) => [p.id, p])),
        old.nodes,
        nodes,
        studioIncidentPaths(paths),
      ),
    };
  }, [result, key, paths, nodes]);
  useEffect(() => {
    previous.current = { paths: new Map(paths.map((p) => [p.id, p])), nodes, routes: geometry };
  }, [paths, nodes, geometry]);
  useEffect(() => {
    invalidate();
    setError(undefined);
    if (moving || !fontReady || !latest.current.paths.length) return;
    const current = generation.current,
      abort = new AbortController();
    controller.current = abort;
    void routeStudio(latest.current, abort.signal).then(
      (routes) => {
        if (!abort.signal.aborted && generation.current === current)
          setResult({ key: request.key, routes });
      },
      () => {
        if (!abort.signal.aborted && generation.current === current)
          setError("Diagram routing failed. Existing paths are retained.");
      },
    );
    return () => {
      abort.abort();
    };
  }, [request, moving, fontReady, invalidate]);
  return {
    geometry,
    error,
    invalidate,
    retry: () => setAttempt((value) => value + 1),
    generation: generation.current,
  };
}
