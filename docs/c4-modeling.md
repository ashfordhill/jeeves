# C4 notes

The studio borrows its C1/C2/C3 vocabulary from the [C4 model](https://c4model.com/). C4 is
inspiration, not the rulebook: where the studio's choices differ, the studio wins.

- **C1 (context):** one system, its people and the external systems it talks to.
- **C2 (containers):** each deployable application, browser client and resource (database,
  cache, object store, search, CDN, external API). A container is a deployment boundary, not
  necessarily a Docker container. A package is a grouping of independent applications, not
  another process.
- **C3 (components):** finite, cohesive responsibilities inside one application (rate limiter,
  cache reader, ID generator and so on, or a `custom` component with a one-line purpose). A
  component reaches other boxes only through an existing C2 connection, so C3 never contradicts
  C2. Queues and topics are resources shown at C3.
- **Relationships** carry a verb and, between containers, a protocol. Network privacy is not
  authorization, a dashed or asynchronous line is not a delivery guarantee, and a label is not
  wiring.
- **Intent is not implementation.** Settings, providers and components describe what should be
  built. Keep design intent, template availability and verification evidence separate.

Next, the canvas will be rebuilt on an automation-illustrator-style locked lane grid: the actor
as the root, lanes, services and resources as tiles, and no disconnected islands.
