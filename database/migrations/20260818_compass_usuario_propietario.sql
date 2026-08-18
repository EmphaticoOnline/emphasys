-- Compass es propiedad primaria del usuario. empresa_id queda como contexto
-- opcional y nunca participa en la identidad/autorizacion de relaciones internas.
BEGIN;

-- La nueva unicidad es mas estricta que la anterior (que separaba por empresa).
-- Abortamos sin modificar nada si datos preexistentes no se pueden conservar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM compass.intenciones_semanales
    GROUP BY usuario_id, frente_id, semana_inicio HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Compass: existen intenciones duplicadas por usuario, frente y semana';
  END IF;

  IF EXISTS (
    SELECT 1 FROM compass.revisiones_semanales
    GROUP BY usuario_id, semana_inicio HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Compass: existen revisiones semanales duplicadas por usuario y semana';
  END IF;

  IF EXISTS (
    SELECT 1 FROM compass.revisiones_frente
    GROUP BY usuario_id, revision_semanal_id, frente_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Compass: existen revisiones de Frente duplicadas por usuario, revision y Frente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM compass.tareas
    WHERE es_siguiente_accion = true
    GROUP BY usuario_id, frente_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Compass: existe mas de una siguiente accion por usuario y Frente';
  END IF;
END $$;

-- Primero se retiran las FKs que dependen de empresa_id y sus claves soporte.
ALTER TABLE compass.actividades
  DROP CONSTRAINT fk_actividades_frente,
  DROP CONSTRAINT fk_actividades_origen,
  DROP CONSTRAINT fk_actividades_tarea;
ALTER TABLE compass.decisiones DROP CONSTRAINT fk_decisiones_frente;
ALTER TABLE compass.ideas DROP CONSTRAINT fk_ideas_frente;
ALTER TABLE compass.intenciones_semanales DROP CONSTRAINT fk_intenciones_frente;
ALTER TABLE compass.revisiones_frente
  DROP CONSTRAINT fk_revision_frente_frente,
  DROP CONSTRAINT fk_revision_frente_intencion,
  DROP CONSTRAINT fk_revision_frente_revision;
ALTER TABLE compass.tareas DROP CONSTRAINT fk_tareas_frente;

ALTER TABLE compass.actividades DROP CONSTRAINT uq_actividades_empresa_usuario_id;
ALTER TABLE compass.frentes DROP CONSTRAINT uq_frentes_empresa_usuario_id;
ALTER TABLE compass.intenciones_semanales DROP CONSTRAINT uq_intencion_frente_semana;
ALTER TABLE compass.revisiones_frente DROP CONSTRAINT uq_revision_frente;
ALTER TABLE compass.revisiones_semanales
  DROP CONSTRAINT uq_revision_semana,
  DROP CONSTRAINT uq_revisiones_empresa_usuario_id;
ALTER TABLE compass.tareas DROP CONSTRAINT uq_tareas_empresa_usuario_id;

-- empresa_id conserva su FK a core.empresas, pero deja de ser obligatorio.
ALTER TABLE compass.actividades ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.capturas ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.decisiones ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.frentes ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.ideas ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.intenciones_semanales ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.revisiones_frente ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.revisiones_semanales ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE compass.tareas ALTER COLUMN empresa_id DROP NOT NULL;

-- Las dos tablas que antes validaban empresa/usuario solo indirectamente por una
-- FK compuesta reciben FKs directas. Las FKs de empresa aceptan NULL.
ALTER TABLE compass.intenciones_semanales
  ADD CONSTRAINT fk_intenciones_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  ADD CONSTRAINT fk_intenciones_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);
ALTER TABLE compass.revisiones_frente
  ADD CONSTRAINT fk_revision_frente_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  ADD CONSTRAINT fk_revision_frente_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);

-- Claves de referencia y unicidades de negocio basadas en el propietario.
ALTER TABLE compass.actividades
  ADD CONSTRAINT uq_actividades_usuario_id UNIQUE (usuario_id, id);
ALTER TABLE compass.frentes
  ADD CONSTRAINT uq_frentes_usuario_id UNIQUE (usuario_id, id);
