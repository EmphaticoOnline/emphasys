CREATE TABLE IF NOT EXISTS sat.figuras_transporte (clave_figura_transporte_sat varchar(10) PRIMARY KEY, descripcion text NOT NULL, fecha_inicio_vigencia date NULL, fecha_fin_vigencia date NULL);
CREATE INDEX IF NOT EXISTS figuras_transporte_descripcion_idx ON sat.figuras_transporte (lower(descripcion));
INSERT INTO sat.figuras_transporte VALUES ('01','Operador','2024-07-17',NULL),('02','Propietario','2024-07-17',NULL),('03','Arrendador','2024-07-17',NULL),('04','Notificado','2024-07-17',NULL),('05','Integrante de Coordinados','2024-07-26',NULL) ON CONFLICT (clave_figura_transporte_sat) DO UPDATE SET descripcion=EXCLUDED.descripcion,fecha_inicio_vigencia=EXCLUDED.fecha_inicio_vigencia,fecha_fin_vigencia=EXCLUDED.fecha_fin_vigencia;
DO $$ BEGIN
 ALTER TABLE transporte.viaje_figuras DROP CONSTRAINT IF EXISTS uq_viaje_figuras_empresa_contacto;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_viaje_figuras_viaje_contacto') THEN ALTER TABLE transporte.viaje_figuras ADD CONSTRAINT uq_viaje_figuras_viaje_contacto UNIQUE (empresa_id,viaje_id,contacto_id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_viaje_figuras_contacto_empresa') THEN ALTER TABLE transporte.viaje_figuras DROP CONSTRAINT IF EXISTS viaje_figuras_contacto_id_fkey; ALTER TABLE transporte.viaje_figuras ADD CONSTRAINT fk_viaje_figuras_contacto_empresa FOREIGN KEY (empresa_id,contacto_id) REFERENCES public.contactos(empresa_id,id); END IF;
END $$;
