INSERT INTO p_click_processor_owner.breakdowns (day, agent, total) VALUES ($1::date, $2, 1)
ON CONFLICT (day, agent) DO UPDATE SET total = breakdowns.total + 1
