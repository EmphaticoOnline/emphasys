UPDATE documentos
SET
rfc_receptor = 'XAXX010101000',
nombre_receptor = 'PUBLICO EN GENERAL',
regimen_fiscal_receptor = '616',
uso_cfdi = 'S01',
forma_pago = '01',
metodo_pago = 'PUE',
codigo_postal_receptor = '64000'
WHERE lower(tipo_documento) = 'factura';

UPDATE productos
SET
clave_producto_sat = '01010101',
clave_unidad_sat = 'H87';

SELECT id, email, password_hash
FROM core.usuarios
WHERE email = 'adiaz@emphasys.mx';

SELECT 
p.id,
p.clave,
p.clave_producto_sat
FROM documentos_partidas dp
JOIN productos p ON p.id = dp.producto_id
WHERE dp.documento_id = 8;

SELECT d.id,
       d.empresa_id,
       d.serie,
       d.numero,
       d.fecha_documento,
       d.moneda,
       d.subtotal,
       d.iva,
       d.total,
       d.forma_pago,
       d.metodo_pago,
       d.uso_cfdi,
       d.rfc_receptor,
       d.nombre_receptor,
       d.regimen_fiscal_receptor,
       d.codigo_postal_receptor,
       e.razon_social,
       e.rfc,
       e.regimen_fiscal,
       e.codigo_postal
  FROM documentos d
  JOIN empresas e ON e.id = d.empresa_id
 WHERE d.id = $1
   AND d.empresa_id = $2
   AND LOWER(d.tipo_documento) = 'factura'
 LIMIT 1;