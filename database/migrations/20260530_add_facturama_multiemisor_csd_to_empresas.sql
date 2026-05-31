ALTER TABLE core.empresas
	ADD COLUMN IF NOT EXISTS cfdi_csd_registrado_facturama BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS cfdi_csd_fecha_actualizacion TIMESTAMP NULL,
	ADD COLUMN IF NOT EXISTS cfdi_csd_cer_path VARCHAR NULL,
	ADD COLUMN IF NOT EXISTS cfdi_csd_key_path VARCHAR NULL,
	ADD COLUMN IF NOT EXISTS cfdi_csd_password_encrypted TEXT NULL;

COMMENT ON COLUMN core.empresas.cfdi_csd_registrado_facturama IS 'Indica si el CSD fue registrado exitosamente en Facturama Multiemisor';
COMMENT ON COLUMN core.empresas.cfdi_csd_fecha_actualizacion IS 'Fecha de la ultima actualizacion del CSD en Facturama Multiemisor';
COMMENT ON COLUMN core.empresas.cfdi_csd_cer_path IS 'Ruta relativa en uploads del archivo .cer cargado para Facturama Multiemisor';
COMMENT ON COLUMN core.empresas.cfdi_csd_key_path IS 'Ruta relativa en uploads del archivo .key cargado para Facturama Multiemisor';
COMMENT ON COLUMN core.empresas.cfdi_csd_password_encrypted IS 'Contrasena CSD cifrada para registro en Facturama Multiemisor';
