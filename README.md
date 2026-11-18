# Jeeves <!-- omit from toc -->

- [Current](#current)
- [README Archives](#readme-archives)
  - [Jeeves v0](#jeeves-v0)

## Current

Jeeves going through next iteration of improvements. 

TODO:

- Regen QRWTY with new diagramming. 
  - Reanalyze finished project before deploying this time. Get feedback from variety of LLMs
  - Trial run the deployment contract that will be part of Jeeves v1. Does it help?
  - Compare this new iteration with the QRWTY generation that didn't use Jeeves (don't regenerate it)

Depending on results from there, may start to work on the Jeeves Chat Agent and getting it 'smart' about Jeeves diagramming.

## README Archives

### Jeeves v0

- [C4 modeling](https://c4model.com/) used as initial inspiration but deviated from that 
- Extracted [Automation Illustrator](https://github.com/ashfordhill/automation-illustrator) grid as library and reused to get better visuals
- Code generation tested with YouTube and [QRWTY](https://github.com/ashfordhill/qrwty) concepts, along with some loose metric recording
  - QRWTY was deployed to [qrwty.io](https://qrwty.io/) 
  - Google Cloud Platform, Cloudflare and Stripe were utilized for non-deterministic and deployment pieces of QRWTY's system
- A QRWTY implementation without Jeeves templates achieved better design according to Fable 5.2 and Astra 6 [reviews](.docs/readme/v0/qrwty/evaluations/). This is a result of Jeeves codegen needing improvements which will also involve some diagramming option updates
- Connecting Jeeves Chat Agent to LLMs working but have not used yet; this is not important until Jeeves diagramming & codegen is in a more mature state


**Several things were not accounted for at enterprise design level when trialing QRWTY creation:**
  - Database connections that will support pooling for primary/replica patterns
  - Missing caches and standby caches in several places that you'd probably want one
  - Maintaining user authorization state across microservices; Fable advises giving them a 'stamp' of authorization, which Cloudflare/Google would need to provide. So part Jeeves, part deployment
  - This: 
    - <p align="left"><img src=".docs/readme/edge-run-app-open.png" width="400"/></p>
  - Load balancers with firewall (and to help with routing traffic to desired regions). Seems to cost money and be more of a deployment scope.
  - Deployment plans/guides as part of project generation, in-depth end2end tests; these are going to be accounted for in future iterations of Jeeves

Jeeves can help with several of these, which is what will be included in the next plan.

A fun HTML-based artifact was created and uploaded to [claude.ai/artifact](https://claude.ai/artifact) as part of a UI rework when using Opus 5.5:

  - <p align="left"><img src=".docs/readme/ui-refresh-preview.png" width="150" height="300"/></p>

---

[Full README](.docs/readme/README.md).
