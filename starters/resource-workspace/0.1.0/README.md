# Resource workspace starter 0.1.0

Experimental editable Inventory composition: one browser workspace, one resource API, one Postgres store and an intentional workspace-member/system relationship. Warehouses and stock items are owner scoped; stock items require their owner's warehouse. The API owns validation and authorization; the workspace derives forms and capabilities from its real API connection.

The factory sets title, stable loopback web port and finite workspace configuration. The snapshot pins `web-app@0.2.0`, `http-service@0.2.0`, `resource-workspace@0.1.0`, `rest-api-server@0.1.0`, `rest-api-client@0.1.0` and `postgres@0.1.0`. P25 supplies generation; P26 supplies catalog/UI creation and private local setup. No upstream runtime source was copied.

`manifest.json` hashes `design.json` and `layout.json`; the generator registry pins the manifest SHA-256. Do not reformat or change those three released files. Documentation can evolve independently. This is a starting shape, not a protected product recipe: ordinary resource, screen and C4 edits remain available after creation. Domain effects, organization authorization and external integrations are not supplied by this starter.
