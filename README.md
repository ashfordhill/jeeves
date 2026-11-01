# Jeeves

Jeeves is a local web-application software architecture studio intended to help Software Engineers design software using C4 modeling-inspired diagramming. This is intended to provide a balance between human design and AI-generated code, reducing the amount of non-deterministic code generation for better maintability.

- Targets TypeScript code generation

<p align="center"><img src=".docs/c4-flow.svg" width="600"/></p>

1. At C2 and C3, software engineers would design a new system and provide input for their configureable features.

2. At C4(a), the architecture design would generate into templated solutions that utilize a common testing framework and pattern to support black box and stress testing, i.e. - quality pieces of deterministic code to work with.

3. At C4(b), application-specific features not provided at the template levels would be manually written via humans/agents. 

The intention is to **reduce the amount of non-deterministic code/behavior** when designing the foundations of [web-based] software systems.

By maintaining a diagram-based source of truth, we can reduce the amount of unpredictable 'slop', whether that is introduced by humans or coding agents. This can be useful when designing new systems at a high level, which can often times lead to high-quality looking slop that sort of looks right at first glance. AI is better suited to well-defined small to medium scoped tasks where the outcome is clearly defined.

![](.docs/mvp-flow.gif)

## Mattermost example

```sh
docker pull ghcr.io/ashfordhill/jeeves:latest
docker run --rm --name jeeves -p 4300:4300 ghcr.io/ashfordhill/jeeves:latest
```

Example of C1,C2,C3 diagramming for Mattermost, courtesy of Astra:

<p align="center"><img src=".docs/mattermost-c1.png" width="600"/></p>
<p align="center"><img src=".docs/mattermost-c2.png" width="600"/></p>
<p align="center"><img src=".docs/mattermost-c3.png" width="600"/></p>

## Planned Features

- A chat helper on the side to help guide C2 and C3 design decisions.

  - <p align="center"><img src=".docs/chat-assistant.png" width="300"/></p>

- A library of pre-tested C2 and C3 components to mix, match and connect together

  - <p align="center"><img src=".docs/component-library.png" width="300"/></p>


- Configurable options within C2 and C3 components to indicate expected load at certain bottlenecks (keep design MVP level, enterprise level or flexible enough to change later on?)

- Deployment target configurations (cloud or local, containerization, Kubernetes)

## AI methods

- I have access to about 70k of GPT tokens through a friend, which enables me to plan on Astra 6 max without worrying about cost. It still always falls short of executing very large goals and needs hammering.
  - Code generation handled by **Sol 6.1** (`codex CLI`) and **DeepSeek v4.1 Flash 1017** (`opencode`) and **Opus 5.5** (`claude CLI`), though sometimes I will use Fable or Astra for a bit of code generation out of curiosity. So far I don't think it's worth the higher cost; leave as planning models.

- Feeding images of diagrams of my intent is definitely still a very effective way of getting better output.

- Frontier models not capable of giving me decent starting points from scratch
  - This something I want to solve with Jeeves
  - Using existing solutions as a starting point (Excalidraw, automation-illustrator) is always more useful than just a long essay of descriptions 

- For UI-based work, I tell the agent to stop fussing about unit and Playwright tests until the future. For the most part, even economic LLMs generate decent code that I'll manually evaluate from a UI/UX POV. Agents seem to spend an awful lot of time generating unit tests that don't provide a lot of value but end up eating into tokens and time. I don't need a unit test to confirm a button is clicking - I'm gonna assume the LLM can take care of a simple task like that. I also have grown to really despise unit testing getting spammed everywhere.

## Challenges

- My own limited system architecture knowledge. Ideally I would have decades of experience under my belt and be able to tell whether a design is 'good' from peeking at the diagrams, but I'm not there. Leaning on AI judgement more than I'd like to for some of this. Hoping to learn through this.

- UX/UI design is (as always) a huge challenge with prompting. I tried to work off of my [automation-illustrator](https://github.com/ashfordhill/automation-illustrator) application as as starting point for the Jeeves design studio, which had required much manual back and forth prompting for UX improvements ([visual improvements](https://github.com/ashfordhill/automation-illustrator/blob/main/.docs/VISUAL_IMPROVEMENTS.md)). AI is still pretty bad at building desired user interfaces with good UX. Since UX has intuition/'feel' based needs, it makes sense why AI isn't great at it. Playwright interactions and AI-captured screenshots seem to help but don't paint the full picture.

- So far the non-frontier LLMs haven't been good at providing example diagram projects from scratch, which could affect how useful the design chat helper is.

- Jeeves is a really large scope project, though once the foundation is decent, extending the C2 and C3 component libraries with new pieces should hopefully not be too bad

## UI/UX of generated apps

C4 modelling doesn't cover UI design; `'How does the page look? Where does the video player go? What are the page routes?'` It's still alright to vibe-code this for the most part, but getting a custom 'feel' of your own proprietary app requires a lot of prompt massaging since AI-generated web applications kind of all look the same after a while. 

You *could* have an additional studio alongside Jeeves for that but I think there are existing solutions and I think maintaining such an editor would be very labor intensive. UI can be painful.


