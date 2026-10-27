export function formatearFolioDocumento(serie: string, numero: number): string {
  const serieLimpia = (serie ?? '').trim();

  const ancho = Math.abs(numero) < 1000 ? 3 : 6;
  const numeroConSigno = numero < 0 ? '-' : '';
  const numeroFormateado = `${numeroConSigno}${Math.abs(numero).toString().padStart(ancho, '0')}`;

  if (!serieLimpia) {
    return numeroFormateado;
  }

  return `${serieLimpia}-${numeroFormateado}`;
}

const TIPOS_CON_FOLIO_EXTERNO = new Set(['factura_compra', 'nota_credito_compra']);

/**
 * Folio que se muestra al usuario. En compras se usa el folio del proveedor
 * (serie_externa/numero_externo) y, si no se capturó, el folio interno.
 * Misma regla que resolverFolioVisual del frontend.
 */
export function resolverFolioVisual(
  row: { serie?: string | null; numero?: number | string | null; serie_externa?: string | null; numero_externo?: number | string | null },
  tipoDocumento: string | null | undefined,
): string {
  const serieExterna = String(row.serie_externa ?? '').trim();
  // Un número 0 cuenta como no capturado (algunas consultas hacen COALESCE(numero_externo, 0)).
  const tieneExterno = Number(row.numero_externo ?? 0) > 0;
  if (TIPOS_CON_FOLIO_EXTERNO.has(String(tipoDocumento ?? '').toLowerCase()) && (tieneExterno || serieExterna)) {
    return formatearFolioDocumento(serieExterna, Number(row.numero_externo ?? 0));
  }
  return formatearFolioDocumento(row.serie ?? '', Number(row.numero ?? 0));
}
