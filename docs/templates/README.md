# Template catalog

Each file here describes one template: what it is on the Draw Jeeves board, what it generates, and what its test pack proves. The template contract itself is defined in [PLAN.md §8](../../PLAN.md#8-templates).

| Template | Board role | Status |
| --- | --- | --- |
| [http-service](http-service.md) | Element: microservice | **v1 reference**, built in S8 |
| [rest-api-server](rest-api-server.md) | Attachment on a service | **v1 reference**, built in S8 |
| [postgres](postgres.md) | Element: database | **v1 reference**, built in S7 |
| [web-app](web-app.md) | Element: frontend | **v1 reference**, built in S9 |
| [rest-api-client](rest-api-client.md) | Attachment on a service or frontend | **v1 reference**, built in S9 |
| [user-management](user-management.md) | Element: microservice preset | Stub, for the user to fill in |
| [redis-postgres](redis-postgres.md) | Element: database pattern | Stub, for the user to fill in |
| [frontend-library](frontend-library.md) | Element: shared library | Stub, for the user to fill in |
| [payments](payments.md) | Element: microservice | Stub, for the user to fill in |
| [background-worker](background-worker.md) | Element: worker | Stub, for the user to fill in |
| [vector-store](vector-store.md) | Element: database | Stub, for the user to fill in |

The v1 reference templates exist to prove the whole pipeline (design → generate → orchestrate → run in Docker) and are deliberately small. The stubs are filled in and built later, one per agent session, with the same contract.

Every template file uses the same headings: **Board**, **Config**, **Runtime package**, **Scaffold**, **Connections**, **Test pack**, **Agent guide**, **Open questions**.
