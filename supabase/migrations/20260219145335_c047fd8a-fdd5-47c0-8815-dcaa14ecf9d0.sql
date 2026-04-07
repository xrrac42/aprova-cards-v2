
-- Create mentors table
CREATE TABLE public.mentors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6c63ff',
  secondary_color TEXT NOT NULL DEFAULT '#43e97b',
  mentor_password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create disciplines table
CREATE TABLE public.disciplines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cards table
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student_progress table
CREATE TABLE public.student_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_email TEXT NOT NULL,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('errei', 'dificil', 'medio', 'facil')),
  next_review DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0
);

-- Create student_sessions table
CREATE TABLE public.student_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_email TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS on all tables (custom auth, no Supabase Auth)
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

-- Since we're using custom auth (not Supabase Auth), we need permissive policies
-- that allow the anon key to access data. Security is handled at the application level.
CREATE POLICY "Allow all access to mentors" ON public.mentors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to disciplines" ON public.disciplines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to cards" ON public.cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to student_progress" ON public.student_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to student_sessions" ON public.student_sessions FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_products_mentor ON public.products(mentor_id);
CREATE INDEX idx_products_access_code ON public.products(access_code);
CREATE INDEX idx_disciplines_product ON public.disciplines(product_id);
CREATE INDEX idx_subjects_discipline ON public.subjects(discipline_id);
CREATE INDEX idx_cards_product ON public.cards(product_id);
CREATE INDEX idx_cards_discipline ON public.cards(discipline_id);
CREATE INDEX idx_cards_subject ON public.cards(subject_id);
CREATE INDEX idx_progress_student ON public.student_progress(student_email, product_id);
CREATE INDEX idx_progress_card ON public.student_progress(card_id);
CREATE INDEX idx_progress_review ON public.student_progress(next_review);
CREATE INDEX idx_sessions_student ON public.student_sessions(student_email, product_id);
CREATE INDEX idx_sessions_date ON public.student_sessions(session_date);

-- Create storage bucket for mentor logos
INSERT INTO storage.buckets (id, name, public) VALUES ('mentor-logos', 'mentor-logos', true);

-- Storage policy for public read
CREATE POLICY "Public read mentor logos" ON storage.objects FOR SELECT USING (bucket_id = 'mentor-logos');
-- Storage policy for upload
CREATE POLICY "Allow upload mentor logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mentor-logos');
-- Storage policy for update
CREATE POLICY "Allow update mentor logos" ON storage.objects FOR UPDATE USING (bucket_id = 'mentor-logos');
-- Storage policy for delete
CREATE POLICY "Allow delete mentor logos" ON storage.objects FOR DELETE USING (bucket_id = 'mentor-logos');
