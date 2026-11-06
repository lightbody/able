-- My App placeholder schema -- proves out the Postgres -> Neon Realtime
-- -> frontend sync pipeline end to end. Replace with real domain tables
-- as features land.

CREATE TABLE greetings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO greetings (message) VALUES ('Hello, My App!');
