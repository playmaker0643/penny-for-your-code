-- Restrict Realtime broadcast/presence channel access by default
-- We only use postgres_changes (table-RLS gated). Block all broadcast/presence
-- channel access until explicit per-topic policies are added.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='realtime' AND table_name='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Deny all realtime channel access by default" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Deny all realtime channel access by default" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  END IF;
END $$;