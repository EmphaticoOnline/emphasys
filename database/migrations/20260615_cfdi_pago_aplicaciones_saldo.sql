-- Complemento de Pagos CFDI 4.0 (Pagos 2.0)
-- Agrega los campos fiscales requeridos por el SAT al nodo DoctoRelacionado.
-- Estos valores se calculan en el momento de cada aplicación de saldo dentro
-- de la transacción con FOR UPDATE, por lo que son deterministas y auditables.

ALTER TABLE public.aplicaciones_saldo
  ADD COLUMN IF NOT EXISTS num_parcialidad   INTEGER,
  ADD COLUMN IF NOT EXISTS imp_saldo_ant     NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS imp_saldo_insoluto NUMERIC(20, 6);

COMMENT ON COLUMN public.aplicaciones_saldo.num_parcialidad IS
'Número de parcialidad SAT (1-based). Cuenta cuántas aplicaciones previas existen
para el mismo documento_destino_id en el momento del INSERT. Calculado dentro de
la misma transacción con FOR UPDATE sobre el documento destino.';

COMMENT ON COLUMN public.aplicaciones_saldo.imp_saldo_ant IS
'Saldo de la factura (documento_destino) antes de esta aplicación, en la moneda
del documento destino. Equivale al campo ImpSaldoAnterior del complemento SAT
Pagos 2.0. Calculado como: total_factura - SUM(monto_moneda_documento) de
aplicaciones previas al momento del INSERT.';

COMMENT ON COLUMN public.aplicaciones_saldo.imp_saldo_insoluto IS
'Saldo de la factura (documento_destino) después de esta aplicación, en la moneda
del documento destino. Equivale al campo ImpSaldoInsoluto del complemento SAT
Pagos 2.0. Calculado como: imp_saldo_ant - monto_moneda_documento.';
