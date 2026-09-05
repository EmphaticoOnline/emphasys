CREATE TABLE IF NOT EXISTS sat.subtipos_remolque (
  clave_subtipo_remolque_sat varchar(20) PRIMARY KEY,
  descripcion text NOT NULL,
  fecha_inicio_vigencia date NULL,
  fecha_fin_vigencia date NULL
);
CREATE INDEX IF NOT EXISTS subtipos_remolque_descripcion_idx ON sat.subtipos_remolque (lower(descripcion));

INSERT INTO sat.subtipos_remolque (clave_subtipo_remolque_sat, descripcion, fecha_inicio_vigencia, fecha_fin_vigencia) VALUES
('CTR001','Caballete','2024-07-17',NULL),('CTR002','Caja','2024-07-17',NULL),('CTR003','Caja Abierta','2024-07-17',NULL),('CTR004','Caja Cerrada','2024-07-17',NULL),('CTR005','Caja De Recolección Con Cargador Frontal','2024-07-17',NULL),('CTR006','Caja Refrigerada','2024-07-17',NULL),('CTR007','Caja Seca','2024-07-17',NULL),('CTR008','Caja Transferencia','2024-07-17',NULL),('CTR009','Cama Baja o Cuello Ganso','2024-07-17',NULL),('CTR010','Chasis Portacontenedor','2024-07-17',NULL),('CTR011','Convencional De Chasis','2024-07-17',NULL),('CTR012','Equipo Especial','2024-07-17',NULL),('CTR013','Estacas','2024-07-17',NULL),('CTR014','Góndola Madrina','2024-07-17',NULL),('CTR015','Grúa Industrial','2024-07-17',NULL),('CTR016','Grúa','2024-07-17',NULL),('CTR017','Integral','2024-07-17',NULL),('CTR018','Jaula','2024-07-17',NULL),('CTR019','Media Redila','2024-07-17',NULL),('CTR020','Pallet o Celdillas','2024-07-17',NULL),('CTR021','Plataforma','2024-07-17',NULL),('CTR022','Plataforma Con Grúa','2024-07-17',NULL),('CTR023','Plataforma Encortinada','2024-07-17',NULL),('CTR024','Redilas','2024-07-17',NULL),('CTR025','Refrigerador','2024-07-17',NULL),('CTR026','Revolvedora','2024-07-17',NULL),('CTR027','Semicaja','2024-07-17',NULL),('CTR028','Tanque','2024-07-17',NULL),('CTR029','Tolva','2024-07-17',NULL),('CTR031','Volteo','2024-07-17',NULL),('CTR032','Volteo Desmontable','2024-07-17',NULL)
ON CONFLICT (clave_subtipo_remolque_sat) DO UPDATE SET descripcion=EXCLUDED.descripcion, fecha_inicio_vigencia=EXCLUDED.fecha_inicio_vigencia, fecha_fin_vigencia=EXCLUDED.fecha_fin_vigencia;

ALTER TABLE transporte.vehiculos ADD COLUMN IF NOT EXISTS remolque_predeterminado_id bigint NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_transporte_vehiculos_remolque_predeterminado') THEN
    ALTER TABLE transporte.vehiculos ADD CONSTRAINT fk_transporte_vehiculos_remolque_predeterminado
      FOREIGN KEY (empresa_id, remolque_predeterminado_id) REFERENCES transporte.remolques (empresa_id, id);
  END IF;
END $$;
