INSERT INTO p_click_processor_owner.sweeps (tick, interval_seconds, months, cutoff_day)
VALUES ($1, $2, $3, $4::date)
