-- Snapshot mínimo de la intención revisada. Sin estas columnas una edición
-- posterior de intenciones_semanales alteraría el significado histórico.
BEGIN;
ALTER TABLE compass.revisiones_frente
  ADD COLUMN prioridad_snapshot varchar(20),
  ADD COLUMN horas_objetivo_snapshot numeric(6,2),
  ADD COLUMN expectativa_atencion_snapshot varchar(20),
  ADD CONSTRAINT ck_revision_prioridad_snapshot CHECK (prioridad_snapshot IS NULL OR prioridad_snapshot IN ('alta','media','baja')),
  ADD CONSTRAINT ck_revision_expectativa_snapshot CHECK (expectativa_atencion_snapshot IS NULL OR expectativa_atencion_snapshot IN ('sin_compromiso','atender','prioritario')),
  ADD CONSTRAINT ck_revision_objetivo_snapshot CHECK (NOT (horas_objetivo_snapshot IS NOT NULL AND expectativa_atencion_snapshot IS NOT NULL));
COMMIT;
