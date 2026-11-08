-- Only the studio format remains (CL2). Stored studio documents drop the pre-studio fields they
-- still carried: element template/config/attachments/notes, connection display and capability
-- fields, annotations, and the decision/handoff and other legacy architecture models. Layouts
-- drop board item positions and keep only studio view row order and camera.
CREATE FUNCTION jeeves_studio_design(d jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT (d - 'annotations' - 'recipe' - 'startedFrom' - 'elements' - 'connections' - 'architecture')
    || jsonb_build_object(
      'elements', COALESCE((
        SELECT jsonb_agg(
          e - 'template' - 'config' - 'attachments' - 'notes' - 'planned' - 'technology'
          ORDER BY i)
        FROM jsonb_array_elements(d->'elements') WITH ORDINALITY AS t(e, i)), '[]'::jsonb),
      'connections', COALESCE((
        SELECT jsonb_agg(
          (c - 'label' - 'protocol' - 'interaction' - 'config')
            || jsonb_build_object(
              'from', jsonb_build_object('element', c->'from'->'element'),
              'to', jsonb_build_object('element', c->'to'->'element'))
          ORDER BY i)
        FROM jsonb_array_elements(d->'connections') WITH ORDINALITY AS t(c, i)), '[]'::jsonb))
    || CASE WHEN d ? 'architecture' THEN jsonb_build_object('architecture',
      ((d->'architecture') - 'backend' - 'implementationHandoff' - 'components' - 'scenarios'
        - 'contracts' - 'interfaces' - 'bindings' - 'datasets' - 'objectives' - 'patternInstances'
        - 'reviewRequirements' - 'decisions' - 'deployments' - 'componentRelationships' - 'nodes')
      || jsonb_build_object('nodes', COALESCE((
        SELECT jsonb_agg(n - 'annotationOrigin' ORDER BY i)
        FROM jsonb_array_elements(d->'architecture'->'nodes') WITH ORDINALITY AS t(n, i)),
        '[]'::jsonb)))
    ELSE '{}'::jsonb END
$$;
--> statement-breakpoint
UPDATE "design_revisions" SET "document" = jeeves_studio_design("document");
--> statement-breakpoint
UPDATE "operations"
  SET "before" = jeeves_studio_design("before"), "after" = jeeves_studio_design("after");
--> statement-breakpoint
DROP FUNCTION jeeves_studio_design(jsonb);
--> statement-breakpoint
UPDATE "layouts" SET "document" = (("document" - 'items' - 'viewport' - 'architecture')
  || CASE WHEN "document" ? 'architecture' THEN jsonb_build_object('architecture', COALESCE((
    SELECT jsonb_object_agg(key,
      value - 'name' - 'members' - 'includeDependencies' - 'positions' - 'down')
    FROM jsonb_each("document"->'architecture') WHERE key LIKE 'studio:%'), '{}'::jsonb))
  ELSE '{}'::jsonb END);
