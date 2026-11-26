-- Phase 3: 복약 질문 세션과 대화 이력 (docs/03_DB_설계서.md 2-3, 2-4).
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_at_idx
  on public.chat_messages(session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat_sessions_select_own" on public.chat_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert to authenticated with check (auth.uid() = user_id);

-- 메시지에는 user_id가 없으므로 부모 세션의 소유자로 본인 행을 판단한다.
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );
create policy "chat_messages_insert_own" on public.chat_messages
  for insert to authenticated with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );

-- RLS와 테이블 권한은 별개다. 첫 적용부터 조회/생성 권한도 함께 부여한다.
grant select, insert on public.chat_sessions, public.chat_messages to authenticated;
