/** Immutable v1 schema. Apply through the consumer's checksum-protected migration runner. */
export const deliveryMigration = {
  id: "jeeves-durable-events-0001",
  sql: `CREATE TABLE public.jeeves_event_delivery_v1 (
  id uuid PRIMARY KEY,
  queue text NOT NULL CHECK (queue ~ '^[a-z][a-z0-9-]{0,62}$'),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  deduplication_key text NOT NULL CHECK (length(deduplication_key) BETWEEN 1 AND 160),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9.-]{0,119}$'),
  event_version integer NOT NULL CHECK (event_version BETWEEN 1 AND 1000),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object' AND policy->>'schemaVersion' = '1'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','succeeded','exhausted')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text CHECK (last_error IN ('handler-failed','invalid-payload','unsupported-event','deadline-exceeded','cancelled','lease-expired','permanent-failure')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (queue, tenant_id, deduplication_key),
  CHECK ((state = 'running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (state <> 'running' AND lease_token IS NULL AND lease_until IS NULL)),
  CHECK ((state IN ('succeeded','exhausted')) = (completed_at IS NOT NULL))
);
CREATE INDEX jeeves_delivery_due_v1 ON public.jeeves_event_delivery_v1 (queue, available_at, id) WHERE state = 'pending';
CREATE INDEX jeeves_delivery_expired_v1 ON public.jeeves_event_delivery_v1 (queue, lease_until, id) WHERE state = 'running';
CREATE INDEX jeeves_delivery_tenant_v1 ON public.jeeves_event_delivery_v1 (queue, tenant_id, created_at DESC, id);
CREATE TABLE public.jeeves_event_receipt_v1 (
  delivery_id uuid PRIMARY KEY REFERENCES public.jeeves_event_delivery_v1(id),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
`,
} as const;
