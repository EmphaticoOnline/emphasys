import type { PoolClient } from 'pg';
import pool from '../../../config/database';

export interface ImpuestoCatalogoMatch {
  id: string;
  nombre: string;
  tipo: string;
  tasa: number;
}

/**
 * Busca un impuesto del catálogo interno (public.impuestos, catálogo global sin
 * empresa_id, ver impuestos.repository.ts) por tipo ('traslado'/'retencion') y
 * tasa. El catálogo puede guardar la tasa como porcentaje (16.0000) o como
 * fracción (0.1600) según cómo se haya capturado — el mismo comportamiento dual
 * que ya asume impuestos.calculador.ts (`tasaNumber > 1 ? /100 : tasaNumber`) —
 * así que se acepta cualquiera de las dos formas para no fallar por convención.
 */
export async function buscarImpuestoPorTipoYTasa(
  tipo: 'traslado' | 'retencion',
  tasaFraccion: number,
  executor: Pick<PoolClient, 'query'> = pool
): Promise<ImpuestoCatalogoMatch | null> {
  const { rows } = await executor.query<ImpuestoCatalogoMatch>(
    `SELECT id, nombre, tipo, tasa
       FROM impuestos
      WHERE activo = true
        AND lower(tipo) = lower($1)
        AND (ROUND(tasa, 4) = ROUND($2::numeric, 4) OR ROUND(tasa, 4) = ROUND($2::numeric * 100, 4))
      ORDER BY id
      LIMIT 1`,
    [tipo, tasaFraccion]
  );

  return rows[0] ?? null;
}
