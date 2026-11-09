// Authoritative normalized resources and cache tile TTL; no module default.
export const positiveCacheBindings = {"ready-reader":{"cache":{"hostname":"cache-metadata-cache","port":6379,"resource":"metadata-cache","secret":"cache-metadata-cache"},"host":"watch","source":{"resource":"metadata-db"},"ttlSeconds":3601}} as const;
