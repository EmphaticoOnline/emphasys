-- Diagnostico rapido de notas de credito especiales con datos fiscales faltantes.
-- Ajusta el filtro de empresa si quieres acotar por tenant.

SELECT
    d.id,
    d.empresa_id,
    d.fecha_creacion,
    d.fecha_documento,
    d.serie,
    d.numero,
    d.tipo_documento,
    d.motivo_nc,
    d.contacto_principal_id,
    c.nombre AS contacto_nombre,
    COALESCE(cdf.rfc, c.rfc) AS contacto_rfc,
    cdf.regimen_fiscal AS contacto_regimen_fiscal,
    cdf.uso_cfdi AS contacto_uso_cfdi,
    cdf.forma_pago AS contacto_forma_pago,
    cdf.metodo_pago AS contacto_metodo_pago,
    cd.cp_sat AS contacto_codigo_postal_fiscal,
    d.rfc_receptor,
    d.nombre_receptor,
    d.regimen_fiscal_receptor,
    d.uso_cfdi,
    d.forma_pago,
    d.metodo_pago,
    d.codigo_postal_receptor
FROM public.documentos d
LEFT JOIN public.contactos c
    ON c.id = d.contacto_principal_id
   AND c.empresa_id = d.empresa_id
LEFT JOIN public.contactos_datos_fiscales cdf
    ON cdf.contacto_id = c.id
LEFT JOIN public.contactos_domicilios cd
    ON cd.contacto_id = c.id
   AND cd.es_principal = true
WHERE LOWER(COALESCE(d.tipo_documento, '')) IN ('nota_credito', 'nota_credito_compra')
  AND LOWER(COALESCE(d.motivo_nc, '')) IN ('bonificacion', 'devolucion')
  AND (
      d.rfc_receptor IS NULL
      OR d.nombre_receptor IS NULL
      OR d.regimen_fiscal_receptor IS NULL
      OR d.uso_cfdi IS NULL
      OR d.forma_pago IS NULL
      OR d.metodo_pago IS NULL
      OR d.codigo_postal_receptor IS NULL
  )
ORDER BY d.fecha_creacion DESC, d.id DESC;