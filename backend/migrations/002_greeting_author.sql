-- Attribute each greeting to the (now-authenticated) WorkOS user who
-- created it. Nullable: the seed row and anything written before auth
-- landed has no author.
ALTER TABLE greetings ADD COLUMN created_by TEXT;
