-- 2026-11-24 사용자가 로컬 Swagger에서 유효한 사용자 JWT로 GET /me/profile을
-- 호출해 403 "프로필 저장소 접근 권한이 없습니다." 응답을 직접 확인했다.
-- RLS 본인 행 정책은 유지하고, authenticated 역할의 조회·수정 권한만 부여한다.
-- 적용은 기존 마이그레이션과 같이 Supabase SQL Editor에서 직접 실행한다.
grant select, update on public.profiles to authenticated;
