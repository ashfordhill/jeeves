# Jeeves <!-- omit from toc -->

- [11/11/2026](#11112026)
  - [YouTube V3](#youtube-v3)
  - [Birds-Eye Viewership](#birds-eye-viewership)
  - [Chat Agent Diagram Generation](#chat-agent-diagram-generation)
    - [Podcast](#podcast)
    - [Video](#video)
    - [Spec](#spec)
  - [Measurements](#measurements)
  - [UI Improvements](#ui-improvements)
    - [Simple vs Detailed view](#simple-vs-detailed-view)
- [V1](#v1)
  - [Strategy](#strategy)
    - [YouTube V2 (11/9/2026)](#youtube-v2-1192026)
    - [YouTube V1](#youtube-v1)
      - [Diagrams](#diagrams)
      - [Features](#features)
      - [Missing features:](#missing-features)
      - [Lines of Code](#lines-of-code)
- [Archive](#archive)
  - [V0](#v0)
    - [Notes](#notes)
  - [Mattermost example](#mattermost-example)
    - [C1](#c1)
    - [C2](#c2)
    - [C3](#c3)
  - [Planned Features](#planned-features)
  - [AI methods](#ai-methods)
  - [Challenges](#challenges)
  - [UI/UX of generated apps](#uiux-of-generated-apps)


## 11/11/2026

### YouTube V3

Added sign in/identity aspect for viewers, not just publishers. This involved a favorites addition as well. Thought it would be good to address this issue where only the producers had an 'identity'. That'll be an issue for the 'Marketplace' application where there will be buyers and sellers.

### Birds-Eye Viewership            

Ideally you wouldn't craft a diagram from scratch - even if you probably had superior system design skills, it would be difficult to think of the path for every little piece without investing a significant amount of time.

**It'd probably be easier to review an agent's attempt at diagramming a detailed prompt from the user rather than have a user build a system diagram from scratch**. Then you can find issues or missing details and have the agent fix it. You could also remove or add things yourself and have the agent calculate judgement or suggestions based on your actions.

I'm not sure that I like the idea of all these paths touching 1 Tile, the video metadata database.  

<p align="center"><img src=".docs/youtube-v3/metadata-lots-of-connections.gif" width="800"/></p>

 
Is this a cause for concern? Software principles tell me yes. Maybe this is an issue. Maybe I'll ask an agent to investigate. Would I have been able to see this easily without diagrams or with narrow-scoped diagrams? **Visual representations of systems help find oversights, redundancy and design smells**. They can also provide an efficient way of getting a newcomer understand what they're walking into instead of throwing them a bunch of repositories and text.

### Chat Agent Diagram Generation

> Task carried out by agents, so bullets are also writen by agents. Wanted any differences pointed out between models and their designs on a given prompt

#### Podcast

| Luna (gpt-6-luna) · 92.4 | Sol (gpt-6.1-sol) · 84.7 | Haiku 5.5 · 94.4 | Sonnet 5.5 · 100 |
| :---: | :---: | :---: | :---: |
| <img src=".docs/chat-agent-diagrams/podcast-luna.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/podcast-sol.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/podcast-haiku.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/podcast-sonnet.png" width="100%"/> |

- Sonnet: the only full marks. Listeners can optionally sign in on the Episode API.
- Haiku: kept most of the patterns' generic names (Ingest API, Records, Jobs, Processor, Outputs). No optional listener sign-in.
- Luna: two identity tiles (hosts and listeners) and no CDN; the Episode API reads audio straight from storage. No optional listener sign-in.
- Sol: splits listening into three services (Episode pages → Playback, Followed shows), with the CDN behind Playback. No lifecycle worker, so episodes reach search from the upload service before processing finishes.

#### Video

| Luna (gpt-6-luna) · 100 | Sol (gpt-6.1-sol) · 100 | Haiku 5.5 · 100 | Sonnet 5.5 · 100 |
| :---: | :---: | :---: | :---: |
| <img src=".docs/chat-agent-diagrams/video-luna.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/video-sol.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/video-haiku.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/video-sonnet.png" width="100%"/> |

- All four have the same 21 tiles; they differ in names and one link.
- Sol and Sonnet: the favorites service also reads the video records, to check a video can be favorited. Luna and Haiku skip that link.
- Haiku: generic pattern names left in (Records, Jobs, Results, Lifecycle, Login).
- Luna: viewers sign in through "Creator Identity", a name that only fits creators.

#### Spec

| Luna (gpt-6-luna) · 99.4 | Sol (gpt-6.1-sol) · 100 | Haiku 5.5 · 100 | Sonnet 5.5 · 100 |
| :---: | :---: | :---: | :---: |
| <img src=".docs/chat-agent-diagrams/spec-luna.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/spec-sol.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/spec-haiku.png" width="100%"/> | <img src=".docs/chat-agent-diagrams/spec-sonnet.png" width="100%"/> |

- The brief names every tile, so all four match the reference's 21 tiles and 25 links almost exactly.
- Luna: missing the Publish → Sign-in link.
- Haiku: names the search index "Videos index" instead of "Videos".
- Sol and Sonnet: identical to the reference.

> /end agent code

### Measurements

I'll be relying on trialing multiple types of projects to be generated with Jeeves diagrams and utilizing the following measurements:

- num tokens to get a YouTube clone via just prompting
- num tokens get a YouTube clone with Jeeves generations + prompting
  - Taking note of tokens used for Jeeves chat agent helping with diagramming

The lines of code with Jeeves coverage is no longer an immediate concern so I won't bother looking at that, though I'll probably revisit the count at a later stage in the project:

<p align="center"><img src=".docs/youtube-v2/loc-metrics.png" width="400"/></p>


---

### UI Improvements

<img src=".docs/ui-v2/view-simple.png" width="49%" />&nbsp;<img src=".docs/ui-v2/view-detailed.png" width="49%" />

#### Simple vs Detailed view

Now can view modules inside of a tile/template piece. 

Detailed view also shows connections/arrows at a more granular level to see the flow a bit better.

## V1

The C4-Modeling architecture has been a good inspiration and thought tool. However, my intention with generated code templates likely benefits more from simplifying diagram view into 1 diagram per system (or subsystem, I suppose), offering configuration options.

Additionally, I've extracted the custom grid library logic from my other project automation-illustrator to give a better starting point with Tiles, Lines, and UX experience. If I can't read and interact with the diagrams easily then there's no point in trying to build out the backend.

<img src=".docs/user-consume-produce.gif" width="49%" />&nbsp;<img src=".docs/menu-options.gif" width="49%" />

### Strategy

I am having frontier models (Astra, Opus 5.5, @ xhigh or max) handle build plans and then spawning off sequential steps to have fresh, cheaper agents execute each segment of the build plan (not in parallel). 

>> When planning, I always push the agent to ask any questions to clarify things with me in any ambiguous or unclear areas, instead of just assuming the best path forward.

There are 3 field projects I would like to work with:

  - YouTube
  - Marketplace (a generic buy/sell portal. Apparently Etsy is heavily PHP so not a good patternt to follow for microservices..Amazon is disgusting and eBay is probably crusty as well)
  - TinyURL

Each project will go through V1, V2, etc. where the diagrams become generated code.

Benchmarks against generated template code via Jeeves Generator (the deterministic code) vs the non-deterministic custom code added later that glues/enhances the project, will be compared via # lines of source code. **The goal is to get V2 of YouTube to use less non-deterministic code than V1, etc.** 

When executing, builder agents will:

- Screenshot the diagram used to make the V# of that project.
- Adjust diagram and config options on Jeeves as necessary to adjust original diagram 
- Update possible generated code template options if it seems like a good use case
- **Not** spend a bunch of time on unit testing Jeeves Generator nor the Templates code; why waste tokens testing a moving target?

#### YouTube V2 (11/9/2026)

Astra max fixed some of the YouTube implementation specific code from the templates and did a recount of LOC. I'm happy with this, for now - though this field project is still missing several features that YouTube has. I don't intend to create a perfect clone since I don't want
<p align="center"><img src=".docs/youtube-v2/loc-metrics.png" width="400"/></p>

**Ideas**

Making tiles generic - instead of having Jeeves be an 'all-in-one' web app builder, have it be able to focus on specific applications. For instance, a company is not interested in building everything - only implementation around their domain. You could make a JeevesForTumblr, for instance. Or a JeevesForSpotify.

But that would sort of break code generation templates. Not sure if this is worth pursuing.

**Next Steps**

I need to make some Jeeves UI updates so I can see the component/tile structure more easily to get an idea of what reuseable pieces I have and how they connect.

Then I will try another field project.

Then I need to try field project implementations that actually use cloud services and deploy.

Then I need to stress test traffic to make sure these are fairly robust - enough for production. Not just toy projects.

There will be more projects to test. I would like to build personal projects qrwty and dropshipping once my case studies look solid.

Creating UI templates is something I will look into - there are existing tools but I would prefer a custom style. For the copycat projects like YouTube I want to see if I can get an agent to make a UI look like YouTube.


#### YouTube V1

Lives [here](field-projects\youtube\v1\README.md).

<p align="center"><img src=".docs/youtube-v1/watch-monster-hunter.png" width="400"/></p>


##### Diagrams

Original / Modified during build process

<img src=".docs/youtube-v1/diagram-original.png" width="49%" />&nbsp;<img src=".docs/youtube-v1/diagram-modified.png" width="49%" />


##### Features

- Account sign in (no account creation option)
- Upload
- Playback
- View count
- Search videos (search needs some help tho; searching `f` results in nothing while `fixtures` does, for instance)

##### Missing features:

- Cloud connections were intentionally not targeted as part of V1; would need further testing around this later on. Docker locally suffices for now
- **Account creation**; prob should have a template anyway
- Deeper video **analytics** besides view count; might be useful to have generic analytics microservice (?)
- **General browsing** of random/all video **inventory**; could see generic template opportunity for 'inventory browsing', unsure
- Further **video editing** options when uploading (would need to check YouTube for ideas); might be useful for a generic video editing or upload template
- **and much more**!

##### Lines of Code

**Does not include UI-specific code since Jeeves is not a UI build helper**

- **5.53% src code is from Jeeves Generator**
  - 159 lines deterministic
  - 2,715 non-deterministic

Note that tests for the templated code are not really in place so 'deterministic'/reliable code is being used liberally here.

This is below my target of wanting at least 60% templated code, but it's a start.

## Archive

### V0

#### Notes

Jeeves is a web-application architecture studio intended to help Software Engineers design & generate software using [C4 modeling](https://www.visual-paradigm.com/guide/what-is-the-c4-model-a-comprehensive-guide-to-visualizing-software-architecture/)-inspired diagramming. This is intended to provide a balance between human design and AI-generated code, reducing the amount of non-deterministic code generation for better maintability.

<p align="center"><img src=".docs/c4-flow.svg" width="600"/></p>

1. At C2 and C3, software engineers would diagram a new system by connecting & configuring Jeeves components

2. At C4(a), the architecture design would generate into templated solutions that utilize a common testing framework and pattern to support black box and stress testing, i.e. - pieces of reliable code to work with.

3. At C4(b), features not provided at the template levels, or generated C2/C3 components that include stubs would be written via humans/agents. Ideally C4(b) bugs would be created much more frequently than C4(a) bugs.

The intention is to **reduce the amount of non-deterministic code/behavior** when designing the foundations of [web-based] software systems.

By maintaining a diagram-based source of truth, we can reduce the amount of unpredictable 'slop', whether that is introduced by humans or coding agents. This can be useful when designing new systems at a high level via LLMs, which can often times lead to high-quality looking slop that sort of looks right at first glance. AI is better suited to well-defined small to medium scoped tasks where the outcome is clearly defined.

![](.docs/mvp-flow.gif)

### Mattermost example

```sh
docker pull ghcr.io/ashfordhill/jeeves:latest
docker run --rm --name jeeves -p 4300:4300 ghcr.io/ashfordhill/jeeves:latest
```

Example of C1,C2,C3 diagramming for Mattermost, courtesy of Astra:

#### C1
<p align="center"><img src=".docs/mattermost-c1.png" width="600"/></p>

#### C2
<p align="center"><img src=".docs/mattermost-c2.png" width="600"/></p>

#### C3
<p align="center"><img src=".docs/mattermost-c3.png" width="600"/></p>

### Planned Features

- A chat helper on the side to help guide C2 and C3 design decisions

  - <p align="center"><img src=".docs/chat-assistant.png" width="300"/></p>

- A library of pre-tested C2 and C3 components to mix, configure and connect together

  - <p align="center"><img src=".docs/component-library.png" width="300"/></p>


- Configurable options within C2 and C3 components to indicate expected load at certain bottlenecks (keep design MVP level, enterprise level or flexible enough to change later on?)

- Deployment target configurations (cloud or local, containerization, Kubernetes)

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


