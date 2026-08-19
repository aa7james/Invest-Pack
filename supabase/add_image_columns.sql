-- Lets charts hold a pasted screenshot (image_data) and an explicit section (category).
-- The browser already has update rights on pack.charts, so no new policy is needed.
alter table pack.charts add column if not exists image_data text;
alter table pack.charts add column if not exists category text;
