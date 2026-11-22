-- =====================================================================
-- 반짝이네 삼촌: 홈페이지 디자인 관리 기능용 설정
-- Supabase > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다(기존 고객 문의 데이터는 건드리지 않습니다).
-- =====================================================================

-- 1) 홈페이지 내용 저장 표 (draft = 임시 저장, published = 게시본)
create table if not exists public.site_content (
  id text primary key check (id in ('draft', 'published')),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 300000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- 2) 게시 기록 (되돌리기용, 최근 30개 보관)
create table if not exists public.site_content_history (
  id bigint generated always as identity primary key,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  note text check (note is null or length(note) <= 200)
);

alter table public.site_content enable row level security;
alter table public.site_content_history enable row level security;

revoke all on public.site_content, public.site_content_history from anon, authenticated;
grant select on public.site_content to anon;                                  -- 방문자: 게시본만(아래 정책)
grant select, insert, update on public.site_content to authenticated;          -- 관리자: 임시 저장
grant select on public.site_content_history to authenticated;

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read on public.site_content
  for select to anon using (id = 'published');

drop policy if exists site_content_admin_read on public.site_content;
create policy site_content_admin_read on public.site_content
  for select to authenticated using (id = 'published' or (select public.is_cleaning_admin()));

drop policy if exists site_content_admin_draft_insert on public.site_content;
create policy site_content_admin_draft_insert on public.site_content
  for insert to authenticated with check (id = 'draft' and (select public.is_cleaning_admin()));

drop policy if exists site_content_admin_draft_update on public.site_content;
create policy site_content_admin_draft_update on public.site_content
  for update to authenticated using (id = 'draft' and (select public.is_cleaning_admin()))
  with check (id = 'draft' and (select public.is_cleaning_admin()));

drop policy if exists site_content_history_admin_read on public.site_content_history;
create policy site_content_history_admin_read on public.site_content_history
  for select to authenticated using ((select public.is_cleaning_admin()));

-- 3) 게시 함수: 관리자만 실행 가능. 게시본 교체 + 기록 저장 + 오래된 기록 정리
create or replace function public.publish_site_content(p_content jsonb, p_note text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ts timestamptz := now();
begin
  if not public.is_cleaning_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 300000 then
    raise exception 'Invalid content' using errcode = '22023';
  end if;

  insert into public.site_content (id, content, updated_at, updated_by)
  values ('published', p_content, ts, auth.uid())
  on conflict (id) do update set content = excluded.content, updated_at = ts, updated_by = excluded.updated_by;

  insert into public.site_content (id, content, updated_at, updated_by)
  values ('draft', p_content, ts, auth.uid())
  on conflict (id) do update set content = excluded.content, updated_at = ts, updated_by = excluded.updated_by;

  insert into public.site_content_history (content, published_at, published_by, note)
  values (p_content, ts, auth.uid(), left(nullif(btrim(coalesce(p_note, '')), ''), 200));

  delete from public.site_content_history
  where id not in (select id from public.site_content_history order by published_at desc limit 30);

  return ts;
end;
$$;

revoke all on function public.publish_site_content(jsonb, text) from public, anon;
grant execute on function public.publish_site_content(jsonb, text) to authenticated;

-- 4) 사진 보관함 (누구나 보기 가능, 관리자만 올리기/삭제)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists site_images_admin_insert on storage.objects;
create policy site_images_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'site-images' and (select public.is_cleaning_admin()));

drop policy if exists site_images_admin_update on storage.objects;
create policy site_images_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'site-images' and (select public.is_cleaning_admin()))
  with check (bucket_id = 'site-images' and (select public.is_cleaning_admin()));

drop policy if exists site_images_admin_delete on storage.objects;
create policy site_images_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'site-images' and (select public.is_cleaning_admin()));

drop policy if exists site_images_admin_list on storage.objects;
create policy site_images_admin_list on storage.objects
  for select to authenticated using (bucket_id = 'site-images' and (select public.is_cleaning_admin()));
