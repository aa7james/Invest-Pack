-- Let the browser (public key) DELETE points from manual series only, so the
-- data editor's "remove row" works. Bloomberg data stays protected.
grant delete on pack.pack_data to anon, authenticated;

drop policy if exists p_manual_delete_data on pack.pack_data;
create policy p_manual_delete_data on pack.pack_data for delete to anon, authenticated
  using (instrument_id in (select id from pack.instruments where source = 'manual'));
