# SG08 evidence: handle drag-to-create and islands

One-off Playwright run (`capture.mjs`, Chromium, real `mouse.move/down/up` with steps) at
1440×900 and 1280×800 against a temporary Vite on 4302 from this checkout, proxying the running
4310 API. The 4302 Vite was stopped afterwards; 4300 was not touched. Results: `capture-log.json`.

Per size, on a disposable **TinyURL** project and a disposable **Blank architecture** project
(all four deleted afterwards, 204; owner projects' `updatedAt` unchanged, no owner request
blocked or attempted, no page errors):

| Step | Observation (both sizes) |
| --- | --- |
| C1: pull TinyURL's east `+` 210px out | dashed preview + ghost box; picker External system / Person; one new box, one new line; inspector opens the connection form (Action `Uses`) |
| C2: pull Shorten API east `+` → Cache | picker lists 12 generic kinds (no queue at C2); 14→15 boxes, 12→13 lines; form opens with `Reads & writes` |
| Undo / Redo of that spawn | one step each: box and line go and come back together |
| C2: Links database west `+` | picker lists only valid sources (6 application kinds); Escape closes it |
| C2: drop Analytics worker `+` on Cache | target highlighted; **Connect** opens prefilled (Analytics worker → Cache, `Reads & writes`); Connect adds the line |
| C3: Rate limiter east `+` | picker: 10 components of Shorten API plus Cache (the only target it may use); Auth guard created inside the frame and selected |
| C3: Link writer (data access) east `+` | only Database offered; database owned by Shorten API, traced C2 connection plus component link in one batch; connection form opens |
| C3: drop Auth guard `+` on Link writer | in-process component link added directly |
| C3: New island | Database, Cache, Object storage, Search index, CDN, External API (no queue without a selected owner); one unconnected box |
| Reload | C3 box and line counts unchanged; saved design has the new elements, component and links |
| H / V | Hand on (no handles shown in Hand mode), Select back on |
| Blank C2 | empty view shows the "Start with a first box" panel (12 kinds); Microservice → east `+` Database → New island Browser app → drop Browser app `+` on Microservice (`Calls`) |
| Blank C3 | Microservice east `+` offers Database, Cache, Queue, Object storage, Search index, CDN, External API; Queue created owned by Microservice, `Publishes · Messaging` |

`screenshots/` holds 23 views per size (pulling, picker, spawned, drop hover/form, undo, island,
reload, empty canvas). A video was recorded but not kept (6.6 MB; no ffmpeg to compress it).
