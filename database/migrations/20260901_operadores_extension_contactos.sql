DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_contactos_empresa_id') THEN
    ALTER TABLE public.contactos ADD CONSTRAINT uq_contactos_empresa_id UNIQUE (empresa_id,id);
  END IF;
END $$;
ALTER TABLE transporte.operadores DROP CONSTRAINT IF EXISTS operadores_contacto_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_operadores_contacto_empresa') THEN
    ALTER TABLE transporte.operadores ADD CONSTRAINT fk_operadores_contacto_empresa FOREIGN KEY (empresa_id,contacto_id) REFERENCES public.contactos (empresa_id,id);
  END IF;
END $$;
