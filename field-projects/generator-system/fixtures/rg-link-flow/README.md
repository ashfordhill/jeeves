# Link/account mechanism fixture

The JSON diagram is the source. It exports through the ordinary CLI and receives only the
application-owned files listed in attachments.json. API8 DTO/SQL/policy mappings model account
scoped creation, versioned destination lookup and browser navigation. The minimal record schema
uses stable keys, destinations, versions and absolute validity; it has no frontend or billing.

The foundation mappings retain the RG14 finite oracle. Browser navigation adds cookie/CSRF
protection and declared user plus workload forwarding. The task harness registers a confidential
client/audience on a disposable native Keycloak realm behind trusted local HTTPS, supplies private
keys outside the export and runs independent API, gateway, browser and worker copies. This setup
is integration infrastructure, not a new issuer/provider or production deployment feature.

Run the sequential rg-mechanisms generated-system suite. Export checker/type success establishes
the supported extension boundary; the suite supplies the separate finite runtime observations.
