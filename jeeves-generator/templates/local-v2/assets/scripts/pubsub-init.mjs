import { PubSub } from "@google-cloud/pubsub";
import { plan } from "./common.mjs";

// Locally only: creates each Pub/Sub topic and subscription infra/local.json lists, in the
// emulator. A missing one is created; one that exists with other settings stops setup, naming
// it. Nothing is deleted or changed, and processes never create topics or subscriptions.
const projectId = process.env.JEEVES_PUBSUB_PROJECT;
if (!projectId) throw new Error("Set JEEVES_PUBSUB_PROJECT.");
// Every Pub/Sub client's channel reconnects after 500 ms, doubling to at most 2000 ms (QG09).
const pubsub = new PubSub({
  projectId,
  "grpc.initial_reconnect_backoff_ms": 500,
  "grpc.max_reconnect_backoff_ms": 2000,
});
const topicName = (id) => `projects/${projectId}/topics/${id}`;
/** gRPC's ALREADY_EXISTS: another setup created it first. */
const alreadyExists = (error) => error?.code === 6;
const seconds = (duration) =>
  duration ? Number(duration.seconds ?? 0) + Number(duration.nanos ?? 0) / 1e9 : undefined;
/** What the plan sets on a subscription, in Pub/Sub's terms; an unset policy must be absent. */
const options = (row) => ({
  ...(row.ackDeadlineSeconds !== undefined && { ackDeadlineSeconds: row.ackDeadlineSeconds }),
  ...(row.retryPolicy && {
    retryPolicy: {
      minimumBackoff: { seconds: row.retryPolicy.minimumBackoffSeconds },
      maximumBackoff: { seconds: row.retryPolicy.maximumBackoffSeconds },
    },
  }),
  ...(row.deadLetterPolicy && {
    deadLetterPolicy: {
      deadLetterTopic: topicName(row.deadLetterPolicy.deadLetterTopic),
      maxDeliveryAttempts: row.deadLetterPolicy.maxDeliveryAttempts,
    },
  }),
});
/** The settings of an existing subscription that differ from the plan's, by name. */
const differences = (row, metadata) =>
  [
    metadata.topic !== topicName(row.topic) && "topic",
    row.ackDeadlineSeconds !== undefined &&
      metadata.ackDeadlineSeconds !== row.ackDeadlineSeconds &&
      "ackDeadlineSeconds",
    (row.retryPolicy
      ? seconds(metadata.retryPolicy?.minimumBackoff) !== row.retryPolicy.minimumBackoffSeconds ||
        seconds(metadata.retryPolicy?.maximumBackoff) !== row.retryPolicy.maximumBackoffSeconds
      : !!metadata.retryPolicy) && "retryPolicy",
    (row.deadLetterPolicy
      ? metadata.deadLetterPolicy?.deadLetterTopic !==
          topicName(row.deadLetterPolicy.deadLetterTopic) ||
        metadata.deadLetterPolicy?.maxDeliveryAttempts !== row.deadLetterPolicy.maxDeliveryAttempts
      : !!metadata.deadLetterPolicy) && "deadLetterPolicy",
  ].filter(Boolean);

let created = 0;
try {
  for (const id of plan.pubsub?.topics ?? []) {
    const [exists] = await pubsub.topic(id).exists();
    if (exists) continue;
    try {
      await pubsub.createTopic(id);
      created += 1;
    } catch (error) {
      if (!alreadyExists(error)) throw error;
    }
  }
  for (const row of plan.pubsub?.subscriptions ?? []) {
    const subscription = pubsub.subscription(row.name);
    const [exists] = await subscription.exists();
    if (!exists) {
      try {
        await pubsub.topic(row.topic).createSubscription(row.name, options(row));
        created += 1;
        continue;
      } catch (error) {
        // Created meanwhile: compare it as an existing one.
        if (!alreadyExists(error)) throw error;
      }
    }
    const [metadata] = await subscription.getMetadata();
    const differ = differences(row, metadata);
    if (differ.length)
      throw new Error(
        `Pub/Sub subscription ${row.name} exists with other settings (${differ.join(", ")}); remove it or keep the design's.`,
      );
  }
} finally {
  await pubsub.close();
}
console.log(
  `Pub/Sub topics and subscriptions asserted (${created} created); existing ones keep their messages.`,
);