ALTER TABLE compass.intenciones_semanales
  ADD CONSTRAINT uq_intenciones_usuario_id UNIQUE (usuario_id, id),
  ADD CONSTRAINT uq_intencion_frente_semana UNIQUE (usuario_id, frente_id, semana_inicio);
ALTER TABLE compass.revisiones_semanales
  ADD CONSTRAINT uq_revisiones_usuario_id UNIQUE (usuario_id, id),
  ADD CONSTRAINT uq_revision_semana UNIQUE (usuario_id, semana_inicio);
ALTER TABLE compass.tareas
  ADD CONSTRAINT uq_tareas_usuario_id UNIQUE (usuario_id, id);
ALTER TABLE compass.revisiones_frente
  ADD CONSTRAINT uq_revision_frente UNIQUE (usuario_id, revision_semanal_id, frente_id);

-- Relaciones internas: usuario_id es la raiz que impide referencias cruzadas.
ALTER TABLE compass.tareas
  ADD CONSTRAINT fk_tareas_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id);
ALTER TABLE compass.intenciones_semanales
  ADD CONSTRAINT fk_intenciones_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id);
ALTER TABLE compass.decisiones
  ADD CONSTRAINT fk_decisiones_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id);
ALTER TABLE compass.ideas
  ADD CONSTRAINT fk_ideas_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id);
ALTER TABLE compass.actividades
  ADD CONSTRAINT fk_actividades_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id),
  ADD CONSTRAINT fk_actividades_tarea FOREIGN KEY (usuario_id, tarea_id)
    REFERENCES compass.tareas(usuario_id, id),
  ADD CONSTRAINT fk_actividades_origen FOREIGN KEY (usuario_id, actividad_origen_id)
    REFERENCES compass.actividades(usuario_id, id);
ALTER TABLE compass.revisiones_frente
  ADD CONSTRAINT fk_revision_frente_frente FOREIGN KEY (usuario_id, frente_id)
    REFERENCES compass.frentes(usuario_id, id),
  ADD CONSTRAINT fk_revision_frente_intencion FOREIGN KEY (usuario_id, intencion_semanal_id)
    REFERENCES compass.intenciones_semanales(usuario_id, id),
  ADD CONSTRAINT fk_revision_frente_revision FOREIGN KEY (usuario_id, revision_semanal_id)
    REFERENCES compass.revisiones_semanales(usuario_id, id) ON DELETE CASCADE;

-- Reindexacion: usuario primero; empresa queda disponible como filtro contextual.
DROP INDEX compass.ix_actividades_frente_inicio;
DROP INDEX compass.ix_actividades_inicio;
DROP INDEX compass.ix_actividades_tarea;
DROP INDEX compass.ix_capturas_pendientes;
DROP INDEX compass.ix_decisiones_frente_fecha;
DROP INDEX compass.ix_frentes_usuario_estado;
DROP INDEX compass.ix_ideas_activas;
DROP INDEX compass.ix_intenciones_semana;
DROP INDEX compass.ix_revisiones_semana;
DROP INDEX compass.ix_tareas_fecha_limite;
DROP INDEX compass.ix_tareas_frente_estado;
DROP INDEX compass.uq_tareas_siguiente_accion_frente;

CREATE INDEX ix_actividades_frente_inicio ON compass.actividades (usuario_id, frente_id, inicio_programado);
CREATE INDEX ix_actividades_inicio ON compass.actividades (usuario_id, inicio_programado);
CREATE INDEX ix_actividades_tarea ON compass.actividades (usuario_id, tarea_id) WHERE tarea_id IS NOT NULL;
CREATE INDEX ix_capturas_pendientes ON compass.capturas (usuario_id, captured_at) WHERE estado = 'pendiente';
CREATE INDEX ix_decisiones_frente_fecha ON compass.decisiones (usuario_id, frente_id, fecha_decision);
CREATE INDEX ix_frentes_usuario_estado ON compass.frentes (usuario_id, estado);
CREATE INDEX ix_ideas_activas ON compass.ideas (usuario_id, created_at) WHERE estado = 'activa';
CREATE INDEX ix_intenciones_semana ON compass.intenciones_semanales (usuario_id, semana_inicio);
CREATE INDEX ix_revisiones_semana ON compass.revisiones_semanales (usuario_id, semana_inicio);
CREATE INDEX ix_tareas_fecha_limite ON compass.tareas (usuario_id, fecha_limite) WHERE fecha_limite IS NOT NULL;
CREATE INDEX ix_tareas_frente_estado ON compass.tareas (usuario_id, frente_id, estado);
CREATE UNIQUE INDEX uq_tareas_siguiente_accion_frente
  ON compass.tareas (usuario_id, frente_id) WHERE es_siguiente_accion = true;

