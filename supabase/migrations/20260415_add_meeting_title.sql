-- Add meeting_title to pending_action_items so the dashboard can display it.
-- Nullable: existing rows will have NULL; new rows populated by scheduler.
ALTER TABLE public.pending_action_items
  ADD COLUMN IF NOT EXISTS meeting_title TEXT;
