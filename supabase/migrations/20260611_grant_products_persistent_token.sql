-- Grant authenticated Supabase users permission to update persistent_token.
-- RLS policy alone (USING (true)) is not enough — PostgreSQL also requires
-- an explicit table-level GRANT for the role to perform DML.
GRANT UPDATE (persistent_token) ON public.products TO authenticated;
