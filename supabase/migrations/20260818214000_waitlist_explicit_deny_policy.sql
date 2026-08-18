create policy "waitlist_no_direct_client_access"
on public.waitlist_subscribers
for all
to anon, authenticated
using (false)
with check (false);
