import type { CotizacionPartida, ImpuestoPartida } from '../types/cotizacion';

export type DocumentTaxLine = {
  id: string;
  nombre: string;
  tipo: string;
  monto: number;
};

export type DocumentTaxSummary = {
  traslados: number;
  retenciones: number;
  otros: number;
  lineas: DocumentTaxLine[];
};

export function summarizeDocumentTaxes(partidas: CotizacionPartida[] | null | undefined): DocumentTaxSummary {
  const agrupados = new Map<string, DocumentTaxLine>();

  for (const partida of partidas ?? []) {
    for (const impuesto of partida.impuestos ?? []) {
      const tipo = String(impuesto.tipo ?? 'otro').toLowerCase();
      const id = impuesto.impuesto_id || impuesto.nombre || tipo;
      const key = `${tipo}:${id}`;
      const actual = agrupados.get(key);
      agrupados.set(key, {
        id,
        nombre: impuesto.nombre || impuesto.impuesto_id || 'Impuesto',
        tipo,
        monto: (actual?.monto ?? 0) + Number(impuesto.monto ?? 0),
      });
    }
  }

  const lineas = Array.from(agrupados.values());
  return lineas.reduce<DocumentTaxSummary>((resumen, linea) => {
    if (linea.tipo === 'traslado') resumen.traslados += linea.monto;
    else if (linea.tipo === 'retencion') resumen.retenciones += linea.monto;
    else resumen.otros += linea.monto;
    return resumen;
  }, { traslados: 0, retenciones: 0, otros: 0, lineas });
}

export function isIvaTax(impuesto: Pick<ImpuestoPartida, 'impuesto_id' | 'nombre'>): boolean {
  return `${impuesto.impuesto_id} ${impuesto.nombre ?? ''}`.toLowerCase().includes('iva');
}
