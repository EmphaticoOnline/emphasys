export function resolverFolioVisual(
  row: {
    serie?: string | null;
    numero?: number | null;
    serie_externa?: string | null;
    numero_externo?: number | null;
  },
  tipoDocumento: string,
): string {
  const esCompra = tipoDocumento === 'factura_compra' || tipoDocumento === 'nota_credito_compra';
  if (esCompra && (row.serie_externa != null || row.numero_externo != null)) {
    return formatearFolioDocumento(row.serie_externa ?? '', row.numero_externo ?? 0);
  }
  return formatearFolioDocumento(row.serie ?? '', row.numero ?? 0);
}

export function formatearFolioDocumento(serie: string, numero: number): string {
  const serieLimpia = (serie ?? "").trim();

  const ancho = Math.abs(numero) < 1000 ? 3 : 6;
  const numeroConSigno = numero < 0 ? "-" : "";
  const numeroFormateado = `${numeroConSigno}${Math.abs(numero)
    .toString()
    .padStart(ancho, "0")}`;

  if (!serieLimpia) {
    return numeroFormateado;
  }

  return `${serieLimpia}-${numeroFormateado}`;
}

/** El listado de relacionados trae serie y folio sin ceros. El número se recupera de ese folio y se formatea con resolverFolioVisual. */
export function folioVisualDesdeSerieYFolio(
  serie: string | null | undefined,
  folio: string | null | undefined,
  tipoDocumento: string,
): string {
  const serieLimpia = String(serie ?? '').trim();
  const crudo = String(folio ?? '').trim();
  let numeroTexto = crudo;
  if (serieLimpia && (crudo === serieLimpia || crudo.startsWith(`${serieLimpia}-`))) {
    numeroTexto = crudo.slice(serieLimpia.length).replace(/^-/, '');
  } else if (crudo.startsWith('-')) {
    numeroTexto = crudo.slice(1);
  }
  if (!/^\d+$/.test(numeroTexto)) return crudo;
  return resolverFolioVisual({ serie: serieLimpia, numero: Number(numeroTexto) }, tipoDocumento);
}
