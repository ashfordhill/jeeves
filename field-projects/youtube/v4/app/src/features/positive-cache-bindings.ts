// Authoritative normalized resources and cache tile TTL; no module default.
export const positiveCacheBindings = {"watch-api-video-details-cache":{"cache":{"hostname":"cache-hot-metadata","port":6379,"resource":"hot-metadata","secret":"cache-hot-metadata"},"host":"watch-api","source":{"resource":"metadata"},"ttlSeconds":3601}} as const;
