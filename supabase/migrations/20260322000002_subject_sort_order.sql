-- ============================================================================
-- TOP5DOA — Subject sort_order column
-- Allows admins to control display order of subjects in the voting flow.
-- ============================================================================

alter table subjects add column if not exists sort_order integer not null default 0;

create index if not exists idx_subjects_sort_order on subjects (topic_id, sort_order, created_at);
