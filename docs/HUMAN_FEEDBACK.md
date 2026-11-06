# Human feedback

The owner's reviews of Jeeves, oldest first: what they sent (images and words), the questions
asked and their answers, what was decided, and how each item was resolved. It is a paper trail of
decisions, of what was tried, and of what still needed improving.

**How to add to it** (see AGENTS.md):

- When the owner sends feedback with images, save each image in
  [`human-feedback/`](human-feedback/) as `YYYY-MM-DD-<subject>.png`. Then add an entry: the date,
  the images, the owner's points (quoted where the wording matters), the questions and answers,
  and the decision.
- A unit that resolves an entry appends to that entry's **Resolution**: what changed, the
  commits, and what is still open. Never rewrite an earlier entry's other sections.

---

## 2026-11-05 — Lane canvas review after PL02

Reconstructed on 2026-11-06 from the design-polish plan and the coordinator's notes. The images
from that review were not kept.

**What the owner raised:**

- The `+` and `---` tabs felt redundant. `---` read as a path connector that should only attach
  to existing tiles.
- The `+` fans should offer the same options on both sides of a tile.
- Lines where a tile has two predecessors had small jogs.
- The TinyURL study "doesn't make a lot of sense": two services shared a bus into the cache and
  the database, and the analytics store was never read.
- Lane entries that start "both" lanes.
- One Jeeves project should be one self-contained system.

**Decisions:** `+` only creates; a link tool attaches in either direction. The fan always shows
seven types, with unavailable ones greyed. "Both" was removed. Service kinds became labelled
presets with two languages each. TinyURL was rebuilt from published designs. Marketplace and
YouTube studies were added to test the options against real systems.

**Resolution:** the [design-polish plan](plans/design-polish/units.md), DP01–DP10, `cbc8346` …
`aec1998`. Open afterwards: DP10's owner questions (fit padding, grid dots, the fan latch,
notices, the blueprint `access` name).

## 2026-11-06 — YouTube study: user → store line, CDN looks like upload

![YouTube after DP09, marked up by the owner](human-feedback/2026-11-06-youtube-dp09-marked.png)

**What the owner raised:**

- A line ran from the User to Original videos: "a User doesn't have direct access to a database
  and there's already a flow for uploading videos."
- The Video CDN looked like part of the upload process (the red line and question marks): its
  line to Encoded videos shared a vertical run with the Upload service's lines.
- The User's four tabs (a `+` and an attach per lane) were confusing, and the lanes were being
  misused. "Mainly a User will have 2 starting lanes: they are either consuming … or producing."
  Proposed action tiles with a large word, such as "Watch" and "Create"/"Publish".

**Questions and answers:**

- Action tiles per lane: **one per lane**.
- Keeping lanes apart: **bands** (download above, shared stores between, upload below), with no
  shared line runs across lanes.
- Design warnings for odd but allowed designs: **yes**.
- Delivery: **a small plan with a review unit at the end**. The owner also set the rule that
  every split-up plan ends with a review unit.

**Resolution:** the [lane-actions plan](plans/lane-actions/units.md), LA01–LA05, `d888d73` …
`2273e27`.

- The User has one `+` that creates the Consume and Produce actions, and links only to them.
  Actions link only to services, APIs or the CDN.
- Four warnings: a store with no writer, a worker's output nobody reads, a queue missing a side,
  and an action with no entries.
- Lane bands. YouTube's CDN line no longer shares a run with the upload lines.

Open afterwards: the bands made the studies taller, so they fit at 0.33–0.39 and tile names are
unreadable until zoomed (below). There are also nine LA05 owner questions, recorded in the LA05
handoff entry.

![YouTube after LA03, fitted at 1440×900](human-feedback/2026-11-06-youtube-la03-fit.png)

## 2026-11-06 — YouTube v2: search feed, upload forks, layout, Xu's design

![YouTube after LA05, marked up by the owner](human-feedback/2026-11-06-youtube-la05-marked.png)

**What the owner raised:**

- **Purple: Video processor → Search index.** "Does it make sense for the Video Processor to feed
  straight into the Search index? … the search index is probably reading from a cache or db."
- **Orange: Upload service → Original videos.** "Weird because we expect the upload service to
  only (?) connect to the upload jobs. Even if that's an async process – I think that should be
  designated by dotted arrows but not split off from the Upload service like it is now, the 2
  lane thing going on there."
- **Placement.** The Video CDN has a long path just to reach one box. The Watch API has the same
  "two lanes" look as the Upload service, "when all requests probably go through the same
  system".
- **Xu's design.** Alex Xu's *System Design Interview*, "Design YouTube", has a fuller upload
  path: User → original storage → transcoding servers → transcoded storage → CDN. The
  transcoding servers report through a completion queue to a completion handler, which writes the
  metadata cache and DB; the API servers read both. "This is sort of where I was going with the C2
  design." Look at how that fits the template-based microservice goal.
- **Learning.** Lessons from system design should go into the repo's agent files, so designs get
  better over time.
- **Paper trail.** This file, and the rule in AGENTS.md that keeps it up to date.

**Questions and answers:**

- **Direct upload to storage** (Xu draws the user uploading straight into original storage with
  a signed URL). The owner thinks Xu oversimplified: a user always hits a service that handles
  the upload logic first. The coordinator agreed. The client always asks a service first (sign-in,
  checks), and a signed URL only changes where the bytes travel; the storage endpoint is itself a
  service checking the signature. So the diagram keeps **Publish → Upload service → Original
  videos**, and how the bytes travel is a candidate setting on the Upload service (through the
  service, or a signed URL straight to storage). The two imply different templates.
- **Search feed:** an **event and an indexer worker**. A "video ready" event goes on a queue and a
  Search indexer writes the index, as in the marketplace. No new rule is needed.
- **Layout:** put **stores beside the tiles that use them**, so a fork is two short branches and
  no reader stretches to the far right.
- **Detail:** **follow Xu, mapped to templates**. Use Xu's boxes where each maps to a template,
  keep one writer per store, and record every difference and why.

**Resolution:** in progress: the [system-design plan](plans/system-design/units.md), SD01–SD05.

- SD01: the [design playbook](design-playbook.md) records the lessons: uploads through a service
  (proxied or signed URL as the service's choice), the completion handler, search from events, who
  writes a cache, one writer per store (Xu's two metadata writers turned into one), and the smells
  this review found.
