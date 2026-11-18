CREATE TABLE p_caller_owner.items(id text PRIMARY KEY,title text NOT NULL,effects integer NOT NULL DEFAULT 1);
CREATE TABLE p_caller_owner.inbox(id text PRIMARY KEY,item_id text NOT NULL,title text NOT NULL,effects integer NOT NULL DEFAULT 1);
CREATE TABLE p_caller_owner.deliveries(id text PRIMARY KEY,item_id text NOT NULL,title text NOT NULL,effects integer NOT NULL DEFAULT 1);