CREATE INDEX ix_actividades_empresa ON compass.actividades (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_capturas_empresa ON compass.capturas (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_decisiones_empresa ON compass.decisiones (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_frentes_empresa ON compass.frentes (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_ideas_empresa ON compass.ideas (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_intenciones_empresa ON compass.intenciones_semanales (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_revisiones_frente_empresa ON compass.revisiones_frente (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_revisiones_empresa ON compass.revisiones_semanales (empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX ix_tareas_empresa ON compass.tareas (empresa_id) WHERE empresa_id IS NOT NULL;

-- La coherencia Actividad/Tarea/Frente usa ownership y relacion logica, no empresa.
CREATE OR REPLACE FUNCTION compass.validar_actividad_tarea_frente()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_frente_id integer;
BEGIN
  IF NEW.tarea_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT frente_id INTO v_frente_id
    FROM compass.tareas
   WHERE usuario_id = NEW.usuario_id AND id = NEW.tarea_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea % no existe para el usuario indicado', NEW.tarea_id;
  END IF;

  IF NEW.frente_id IS DISTINCT FROM v_frente_id THEN
    RAISE EXCEPTION 'El Frente de la Actividad debe coincidir con el Frente de la Tarea';
  END IF;
  RETURN NEW;
END;
$$;

-- Integridad de relaciones polimorficas que PostgreSQL no puede expresar con FK.
CREATE OR REPLACE FUNCTION compass.validar_referencia_usuario()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text;
  v_id integer;
  v_existe boolean;
BEGIN
  IF TG_TABLE_NAME = 'capturas' THEN
    v_tipo := NEW.tipo_destino;
    v_id := NEW.destino_id;
  ELSE
    v_tipo := NEW.tipo_conversion;
    v_id := NEW.conversion_id;
  END IF;

  IF v_tipo IS NULL OR v_id IS NULL THEN
    RETURN NEW;
  END IF;

  CASE v_tipo
    WHEN 'frente' THEN SELECT EXISTS (SELECT 1 FROM compass.frentes WHERE usuario_id = NEW.usuario_id AND id = v_id) INTO v_existe;
    WHEN 'tarea' THEN SELECT EXISTS (SELECT 1 FROM compass.tareas WHERE usuario_id = NEW.usuario_id AND id = v_id) INTO v_existe;
    WHEN 'actividad' THEN SELECT EXISTS (SELECT 1 FROM compass.actividades WHERE usuario_id = NEW.usuario_id AND id = v_id) INTO v_existe;
    WHEN 'idea' THEN SELECT EXISTS (SELECT 1 FROM compass.ideas WHERE usuario_id = NEW.usuario_id AND id = v_id) INTO v_existe;
    WHEN 'decision' THEN SELECT EXISTS (SELECT 1 FROM compass.decisiones WHERE usuario_id = NEW.usuario_id AND id = v_id) INTO v_existe;
    ELSE RAISE EXCEPTION 'Tipo de referencia Compass no soportado: %', v_tipo;
  END CASE;

  IF NOT v_existe THEN
    RAISE EXCEPTION 'La referencia Compass %:% no pertenece al usuario indicado', v_tipo, v_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capturas_validar_destino ON compass.capturas;
CREATE TRIGGER trg_capturas_validar_destino
BEFORE INSERT OR UPDATE OF usuario_id, tipo_destino, destino_id ON compass.capturas
FOR EACH ROW EXECUTE FUNCTION compass.validar_referencia_usuario();

DROP TRIGGER IF EXISTS trg_ideas_validar_conversion ON compass.ideas;
CREATE TRIGGER trg_ideas_validar_conversion
BEFORE INSERT OR UPDATE OF usuario_id, tipo_conversion, conversion_id ON compass.ideas
FOR EACH ROW EXECUTE FUNCTION compass.validar_referencia_usuario();

COMMIT;
