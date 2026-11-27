-- =====================================================================
-- 반짝이네 삼촌: Supabase 무료 플랜 휴면(일시정지) 방지용 점검 함수
-- Supabase > SQL Editor 에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- GitHub Actions(.github/workflows/supabase-keepalive.yml)가 주 3회 이 함수를 호출합니다.
-- 고객 문의 데이터는 건드리지 않습니다.
-- =====================================================================

-- 1) 점검 기록 표 (최근 90일만 보관)
create table if not exists public.keepalive_log (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now(),
  source text not null default 'unknown' check (length(source) <= 40)
);
alter table public.keepalive_log enable row level security;
revoke all on public.keepalive_log from anon, authenticated;
grant select on public.keepalive_log to authenticated;

drop policy if exists keepalive_log_admin_read on public.keepalive_log;
create policy keepalive_log_admin_read on public.keepalive_log
  for select to authenticated using ((select public.is_cleaning_admin()));

-- 2) 점검 함수: 기록 1줄 추가 + 오래된 기록 정리
--    누구나 호출할 수 있지만, 1시간에 한 번만 기록하므로 반복 호출해도 표가 커지지 않습니다.
create or replace function public.keepalive_ping(p_source text default 'github-actions')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_ping timestamptz;
  wrote boolean := false;
begin
  select max(pinged_at) into last_ping from public.keepalive_log;
  if last_ping is null or last_ping < now() - interval '1 hour' then
    insert into public.keepalive_log (source) values (left(coalesce(nullif(btrim(p_source), ''), 'unknown'), 40));
    wrote := true;
  end if;
  delete from public.keepalive_log where pinged_at < now() - interval '90 days';
  return jsonb_build_object(
    'ok', true,
    'recorded', wrote,
    'server_time', now(),
    'inquiries_table_ok', to_regclass('public.cleaning_inquiries') is not null
  );
end;
$$;

revoke all on function public.keepalive_ping(text) from public;
grant execute on function public.keepalive_ping(text) to anon, authenticated;
