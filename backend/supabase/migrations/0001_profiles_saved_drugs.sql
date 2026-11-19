-- profiles: Supabase Auth 사용자와 1:1
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- saved_drugs: 사용자가 저장한 약
create table if not exists public.saved_drugs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  drug_name text not null,
  product_code text,
  created_at timestamptz not null default now()
);

create index if not exists saved_drugs_user_id_idx on public.saved_drugs(user_id);

alter table public.saved_drugs enable row level security;

create policy "saved_drugs_select_own" on public.saved_drugs
  for select using (auth.uid() = user_id);
create policy "saved_drugs_insert_own" on public.saved_drugs
  for insert with check (auth.uid() = user_id);
create policy "saved_drugs_delete_own" on public.saved_drugs
  for delete using (auth.uid() = user_id);

-- 가입 시 profiles 행 생성: Supabase 공식 Managing User Data 가이드의
-- security definer + 빈 search_path + auth.users AFTER INSERT 트리거 패턴.
-- 출처: https://supabase.com/docs/guides/auth/managing-user-data
-- 이 프로젝트의 profiles 스키마에는 선택적 display_name만 있으므로 id만 저장한다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
