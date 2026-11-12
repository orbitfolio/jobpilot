-- Per-user job-search records. The browser keeps IndexedDB as the working copy
-- and upserts changed rows. Service role (the daily scan) bypasses these policies.

create table if not exists public.user_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, collection, record_id)
);

create index if not exists user_records_collection_idx on public.user_records (collection);

alter table public.user_records enable row level security;

create policy "read own records"
  on public.user_records
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own records"
  on public.user_records
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own records"
  on public.user_records
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own records"
  on public.user_records
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_records to authenticated;

-- Last-write-wins: an older device cannot overwrite a newer row.
create or replace function public.upsert_records(rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.user_records as existing (user_id, collection, record_id, payload, updated_at, deleted_at)
  select
    uid,
    elem->>'collection',
    elem->>'record_id',
    coalesce(elem->'payload', '{}'::jsonb),
    (elem->>'updated_at')::timestamptz,
    nullif(elem->>'deleted_at', '')::timestamptz
  from jsonb_array_elements(rows) as elem
  on conflict (user_id, collection, record_id) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where excluded.updated_at >= existing.updated_at;
end;
$$;

grant execute on function public.upsert_records(jsonb) to authenticated;
