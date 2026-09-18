BEGIN;

INSERT INTO core.usuarios (
  nombre,
  email,
  password_hash,
  activo,
  es_superadmin,
  vendedor_contacto_id,
  ruta_inicio
)
SELECT
  'Sistema Emphasys',
  'sistema@internal.emphasys',
  '$2b$12$NkxdRT7E0qvNK2EN0z3iSOoHwkXtXXSSphr6a8aQGeC7ENMJPUIxW',
  false,
  false,
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1
    FROM core.usuarios
   WHERE lower(email) = lower('sistema@internal.emphasys')
);

COMMIT;
