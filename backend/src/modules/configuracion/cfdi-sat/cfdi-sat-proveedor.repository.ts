import pool from '../../../config/database';
import type { PoolClient } from 'pg';

export interface ContactoCandidato {
  id: number;
  nombre: string;
  tipo_contacto: string;
}

/**
 * Busca contactos por RFC (prioriza contactos_datos_fiscales.rfc sobre contactos.rfc,
 * igual que el resto del proyecto, ej. documentos.repository.ts). No existe unicidad de
 * RFC por empresa (ver 20260609_quitar_unicidad_rfc.sql), así que puede haber 0, 1 o
 * varios resultados: la política de negocio (bloquear si no hay exactamente uno) se
 * aplica en el llamador.
 */
export async function buscarContactosPorRfc(
  empresaId: number,
  rfc: string,
  executor: Pick<PoolClient, 'query'> = pool
): Promise<ContactoCandidato[]> {
  const { rows } = await executor.query<ContactoCandidato>(
    `SELECT c.id, c.nombre, c.tipo_contacto::text AS tipo_contacto
       FROM contactos c
       LEFT JOIN contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
      WHERE c.empresa_id = $1
        AND UPPER(COALESCE(cdf.rfc, c.rfc, '')) = UPPER($2)`,
    [empresaId, rfc]
  );

  return rows;
}
