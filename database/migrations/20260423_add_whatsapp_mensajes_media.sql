-- Agrega soporte para contenido multimedia en whatsapp.mensajes
-- Fecha: 2026-04-23

BEGIN;

-- 1) Nuevas columnas para tipo de contenido y metadatos de multimedia
ALTER TABLE whatsapp.mensajes
    ADD COLUMN IF NOT EXISTS tipo_contenido VARCHAR(20) NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS media_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL;

-- 2) Asegura que registros existentes tengan el tipo correcto
UPDATE whatsapp.mensajes
SET tipo_contenido = 'text'
WHERE tipo_contenido IS NULL;

-- 3) Constraint CHECK para limitar valores permitidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mensajes_tipo_contenido_chk'
          AND conrelid = 'whatsapp.mensajes'::regclass
    ) THEN
        ALTER TABLE whatsapp.mensajes
            ADD CONSTRAINT mensajes_tipo_contenido_chk
            CHECK (tipo_contenido IN ('text', 'image', 'audio', 'document'));
    END IF;
END
$$;

-- 4) Comentarios descriptivos de las columnas
COMMENT ON COLUMN whatsapp.mensajes.tipo_contenido IS 'Tipo de contenido del mensaje: text, image, audio, document';
COMMENT ON COLUMN whatsapp.mensajes.media_url IS 'URL del archivo multimedia asociado al mensaje (si aplica)';
COMMENT ON COLUMN whatsapp.mensajes.mime_type IS 'MIME type del archivo multimedia (si aplica)';

COMMIT;
