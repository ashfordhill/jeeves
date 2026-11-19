INSERT INTO p_payment_inbox_owner.subscriptions (customer_id, status, event_created)
VALUES ($1, $2, $3)
ON CONFLICT (customer_id) DO UPDATE SET status = EXCLUDED.status, event_created = EXCLUDED.event_created
WHERE subscriptions.event_created < EXCLUDED.event_created
