-- Preferencias independientes por suscripción/dispositivo para Web Push.
-- Idempotente para permitir reejecución segura.
BEGIN;

ALTER TABLE core.push_subscriptions
  ADD COLUMN IF NOT EXISTS chat_activado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vista_previa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sonido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contador_no_leidos boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN core.push_subscriptions.chat_activado IS 'Preferencia de notificaciones de chat para esta suscripción/dispositivo.';
COMMENT ON COLUMN core.push_subscriptions.vista_previa IS 'Permite mostrar el contenido del mensaje en esta suscripción/dispositivo.';
COMMENT ON COLUMN core.push_subscriptions.sonido IS 'Solicita sonido para notificaciones de esta suscripción/dispositivo cuando la plataforma lo soporta.';
COMMENT ON COLUMN core.push_subscriptions.contador_no_leidos IS 'Prepara el contador de no leídos para esta suscripción/dispositivo.';

COMMIT;
