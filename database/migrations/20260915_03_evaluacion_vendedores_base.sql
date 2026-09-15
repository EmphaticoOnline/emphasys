BEGIN;

ALTER TABLE core.empresas
  ADD COLUMN IF NOT EXISTS zona_horaria varchar(64);

COMMENT ON COLUMN core.empresas.zona_horaria IS
  'Zona horaria IANA usada para métricas y calendarios laborales; NULL significa no configurada.';

CREATE TABLE IF NOT EXISTS core.empresa_horarios_laborales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_horarios_laborales_horas_chk CHECK (hora_fin > hora_inicio),
  CONSTRAINT empresa_horarios_laborales_empresa_dia_uq UNIQUE (empresa_id, dia_semana)
);

CREATE TABLE IF NOT EXISTS core.empresa_excepciones_laborales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo varchar(30) NOT NULL CHECK (tipo IN ('inhabil', 'horario_especial')),
  descripcion text,
  hora_inicio time,
  hora_fin time,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_excepciones_laborales_empresa_fecha_uq UNIQUE (empresa_id, fecha),
  CONSTRAINT empresa_excepciones_laborales_horario_chk CHECK (
    (tipo = 'inhabil' AND hora_inicio IS NULL AND hora_fin IS NULL)
    OR
    (tipo = 'horario_especial' AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
  )
);

CREATE INDEX IF NOT EXISTS ix_empresa_horarios_laborales_empresa
  ON core.empresa_horarios_laborales (empresa_id, dia_semana)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS ix_empresa_excepciones_laborales_empresa_fecha
  ON core.empresa_excepciones_laborales (empresa_id, fecha);

