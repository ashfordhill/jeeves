# Mattermost architecture reference

This is the default Jeeves study. Create it through **New project** or **Library → Examples**.
It is an editable translation of an existing system, with sources for the choices and explicit
limits. The tracked model is [mattermost-example.ts](../../packages/spec/src/mattermost-example.ts).

Start with **C2**, open **01 · Messaging & live delivery**, then drill into **Mattermost server**.
**Deployment**, beside C1/C2/C3, opens the AWS reference and Kubernetes alternative at full size.
Select an arrow to inspect its meaning, interface ownership and available contract details.

## Reference and interpretation

The [official application architecture](https://docs.mattermost.com/deployment-guide/application-architecture)
shows the server, authentication, notifications, data management, database and file store.
The [official deployment diagrams](https://docs.mattermost.com/deployment-guide/scale/server-architecture)
show high availability configurations. This study uses the
[5,000-user AWS image at a pinned revision](https://github.com/mattermost/docs/blob/bd09d959514c34e72a33c24663b5946682b656ec/source/images/MattermostDeployment5kaws.png).
The original images remain upstream; Jeeves stores its own model, not copies of the artwork.

C3 is **our selected decomposition of the public source**, not an upstream C4 diagram.
Source links are pinned to
[2b3fb21](https://github.com/mattermost/mattermost/tree/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5),
and each component has a linked design decision recording its source file. The study covers
web messaging, shared files, notifications and background jobs. It leaves Calls,
plugins, desktop/mobile internals and advanced search outside the slice.

| Published concept | Jeeves representation |
| --- | --- |
| Server application | One logical C2 application, with cohesive C3 modules |
| Browser client | C2 web client; C3 REST client and realtime client reuse existing client code |
| Separate job process | C2 job server using the same codebase; C3 scheduler, workers and job persistence |
| PostgreSQL / file backend | One C2 database and one shared object store |
| Multiple application hosts | Deployment instances of the same C2 server |
| Database writer and reader | Deployment instances of the same logical database, with replication |
| Load balancing and VM sizes | Deployment infrastructure and placement properties |
| Push and email providers | External C2 boundaries linked to C1 |

There is no Redis, Kafka or RabbitMQ box added for appearance. The selected job path polls
database records; the server's cache layers are in process. Job scheduling/claiming is traced to
[the scheduler](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/jobs/schedulers.go),
[watcher](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/jobs/jobs_watcher.go)
and [job status operations](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/jobs/jobs.go).

## Components and implementation choices

The server C3 contains REST handlers, session/channel authorization, the post service,
WebSocket hub, SQL store, file service/backend and notification service. These describe
interfaces, owned behavior and dependencies that an implementation can preserve.
They are grouped responsibilities, not one box per function or endpoint.

**Technology** records the selected source module, framework or library. The realtime-client
family also has a client-library choice and recovery policy. A reusable video playback capability
would similarly select its player implementation and integration contract; “owns the controls”
is not a sufficient architecture specification. Sidebar position, page links, player placement
and comment-box layout belong in the future UI/page-flow designer.

This study references Mattermost implementation modules but does not package them as Jeeves
runtime templates. Their availability, licensing and generation integration remain separate.
Mattermost HA requires a suitable commercial edition; see the
[HA documentation](https://docs.mattermost.com/deployment-guide/server/high-availability-cluster-based-deployment).

## Useful arrows

The web client initiates the authenticated stream; the server publishes events back to it.
Those are separate directional relationships. Event interfaces are provided by the publisher
and required by the consumer. REST commands/history, SQL reads, SQL writes, file access,
SMTP and mobile push each have their own purpose/protocol.

The CreatePost contract uses actual field names from the
[upstream API definition](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/api/v4/source/posts.yaml).
The `posted` event excerpt comes from
[notification.go](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/app/notification.go).
Contract excerpts identify themselves as excerpts. `file_ids` is explicitly unresolved because
the current field editor cannot represent arrays. Full nested payloads, API errors and event
envelopes stay defined upstream; they have not been replaced by invented text fields.

The message scenario follows authorization, persistence and live delivery, with reconnect/history
reconciliation. It does not assert durable WebSocket delivery or an atomic outbox. Teams and
channel membership scope access; they do not automatically provide isolated customer tenants.

## Deployment design

The **AWS reference** preserves two application VMs, one job VM, the load balancer, an Aurora
writer/reader and S3 from the selected image. Email is added from the application architecture.
Client ingress is shown through the load balancer; backing-service arrows retain their C2
identities. Replica communication is a distinct deployment relationship: it can only connect
separate placements of the same logical application or store. It cannot invent a new C2 service
dependency. Application peer exchange and database replication remain different labelled links.

The **Kubernetes adaptation** places OCI application and job workloads in a cluster behind
ingress/load balancing and a Service, with managed backing stores. This is our design alternative,
informed by the [operator documentation](https://docs.mattermost.com/deployment-guide/server/kubernetes/deploy-k8s),
not the topology in the AWS reference image. Controller, immutable image, CPU/memory requests,
autoscaling limits, probes, disruption/rollout policy and failure domains remain open decisions.
The diagram does not provision anything.

**Edit deployment plan** supports placement presets for Kubernetes, application pods, Docker,
VMs and managed databases, plus infrastructure choices for load balancers, Services and brokers.
They create editable declarations with no hidden capacity or availability guarantees.

## What the exercise establishes

Jeeves can express this modular application without forcing every responsibility into a
microservice, map repeated instances to one logical identity, separate request initiation from
event delivery, and compare hosting alternatives. The exercise exposed and fixed missing
replica-to-replica wiring and hidden/cramped deployment access.

The source's “5,000 users” is a reference category, not a throughput measurement. The example
leaves latency values undecided and records measurement boundaries for post acknowledgement
and cross-replica event delivery. Active sockets, messages/second, recipients/message, attachment
traffic, reconnect bursts and operation with a failed replica determine the actual workload.

Remaining model gaps are explicit: nested/array contract fields and full API import; structured
image/resource/autoscaling/probe policies; deployment routes traced through intermediaries to a
single C2 relationship; and workload units such as concurrent sockets and bytes/second.
The selected deployment omits detailed job-node cluster coordination, network/security rules,
secrets, monitoring and recovery procedures. Those are follow-on design depth, not evidence that
this snapshot is ready to deploy or generate a complete Mattermost implementation.
