import pool from '../../config/database';
import type { PoolClient } from 'pg';

type QueryExecutor = Pick<PoolClient, 'query'>;

export type ConfiguracionEspecificaciones = {
  empresa_habilitada: boolean;
  tipo_documento_activo: boolean | null;
  tipo_documento_habilitado: boolean | null;
  habilitado: boolean;
};

const esBooleanoVerdadero = (value: unknown) => ['1', 'true', 't', 'yes', 'si', 'sí', 'on'].includes(String(value ?? '').trim().toLowerCase());

export async function obtenerConfiguracionEspecificaciones(
  empresaId: number,
  tipoDocumento?: string | null,
  executor: QueryExecutor = pool,
): Promise<ConfiguracionEspecificaciones> {
  const { rows: parametroRows } = await executor.query(
    `SELECT COALESCE(pe.valor, p.valor_default, 'false') AS valor
       FROM core.parametros p
  LEFT JOIN core.parametros_empresa pe
         ON pe.parametro_id = p.parametro_id
        AND pe.empresa_id = $1
      WHERE p.clave = 'usar_especificaciones_productos'
      LIMIT 1`,
    [empresaId],
  );
  const empresaHabilitada = esBooleanoVerdadero(parametroRows[0]?.valor);

  if (!tipoDocumento) {
    return {
      empresa_habilitada: empresaHabilitada,
      tipo_documento_activo: null,
      tipo_documento_habilitado: null,
      habilitado: empresaHabilitada,
    };
  }

  const { rows: tipoRows } = await executor.query(
    `SELECT td.activo AS catalogo_activo,
            COALESCE(etd.activo, false) AS empresa_tipo_activo,
            COALESCE(etd.usar_especificaciones, false) AS usar_especificaciones
       FROM core.tipos_documento td
  LEFT JOIN core.empresas_tipos_documento etd
         ON etd.tipo_documento_id = td.id
        AND etd.empresa_id = $1
      WHERE td.codigo = $2
      LIMIT 1`,
    [empresaId, tipoDocumento],
  );
  const tipo = tipoRows[0];
  const tipoActivo = Boolean(tipo?.catalogo_activo && tipo?.empresa_tipo_activo);
  const tipoHabilitado = Boolean(tipo?.usar_especificaciones);

  return {
    empresa_habilitada: empresaHabilitada,
    tipo_documento_activo: tipoActivo,
    tipo_documento_habilitado: tipoHabilitado,
    habilitado: empresaHabilitada && tipoActivo && tipoHabilitado,
  };
}

export async function exigirEspecificacionesEmpresaHabilitadas(empresaId: number): Promise<void> {
  const configuracion = await obtenerConfiguracionEspecificaciones(empresaId);
  if (!configuracion.habilitado) {
    throw new Error('VALIDATION_ERROR: La biblioteca de especificaciones no está habilitada para la empresa');
  }
}
