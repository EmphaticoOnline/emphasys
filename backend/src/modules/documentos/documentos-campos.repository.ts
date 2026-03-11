import pool from '../../config/database';
import type { TipoDatoCampo } from '../campos-configuracion/campos-configuracion.repository';

export type ValorCampoPayload = {
  campo_id: number;
  catalogo_id?: number | null;
  valor_texto?: string | null;
  valor_numero?: number | null;
  valor_fecha?: string | null;
  valor_boolean?: boolean | null;
};

type CampoInfo = {
  id: number;
  tipo_dato: TipoDatoCampo;
  catalogo_tipo_id: number | null;
  permite_multiple: boolean | null;
};

type ValorCampoGuardado = {
  campo_id: number;
  catalogo_id: number | null;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_fecha: string | null;
  valor_boolean: boolean | null;
};

function normalizarValorPorTipo(campo: CampoInfo, valor: ValorCampoPayload) {
  const { tipo_dato } = campo;

  if (tipo_dato === 'lista') {
    return {
      catalogo_id: valor.catalogo_id ?? null,
      valor_texto: null,
      valor_numero: null,
      valor_fecha: null,
      valor_boolean: null,
    };
  }

  if (tipo_dato === 'numero') {
    const numero = valor.valor_numero ?? (typeof valor.valor_texto === 'number' ? valor.valor_texto : null);
    return {
      catalogo_id: null,
      valor_texto: null,
      valor_numero: numero,
      valor_fecha: null,
      valor_boolean: null,
    };
  }

  if (tipo_dato === 'fecha') {
    return {
      catalogo_id: null,
      valor_texto: null,
      valor_numero: null,
      valor_fecha: valor.valor_fecha ?? null,
      valor_boolean: null,
    };
  }

  if (tipo_dato === 'booleano') {
    const boolValue = valor.valor_boolean ?? null;
    return {
      catalogo_id: null,
      valor_texto: null,
      valor_numero: null,
      valor_fecha: null,
      valor_boolean: boolValue,
    };
  }

  // texto por defecto
  return {
    catalogo_id: null,
    valor_texto: valor.valor_texto ?? (valor.valor_numero !== undefined ? String(valor.valor_numero) : null),
    valor_numero: null,
    valor_fecha: null,
    valor_boolean: null,
  };
}

