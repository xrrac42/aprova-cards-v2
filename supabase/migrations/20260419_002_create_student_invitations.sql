-- Add student_invitations table for tracking mentor invites
CREATE TABLE public.student_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE, -- Unique code for the invitation link
  student_email TEXT, -- Will be populated when student signs up
  status TEXT NOT NULL CHECK (status IN ('pending', 'signed_up', 'payment_pending', 'active', 'expired')) DEFAULT 'pending',
  invited_email TEXT, -- Email that was invited (if mentor specified)
  invited_name TEXT, -- Name provided when generating invite
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  signed_up_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to track student auth users created via invitations
CREATE TABLE public.student_auth (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_email TEXT NOT NULL UNIQUE,
  supabase_user_id TEXT NOT NULL UNIQUE, -- Supabase Auth user ID
  invitation_id UUID REFERENCES public.student_invitations(id) ON DELETE SET NULL,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_auth ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for custom auth
CREATE POLICY "Allow all access to student_invitations" ON public.student_invitations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to student_auth" ON public.student_auth FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_invitations_mentor_id ON public.student_invitations(mentor_id);
CREATE INDEX idx_invitations_product_id ON public.student_invitations(product_id);
CREATE INDEX idx_invitations_invite_code ON public.student_invitations(invite_code);
CREATE INDEX idx_invitations_status ON public.student_invitations(status);
CREATE INDEX idx_invitations_student_email ON public.student_invitations(student_email);
CREATE INDEX idx_invitations_expires_at ON public.student_invitations(expires_at);
CREATE INDEX idx_student_auth_email ON public.student_auth(student_email);
CREATE INDEX idx_student_auth_supabase_id ON public.student_auth(supabase_user_id);
CREATE INDEX idx_student_auth_mentor_id ON public.student_auth(mentor_id);
CREATE INDEX idx_student_auth_product_id ON public.student_auth(product_id);

-- Add invitation_id to student_access table to link back to invitation
ALTER TABLE public.student_access ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES public.student_invitations(id) ON DELETE SET NULL;
CREATE INDEX idx_student_access_invitation_id ON public.student_access(invitation_id);
