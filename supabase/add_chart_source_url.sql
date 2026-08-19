-- Lets a chart (e.g. an image/screenshot panel) store a clickable source link.
alter table pack.charts add column if not exists source_url text;