async function obtenerCamposValidos(empresaId: number, campoIds: number[]): Promise<Map<number, CampoInfo>> {
  if (!campoIds.length) return new Map();
  const { rows } = await pool.query<CampoInfo>(
    `SELECT
       cc.id,
       cc.tipo_dato,
       cc.catalogo_tipo_id,
       ct.permite_multiple
     FROM core.campos_configuracion cc
     LEFT JOIN core.catalogos_tipos ct ON ct.id = cc.catalogo_tipo_id
     WHERE cc.empresa_id = $1 AND cc.id = ANY($2::int[])`,
    [empresaId, campoIds]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function guardarValoresGenerico(
  tablaDestino: 'public.documentos_campos' | 'public.documentos_partidas_campos',
  empresaId: number,
  ownerId: number,
  valores: ValorCampoPayload[],
  ownerColumn: 'documento_id' | 'partida_id'
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const campoIds = valores.map((v) => v.campo_id).filter((id) => Number.isFinite(id));
    const camposValidos = await obtenerCamposValidos(empresaId, campoIds);

    if (campoIds.length && camposValidos.size === 0) {
      throw new Error('Los campos indicados no pertenecen a la empresa o no existen');
    }

    const insertSql = `
      INSERT INTO ${tablaDestino} (
        empresa_id,
        ${ownerColumn},
        campo_id,
        catalogo_id,
        valor_texto,
        valor_numero,
        valor_fecha,
        valor_boolean
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const upsertSql = `
      INSERT INTO ${tablaDestino} (
        empresa_id,
        ${ownerColumn},
        campo_id,
        catalogo_id,
        valor_texto,
        valor_numero,
        valor_fecha,
        valor_boolean
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (empresa_id, ${ownerColumn}, campo_id)
      DO UPDATE SET
        catalogo_id = EXCLUDED.catalogo_id,
        valor_texto = EXCLUDED.valor_texto,
        valor_numero = EXCLUDED.valor_numero,
        valor_fecha = EXCLUDED.valor_fecha,
        valor_boolean = EXCLUDED.valor_boolean
    `;

    const singlesMap = new Map<number, ValorCampoPayload>();
    const multiples: { valor: ValorCampoPayload; campo: CampoInfo }[] = [];

    // Dedupe por campo en payload y separa singles/múltiples
    for (const valor of valores) {
      const campo = camposValidos.get(valor.campo_id);
      if (!campo) continue;
      if (campo.permite_multiple) {
        multiples.push({ valor, campo });
      } else {
        singlesMap.set(valor.campo_id, valor); // último gana
      }
    }

    // Validación de duplicados en payload para campos múltiples tipo lista
    const payloadCatalogoDuplicado: number[] = [];
    const payloadCatalogoSet = new Map<number, Set<number>>();
    multiples.forEach(({ valor, campo }) => {
      if (campo.tipo_dato !== 'lista') return;
      const catId = valor.catalogo_id ?? null;
      if (catId === null) return;
      const set = payloadCatalogoSet.get(campo.id) ?? new Set<number>();
      if (set.has(catId)) {
        payloadCatalogoDuplicado.push(campo.id);
      } else {
        set.add(catId);
        payloadCatalogoSet.set(campo.id, set);
      }
    });
    if (payloadCatalogoDuplicado.length) {
      throw new Error('No se permiten valores duplicados de catálogo en el mismo campo múltiple');
    }

    // Construye set de catálogos ya existentes para campos múltiples tipo lista
    const camposMultiplesLista = Array.from(camposValidos.values())
      .filter((c) => c.permite_multiple && c.tipo_dato === 'lista')
      .map((c) => c.id);

    const existentesCatalogoPorCampo = new Map<number, Set<number>>();
    if (camposMultiplesLista.length) {
      const { rows: existentes } = await client.query<{ campo_id: number; catalogo_id: number | null }>(
        `SELECT campo_id, catalogo_id
         FROM ${tablaDestino}
         WHERE empresa_id = $1 AND ${ownerColumn} = $2 AND campo_id = ANY($3::int[]) AND catalogo_id IS NOT NULL`,
        [empresaId, ownerId, camposMultiplesLista]
      );
      existentes.forEach((row) => {
        if (row.catalogo_id === null) return;
        const set = existentesCatalogoPorCampo.get(row.campo_id) ?? new Set<number>();
        set.add(row.catalogo_id);
        existentesCatalogoPorCampo.set(row.campo_id, set);
      });
    }

    // Inserta/Upserta singles
    for (const valor of singlesMap.values()) {
      const campo = camposValidos.get(valor.campo_id);
      if (!campo) continue;
      const normalizados = normalizarValorPorTipo(campo, valor);
      const params = [
        empresaId,
        ownerId,
        valor.campo_id,
        normalizados.catalogo_id,
        normalizados.valor_texto,
        normalizados.valor_numero,
        normalizados.valor_fecha,
        normalizados.valor_boolean,
      ];
      await client.query(upsertSql, params);
    }

    // Inserta múltiples evitando duplicados con existentes
    for (const { valor, campo } of multiples) {
      const normalizados = normalizarValorPorTipo(campo, valor);

      if (campo.tipo_dato === 'lista') {
        const catId = normalizados.catalogo_id;
        if (catId !== null) {
          const existentes = existentesCatalogoPorCampo.get(campo.id) ?? new Set<number>();
          if (existentes.has(catId)) {
            throw new Error('El valor de catálogo ya está registrado para este campo');
          }
          existentes.add(catId);
          existentesCatalogoPorCampo.set(campo.id, existentes);
        }
      }

      const params = [
        empresaId,
        ownerId,
        valor.campo_id,
        normalizados.catalogo_id,
        normalizados.valor_texto,
        normalizados.valor_numero,
        normalizados.valor_fecha,
        normalizados.valor_boolean,
      ];
      await client.query(insertSql, params);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function guardarCamposDocumentoRepository(
  empresaId: number,
  documentoId: number,
  valores: ValorCampoPayload[]
) {
  await guardarValoresGenerico('public.documentos_campos', empresaId, documentoId, valores, 'documento_id');
}

export async function guardarCamposPartidaRepository(
  empresaId: number,
  partidaId: number,
  valores: ValorCampoPayload[]
) {
  await guardarValoresGenerico('public.documentos_partidas_campos', empresaId, partidaId, valores, 'partida_id');
}

async function documentoPerteneceAEmpresa(empresaId: number, documentoId: number) {
  const { rows } = await pool.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = $1 AND d.empresa_id = $2) AS exists',
    [documentoId, empresaId]
  );
  return rows[0]?.exists ?? false;
}

async function partidaPerteneceAEmpresa(empresaId: number, partidaId: number) {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
        SELECT 1
        FROM public.documentos_partidas p
        JOIN public.documentos d ON d.id = p.documento_id
        WHERE p.id = $1 AND d.empresa_id = $2
      ) AS exists`,
    [partidaId, empresaId]
  );
  return rows[0]?.exists ?? false;
}

export async function obtenerCamposDocumentoRepository(
  empresaId: number,
  documentoId: number
): Promise<ValorCampoGuardado[] | null> {
  const pertenece = await documentoPerteneceAEmpresa(empresaId, documentoId);
  if (!pertenece) return null;

  const { rows } = await pool.query<ValorCampoGuardado>(
    `SELECT campo_id, catalogo_id, valor_texto, valor_numero, valor_fecha, valor_boolean
     FROM public.documentos_campos
     WHERE empresa_id = $1 AND documento_id = $2
     ORDER BY campo_id`,
    [empresaId, documentoId]
  );

  return rows;
}

export async function obtenerCamposPartidaRepository(
  empresaId: number,
  partidaId: number
): Promise<ValorCampoGuardado[] | null> {
  const pertenece = await partidaPerteneceAEmpresa(empresaId, partidaId);
  if (!pertenece) return null;

  const { rows } = await pool.query<ValorCampoGuardado>(
    `SELECT campo_id, catalogo_id, valor_texto, valor_numero, valor_fecha, valor_boolean
     FROM public.documentos_partidas_campos
     WHERE empresa_id = $1 AND partida_id = $2
     ORDER BY campo_id`,
    [empresaId, partidaId]
  );

  return rows;
}
