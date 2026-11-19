CREATE TABLE p_click_processor_owner.daily (day date PRIMARY KEY, total integer NOT NULL);
CREATE TABLE p_click_processor_owner.breakdowns (
  day date NOT NULL, agent text NOT NULL CHECK (length(agent) > 0), total integer NOT NULL,
  PRIMARY KEY (day, agent)
);
CREATE TABLE p_click_processor_owner.sweeps (
  tick text NOT NULL, interval_seconds integer NOT NULL, months integer NOT NULL, cutoff_day date NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tick, interval_seconds)
);
