-- =========================================================
-- SCRIPT:
-- 20260717_01_create_core_push_subscriptions.sql
--
-- Cimientos de la infraestructura general de notificaciones push del ERP
-- (Web Push estándar + VAPID, sin Firebase, sin colas). Este bloque SOLO
-- crea el almacenamiento de suscripciones y los endpoints de alta/baja; no
-- envía ninguna notificación todavía. WhatsApp será, en un bloque
-- posterior, apenas el primer consumidor de esta infraestructura general.
--
-- Por qué la suscripción pertenece al usuario y NO a la empresa activa:
-- una PushSubscription del navegador (endpoint + claves p256dh/auth) es
-- propiedad del par navegador+origen, no de un "espacio de trabajo" lógico
-- dentro de la app. core.usuarios ya es inherentemente multiempresa (ver
-- core.usuarios_empresas): el mismo usuario cambia de empresa activa sin
-- cerrar sesión ni cambiar de dispositivo. Si la suscripción llevara
-- empresa_id, el mismo navegador generaría un registro duplicado por cada
-- empresa a la que el usuario cambie, chocando en la práctica con la
-- unicidad natural del endpoint. La empresa relevante para cada
-- notificación futura se resuelve en el momento del envío, a partir de la
-- entidad que la origina (para WhatsApp: conversación -> contacto ->
-- vendedor -> usuario), nunca desde la suscripción misma.
--
-- Referencia de diagnóstico previo (arquitectura de asignación de
-- conversaciones): crm.conversaciones.contacto_id -> public.contactos.id ->
-- public.contactos.vendedor_id -> public.contactos (fila del vendedor) ->
-- core.usuarios.vendedor_contacto_id -> core.usuarios.id. Esta tabla es el
-- destino final de esa cadena: a qué dispositivos del usuario resuelto se
-- le enviará el push en el bloque que sí implemente el envío.
-- =========================================================

BEGIN;

CREATE TABLE core.push_subscriptions (
  id bigserial PRIMARY KEY,

  usuario_id integer NOT NULL,

  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,

  user_agent text,
  plataforma text,
  nombre_dispositivo text,

  creada_en timestamptz NOT NULL DEFAULT now(),
  ultima_actividad_en timestamptz NOT NULL DEFAULT now(),
  desactivada_en timestamptz,

  CONSTRAINT uq_push_subscriptions_endpoint
    UNIQUE (endpoint),

  CONSTRAINT fk_push_subscriptions_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES core.usuarios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

COMMENT ON TABLE core.push_subscriptions IS 'Suscripciones Web Push (VAPID) por usuario y dispositivo/navegador. Pertenecen exclusivamente al usuario (core.usuarios), nunca a una empresa activa: ver cabecera de esta migración para el razonamiento completo. Bloque de cimientos: todavía no existe lógica de envío que consuma esta tabla.';
COMMENT ON COLUMN core.push_subscriptions.id IS 'Identificador interno de la suscripción.';
COMMENT ON COLUMN core.push_subscriptions.usuario_id IS 'Usuario del ERP dueño de esta suscripción (core.usuarios.id). Nunca se recibe del cliente en los endpoints: siempre se toma de req.auth.userId en el backend.';
COMMENT ON COLUMN core.push_subscriptions.endpoint IS 'URL única que identifica esta suscripción ante el proveedor push del navegador (PushSubscription.endpoint). Es la identidad real del dispositivo/navegador suscrito, no nombre_dispositivo.';
COMMENT ON COLUMN core.push_subscriptions.p256dh IS 'Clave pública de cifrado de la suscripción (PushSubscription.toJSON().keys.p256dh), necesaria para cifrar el payload al enviar en un bloque futuro. Nunca se expone en listados al frontend.';
COMMENT ON COLUMN core.push_subscriptions.auth IS 'Secreto de autenticación de la suscripción (PushSubscription.toJSON().keys.auth). Nunca se expone en listados al frontend.';
COMMENT ON COLUMN core.push_subscriptions.user_agent IS 'navigator.userAgent capturado al registrar, solo para diagnóstico/soporte.';
COMMENT ON COLUMN core.push_subscriptions.plataforma IS 'Heurística orientativa del dispositivo (ej. iphone, android, desktop), calculada en el cliente. No es una fuente de verdad de seguridad.';
COMMENT ON COLUMN core.push_subscriptions.nombre_dispositivo IS 'Nombre sugerido para que el usuario distinga sus dispositivos (ej. "Chrome en macOS"). Puramente informativo; la identidad real de la suscripción sigue siendo endpoint.';
COMMENT ON COLUMN core.push_subscriptions.creada_en IS 'Fecha y hora del primer registro de esta suscripción.';
COMMENT ON COLUMN core.push_subscriptions.ultima_actividad_en IS 'Fecha y hora del último registro/reactivación de esta suscripción. Se actualizará también en cada envío exitoso cuando exista lógica de envío (bloque futuro).';
COMMENT ON COLUMN core.push_subscriptions.desactivada_en IS 'Fecha y hora en que se desactivó (soft-delete). NULL = suscripción activa. Vuelve a NULL automáticamente si el mismo endpoint se registra de nuevo (reactivación vía UPSERT).';
COMMENT ON CONSTRAINT uq_push_subscriptions_endpoint ON core.push_subscriptions IS 'Un mismo endpoint de PushSubscription nunca puede pertenecer a dos filas: el alta hace UPSERT por este valor (incluyendo reasignación de usuario_id si el mismo dispositivo/navegador ahora pertenece a otro usuario).';
COMMENT ON CONSTRAINT fk_push_subscriptions_usuario ON core.push_subscriptions IS 'Si se elimina el usuario, sus suscripciones dejan de tener sentido y se eliminan con él.';

CREATE INDEX idx_push_subscriptions_usuario_activas
ON core.push_subscriptions (usuario_id)
WHERE desactivada_en IS NULL;

COMMENT ON INDEX core.idx_push_subscriptions_usuario_activas IS 'Índice parcial para resolver rápidamente los dispositivos activos de un usuario (listado en este bloque; envío de push en un bloque futuro), sin escanear suscripciones ya desactivadas.';

COMMIT;
