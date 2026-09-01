-- Amplía domicilios adicionales sin alterar el domicilio principal.
ALTER TABLE public.contactos_domicilios
  ADD COLUMN IF NOT EXISTS domicilio character varying,
  ADD COLUMN IF NOT EXISTS coto_o_fraccionamiento character varying(255),
  ADD COLUMN IF NOT EXISTS recibe character varying(100),
  ADD COLUMN IF NOT EXISTS telefono_recibe character varying(20);
