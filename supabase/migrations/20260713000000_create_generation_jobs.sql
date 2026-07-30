-- Async, chunked AI card generation: job + per-chunk checkpoint tables.
-- See backend/internal/usecases/generation_usecase.go for the map-reduce pipeline that uses these.

CREATE TABLE public.generation_jobs (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discipline_id      UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending', -- pending|processing|reducing|reviewing|completed|failed
  archetype          TEXT,
  preset             TEXT,
  regra_de_ouro      TEXT,
  source_char_count  INTEGER NOT NULL DEFAULT 0,
  total_chunks       INTEGER NOT NULL DEFAULT 0,
  completed_chunks   INTEGER NOT NULL DEFAULT 0,
  reduce_enqueued_at TIMESTAMP WITH TIME ZONE,
  result             JSONB,
  review_error       TEXT,
  error              TEXT,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at         TIMESTAMP WITH TIME ZONE,
  completed_at       TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.generation_chunks (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id       UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  chunk_text   TEXT NOT NULL,
  char_start   INTEGER NOT NULL DEFAULT 0,
  char_end     INTEGER NOT NULL DEFAULT 0,
  card_limit   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  cards        JSONB,
  error        TEXT,
  attempt      INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to generation_jobs" ON public.generation_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to generation_chunks" ON public.generation_chunks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_generation_jobs_discipline_id ON public.generation_jobs(discipline_id);
CREATE INDEX idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX idx_generation_chunks_job_id ON public.generation_chunks(job_id);
CREATE INDEX idx_generation_chunks_status ON public.generation_chunks(status);
