CREATE TABLE p_payment_inbox_owner.subscription_events (
    event_id text NOT NULL,
    customer_id text NOT NULL,
    status text NOT NULL,
    event_created bigint NOT NULL
);
CREATE TABLE p_payment_inbox_owner.subscriptions (
    customer_id text PRIMARY KEY,
    status text NOT NULL,
    event_created bigint NOT NULL
);
