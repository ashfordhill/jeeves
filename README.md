# Jeeves

Jeeves is a local architecture design studio for web-based systems. You draw a system on one lane
canvas: the user starts a download lane and an upload lane, and every service, API, database,
cache, queue, storage or external tile hangs off them, laid out automatically with no islands and
no cycles. You configure each tile from a finite catalog of settings and provider choices, and
talk to a chat assistant that edits the same design with the same rules. Every design is exposed
as a read-only, versioned **blueprint** (`GET /projects/:id/blueprint`). Code generation is not
part of Jeeves: a future, separate service will read the blueprint and generate from it.

The intention is to **reduce the amount of non-deterministic code and behaviour** when designing
the foundations of web-based software systems. By keeping a diagram-based source of truth, we can
reduce the amount of unpredictable "slop", whether introduced by humans or coding agents. This
helps when designing new systems at a high level with LLMs, which often produce high-quality
looking output that only looks right at first glance. AI is better suited to well-defined small
to medium tasks with a clearly defined outcome.

- [The studio](docs/studio.md): the lane canvas, layout, creating and removing tiles, the lane
  rules, the inspector, history, chat, the TinyURL and marketplace studies and the current limits.
- [Studio settings](docs/studio-settings.md): every configurable field and its values.
- [Studio blueprint](docs/studio-blueprint.md): the code-generation boundary.
- [Catalog](CATALOG.md): tile kinds and types, the lane link table, components, providers.
- [Architecture overview](PLAN.md): apps, packages, data model and how they fit.
- [C4 notes](docs/c4-modeling.md) and [Docker](docs/docker.md).

## Run it

With Docker only (web app, API and PostgreSQL in one image; see [docs/docker.md](docs/docker.md)):

```sh
docker run -d --name jeeves -p 127.0.0.1:4300:4300 -v jeeves-data:/data ghcr.io/ashfordhill/jeeves:latest
```

From the checkout (Node 24, pnpm 12.16.1, Docker for Postgres):

```sh
pnpm install
pnpm dev        # Postgres via compose.yaml, then the API (4310) and the web app (4300)
```

Open http://127.0.0.1:4300. A fresh database opens on an editable copy of the TinyURL study.
Database migrations run on server start.

Chat needs a model provider, chosen in **Settings**: the OpenAI API (`OPENAI_API_KEY` in the
environment, or `openai.apiKey` in `~/.jeeves/config.json`) or Codex using its own login
(`codex login`). The chosen provider and model are saved in the same file (`JEEVES_HOME`
overrides the directory). Keys never leave the server process and never belong in the
repository. The studio works without a provider.

## Test

```sh
pnpm check             # Biome lint, type checks, unit tests (no Docker, Postgres or network)
pnpm test:e2e          # Playwright smoke set: starts Postgres and its own servers on 4301/4311
pnpm test:e2e:docker   # the same inside the Playwright image, when Chromium's libraries are missing
pnpm --filter @jeeves/web build
```

E2E tests use their own `jeeves_e2e` database, a throwaway settings directory and a scripted
chat model (`fixtures/chat/e2e-script.json`), so they never touch your projects or call a
provider. `pnpm format` applies Biome's fixes. CI ([ci.yml](.github/workflows/ci.yml)) runs
`pnpm check`, the web build and `pnpm test:e2e` on every push to `main`.

## Ports

| What | Port |
| --- | --- |
| Web dev server (`pnpm dev`) | 4300 |
| API server (`pnpm dev`) | 4310 |
| Web / API during Playwright | 4301 / 4311 |
| Postgres (Docker, `compose.yaml`) | 54329 |

Everything binds to `127.0.0.1`. Jeeves is a local, single-user application without accounts.

## Notes

### AI methods

- I have access to about 70k of GPT tokens through a friend, which enables me to plan on Astra 6 max without worrying about cost, at least until December 31st. It still always falls short of executing very large goals and needs hammering.
  - Code generation handled by **Sol 6.1** (`codex CLI`) and **DeepSeek v4.1 Flash 1017** (`opencode`) and **Opus 5.5** (`claude CLI`), though sometimes I will use Fable or Astra for a bit of code generation out of curiosity. So far I don't think it's worth the higher cost; leave as planning models.

- Feeding images of diagrams of my intent is definitely still a very effective way of getting better output.

- Frontier models not capable of giving me decent starting points from scratch
  - This something I want to solve with Jeeves; if I can diagram my system, it helps me find issues in my own design. If I can trust the foundation of my design (if I'm trusting the Jeeves component library), then I would say that's a way better
  - Using existing solutions as a starting point (Excalidraw, automation-illustrator) is always more useful than just a long essay of descriptions. I do this at work a lot when creating new projects that are similar to existing projects. It helps a lot!

- For UI-based work, I tell the agent to stop fussing about unit and Playwright tests until the future. For the most part, even economic LLMs generate decent code that I'll manually evaluate from a UI/UX POV. Agents seem to spend an awful lot of time generating unit tests that don't provide a lot of value but end up eating into tokens and time. I don't need a unit test to confirm a button is clicking - I'm gonna assume the LLM can take care of a simple task like that. I also have grown to really despise unit testing getting spammed everywhere.

### Challenges

- My own limited system architecture knowledge. Ideally I would have decades of experience under my belt and be able to tell whether a design is 'good' from peeking at the diagrams, but I'm not there. Leaning on AI judgement more than I'd like to for some of this. Hoping to learn through this.

- UX/UI design is (as always) a huge challenge with prompting. I tried to work off of my [automation-illustrator](https://github.com/ashfordhill/automation-illustrator) application as as starting point for the Jeeves design studio, which had required much manual back and forth prompting for UX improvements ([visual improvements](https://github.com/ashfordhill/automation-illustrator/blob/main/.docs/VISUAL_IMPROVEMENTS.md)). AI is still pretty bad at building desired user interfaces with good UX. Since UX has intuition/'feel' based needs, it makes sense why AI isn't great at it. Playwright interactions and AI-captured screenshots seem to help but don't paint the full picture.

- So far the non-frontier LLMs haven't been good at providing example diagram projects from scratch, which could affect how useful the design chat helper is.

- Jeeves is a really large scope project, though once the foundation is decent, extending the C2 and C3 component libraries with new pieces should hopefully not be too bad

### UI/UX of generated apps

C4 modelling doesn't cover UI design; `'How does the page look? Where does the video player go? What are the page routes?'` It's still alright to vibe-code this for the most part, but getting a custom 'feel' of your own proprietary app requires a lot of prompt massaging since AI-generated web applications kind of all look the same after a while.

You *could* have an additional studio alongside Jeeves for that but I think there are existing solutions and I think maintaining such an editor would be very labor intensive. UI can be painful.
