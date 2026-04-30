-- Add missing columns to student_access that the Go model requires.
ALTER TABLE public.student_access
  ADD COLUMN IF NOT EXISTS student_id UUID,
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invitation_id UUID,
  ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_student_access_student_id ON public.student_access(student_id);
CREATE INDEX IF NOT EXISTS idx_student_access_mentor_id ON public.student_access(mentor_id);
