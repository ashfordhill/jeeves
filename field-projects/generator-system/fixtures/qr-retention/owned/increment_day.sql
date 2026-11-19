INSERT INTO p_click_processor_owner.daily (day, total) VALUES ($1::date, 1)
ON CONFLICT (day) DO UPDATE SET total = daily.total + 1
