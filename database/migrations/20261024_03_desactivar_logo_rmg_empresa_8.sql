-- Corrección de datos: el logo de RMG (Logo_RMG.png) se subió por error a la empresa 8
-- (ESCUELA KEMPER URGATE) y ocultaba su logotipo original (asset 16).
-- Desactiva únicamente el asset 17 de esa empresa; no toca ningún otro registro.
UPDATE core.empresas_assets
   SET activo = false
 WHERE id = 17
   AND empresa_id = 8
   AND tipo = 'logo_default'
   AND ruta = '/uploads/empresas/Prueba/Logo_RMG.png';
