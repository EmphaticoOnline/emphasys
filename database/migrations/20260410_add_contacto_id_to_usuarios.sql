-- Agrega contacto_id a core.usuarios y valida que sea un contacto tipo Vendedor

ALTER TABLE core.usuarios
  ADD COLUMN vendedor_contacto_id integer;

ALTER TABLE core.usuarios
  ADD CONSTRAINT fk_usuarios_vendedor_contacto
  FOREIGN KEY (vendedor_contacto_id)
  REFERENCES public.contactos(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_vendedor_contacto_id
  ON core.usuarios (vendedor_contacto_id);

CREATE OR REPLACE FUNCTION core.validar_usuario_vendedor_contacto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vendedor_contacto_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
    FROM public.contactos c
   WHERE c.id = NEW.vendedor_contacto_id
     AND c.tipo_contacto = 'Vendedor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vendedor_contacto_id % no es un Vendedor válido', NEW.vendedor_contacto_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_vendedor_contacto ON core.usuarios;

CREATE TRIGGER trg_usuarios_vendedor_contacto
BEFORE INSERT OR UPDATE OF vendedor_contacto_id ON core.usuarios
FOR EACH ROW
EXECUTE FUNCTION core.validar_usuario_vendedor_contacto();