CREATE TABLE IF NOT EXISTS crm.contacto_responsabilidades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id) ON DELETE CASCADE,
  contacto_id integer NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  vendedor_contacto_id integer NOT NULL REFERENCES public.contactos(id) ON DELETE RESTRICT,
  responsable_usuario_id integer REFERENCES core.usuarios(id) ON DELETE SET NULL,
  asignado_por_usuario_id integer REFERENCES core.usuarios(id) ON DELETE SET NULL,
  finalizado_por_usuario_id integer REFERENCES core.usuarios(id) ON DELETE SET NULL,
  origen varchar(30) NOT NULL CHECK (origen IN ('manual', 'round_robin', 'importacion', 'automatizacion', 'sistema')),
  motivo text,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacto_responsabilidades_vigencia_chk CHECK (
    vigente_hasta IS NULL OR vigente_hasta >= vigente_desde
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacto_responsabilidades_vigente
  ON crm.contacto_responsabilidades (empresa_id, contacto_id)
  WHERE vigente_hasta IS NULL;

CREATE INDEX IF NOT EXISTS ix_contacto_responsabilidades_historial
  ON crm.contacto_responsabilidades (empresa_id, contacto_id, vigente_desde DESC);

CREATE INDEX IF NOT EXISTS ix_contacto_responsabilidades_vendedor
  ON crm.contacto_responsabilidades (empresa_id, vendedor_contacto_id, vigente_desde DESC);

ALTER TABLE crm.mensajes
  ADD COLUMN IF NOT EXISTS autor_usuario_id integer,
  ADD COLUMN IF NOT EXISTS autor_vendedor_contacto_id integer,
  ADD COLUMN IF NOT EXISTS responsabilidad_contacto_id bigint,
  ADD COLUMN IF NOT EXISTS origen_envio varchar(30);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensajes_autor_usuario_fk'
  ) THEN
    ALTER TABLE crm.mensajes
      ADD CONSTRAINT mensajes_autor_usuario_fk
      FOREIGN KEY (autor_usuario_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensajes_autor_vendedor_contacto_fk'
  ) THEN
    ALTER TABLE crm.mensajes
      ADD CONSTRAINT mensajes_autor_vendedor_contacto_fk
      FOREIGN KEY (autor_vendedor_contacto_id) REFERENCES public.contactos(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensajes_responsabilidad_contacto_fk'
  ) THEN
    ALTER TABLE crm.mensajes
      ADD CONSTRAINT mensajes_responsabilidad_contacto_fk
      FOREIGN KEY (responsabilidad_contacto_id) REFERENCES crm.contacto_responsabilidades(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensajes_origen_envio_chk'
  ) THEN
    ALTER TABLE crm.mensajes
      ADD CONSTRAINT mensajes_origen_envio_chk
      CHECK (
        origen_envio IS NULL
        OR origen_envio IN ('manual', 'plantilla_manual', 'automatizado', 'sistema', 'desconocido')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_mensajes_autor_fecha
  ON crm.mensajes (empresa_id, autor_usuario_id, fecha_envio DESC)
  WHERE autor_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_mensajes_autor_vendedor_fecha
  ON crm.mensajes (empresa_id, autor_vendedor_contacto_id, fecha_envio DESC)
  WHERE autor_vendedor_contacto_id IS NOT NULL;

CREATE OR REPLACE FUNCTION crm.registrar_cambio_responsable_contacto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor integer;
  v_origen varchar(30);
  v_responsable_usuario integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.vendedor_id IS NOT DISTINCT FROM OLD.vendedor_id THEN
    RETURN NEW;
  END IF;

  v_actor := NULLIF(current_setting('app.usuario_id', true), '')::integer;
  v_origen := COALESCE(NULLIF(current_setting('app.responsabilidad_origen', true), ''), 'sistema');

  IF v_origen NOT IN ('manual', 'round_robin', 'importacion', 'automatizacion', 'sistema') THEN
    v_origen := 'sistema';
  END IF;

  UPDATE crm.contacto_responsabilidades
     SET vigente_hasta = now(),
         finalizado_por_usuario_id = v_actor
   WHERE empresa_id = NEW.empresa_id
     AND contacto_id = NEW.id
     AND vigente_hasta IS NULL;

  IF NEW.vendedor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN COUNT(*) = 1 THEN MIN(u.id) ELSE NULL END
    INTO v_responsable_usuario
    FROM core.usuarios u
    JOIN core.usuarios_empresas ue
      ON ue.usuario_id = u.id
     AND ue.empresa_id = NEW.empresa_id
     AND ue.activo = true
   WHERE u.vendedor_contacto_id = NEW.vendedor_id
     AND u.activo = true;

  INSERT INTO crm.contacto_responsabilidades (
    empresa_id,
    contacto_id,
    vendedor_contacto_id,
    responsable_usuario_id,
    asignado_por_usuario_id,
    origen,
    vigente_desde,
    motivo
  ) VALUES (
    NEW.empresa_id,
    NEW.id,
    NEW.vendedor_id,
    v_responsable_usuario,
    v_actor,
    v_origen,
    now(),
    CASE WHEN v_origen = 'sistema' THEN 'Asignación registrada sin contexto explícito de origen' ELSE NULL END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contactos_responsabilidad ON public.contactos;
CREATE TRIGGER trg_contactos_responsabilidad
AFTER INSERT OR UPDATE OF vendedor_id ON public.contactos
FOR EACH ROW
EXECUTE FUNCTION crm.registrar_cambio_responsable_contacto();

-- Punto de partida, no reconstrucción histórica: las asignaciones vigentes
-- existentes comienzan a auditarse desde el momento de aplicar la migración.
INSERT INTO crm.contacto_responsabilidades (
  empresa_id,
  contacto_id,
  vendedor_contacto_id,
  responsable_usuario_id,
  asignado_por_usuario_id,
  origen,
  vigente_desde,
  motivo
)
SELECT
  c.empresa_id,
  c.id,
  c.vendedor_id,
  usuario_unico.usuario_id,
  NULL,
  'sistema',
  now(),
  'Vigencia inicial registrada al habilitar la bitácora; no reconstruye asignaciones anteriores'
FROM public.contactos c
LEFT JOIN LATERAL (
  SELECT CASE WHEN COUNT(*) = 1 THEN MIN(u.id) ELSE NULL END AS usuario_id
  FROM core.usuarios u
  JOIN core.usuarios_empresas ue
    ON ue.usuario_id = u.id
   AND ue.empresa_id = c.empresa_id
   AND ue.activo = true
  WHERE u.vendedor_contacto_id = c.vendedor_id
    AND u.activo = true
) usuario_unico ON true
WHERE c.vendedor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM crm.contacto_responsabilidades r
    WHERE r.empresa_id = c.empresa_id
      AND r.contacto_id = c.id
      AND r.vigente_hasta IS NULL
  );

COMMENT ON TABLE crm.contacto_responsabilidades IS
  'Historial temporal de la responsabilidad comercial de cada contacto; no representa autoría de mensajes.';
COMMENT ON COLUMN crm.mensajes.autor_usuario_id IS
  'Usuario autenticado que originó el mensaje saliente; NULL en historial previo o envíos sin autor conocido.';
COMMENT ON COLUMN crm.mensajes.autor_vendedor_contacto_id IS
  'Contacto vendedor vinculado al usuario autor al momento del envío.';
COMMENT ON COLUMN crm.mensajes.responsabilidad_contacto_id IS
  'Responsabilidad vigente del contacto al momento del envío, separada de la autoría.';
COMMENT ON COLUMN crm.mensajes.origen_envio IS
  'Clasificación del envío: manual, plantilla_manual, automatizado, sistema o desconocido.';

COMMIT;
