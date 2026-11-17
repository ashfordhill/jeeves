SELECT payload, pg_advisory_xact_lock(CASE WHEN payload->>'gate'='old-fill' THEN 710014 ELSE 710015 END) FROM p_items_api_owner.records WHERE key=$1;
