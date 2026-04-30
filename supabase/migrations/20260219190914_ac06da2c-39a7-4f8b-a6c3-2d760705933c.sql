-- Step 1: Make subject_id nullable first (before we can set it to null)
ALTER TABLE public.cards ALTER COLUMN subject_id DROP NOT NULL;

-- Step 2: Clear existing subject_id values
UPDATE public.cards SET subject_id = NULL WHERE subject_id IS NOT NULL;

-- Step 3: Add unique constraint for upsert on student_progress
ALTER TABLE public.student_progress 
  DROP CONSTRAINT IF EXISTS student_progress_email_card_unique;
ALTER TABLE public.student_progress 
  ADD CONSTRAINT student_progress_email_card_unique UNIQUE (student_email, card_id);

-- Step 4: Add study_time_seconds to student_sessions
ALTER TABLE public.student_sessions 
  ADD COLUMN IF NOT EXISTS study_time_seconds integer NOT NULL DEFAULT 0;

-- Step 5: Drop subjects table
DROP TABLE IF EXISTS public.subjects CASCADE;