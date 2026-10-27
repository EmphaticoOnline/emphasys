export function resolverFolioVisual(
  row: {
    serie?: string | null | undefined;
    numero?: number | null | undefined;
    serie_externa?: string | null | undefined;
    numero_externo?: number | null | undefined;
  },
  tipoDocumento: string,
): string {
  const tipo = String(tipoDocumento ?? '').toLowerCase();
  const esCompra = tipo === 'factura_compra' || tipo === 'nota_credito_compra';
  // Folio del proveedor sólo si realmente se capturó; si no, el folio interno.
  // Un número 0 cuenta como no capturado.
  const tieneExterno = Number(row.numero_externo ?? 0) > 0 || Boolean(String(row.serie_externa ?? '').trim());
  if (esCompra && tieneExterno) {
    return formatearFolioDocumento(row.serie_externa ?? '', row.numero_externo ?? 0);
  }
  return formatearFolioDocumento(row.serie ?? '', row.numero ?? 0);
}

/**
 * Folio visible de cualquier documento (propio o contraparte). Toma el tipo de
 * la fila (`tipo_documento` o `tipo`) salvo que se indique; en compras usa el
 * folio del proveedor con fallback al interno.
 */
export function folioDocumento(
  row: {
    serie?: string | null | undefined;
    numero?: number | null | undefined;
    serie_externa?: string | null | undefined;
    numero_externo?: number | null | undefined;
    tipo_documento?: string | null | undefined;
    tipo?: string | null | undefined;
  },
  tipoDocumento?: string | null,
): string {
  return resolverFolioVisual(row, tipoDocumento ?? row.tipo_documento ?? row.tipo ?? '');
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
