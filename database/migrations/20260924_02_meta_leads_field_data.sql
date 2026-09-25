ALTER TABLE crm.meta_leads
  ADD COLUMN IF NOT EXISTS field_data JSONB NOT NULL DEFAULT '[]'::jsonb;
