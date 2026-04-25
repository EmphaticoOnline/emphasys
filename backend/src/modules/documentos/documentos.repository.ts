import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import type { TratamientoImpuestos } from '../impuestos/impuestos.types';

export type Documento = {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  agente_id?: number | null;
  subtotal: number;
  iva: number;
  total: number;
  estatus_documento: string;
  moneda: string | null;
  observaciones?: string | null;
  usuario_creacion_id?: number | null;
  producto_resumen?: string | null;
  estado_seguimiento?: string | null;
  comentario_seguimiento?: string | null;
};

export type Partida = {
  id: number;
  documento_id: number;
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal_partida: number;
  total_partida: number;
  archivo_imagen_1?: string | null;
  producto_descripcion?: string | null;
  producto_clave?: string | null;
  observaciones?: string | null;
  impuestos?: Array<{
    impuesto_id: string;
    nombre?: string | null;
    tipo?: string | null;
    tasa: number;
    base?: number | null;
    monto: number;
  }>;
};

const CAMPOS_DOCUMENTO = [
  'serie',
  'numero',
  'fecha_documento',
  'contacto_principal_id',
  'rfc_receptor',
  'nombre_receptor',
  'regimen_fiscal_receptor',
  'uso_cfdi',
  'forma_pago',
  'metodo_pago',
  'codigo_postal_receptor',
  'moneda',
  'observaciones',
  'producto_resumen',
  'estado_seguimiento',
  'comentario_seguimiento',
  'subtotal',
  'iva',
  'total',
  'agente_id',
  'estatus_documento',
  'usuario_creacion_id',
  'tratamiento_impuestos',
] as const;

const SEGUIMIENTO_CAMPOS = ['producto_resumen', 'estado_seguimiento', 'comentario_seguimiento'] as const;

let seguimientoColumnsPresent: boolean | null = null;

async function ensureSeguimientoColumns(client?: PoolClient) {
  if (seguimientoColumnsPresent !== null) return seguimientoColumnsPresent;
  const executor = client ?? (await pool.connect());
  try {
    const { rows } = await executor.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'documentos'
          AND column_name = ANY($1::text[])`,
      [SEGUIMIENTO_CAMPOS]
    );
    seguimientoColumnsPresent = rows.length === SEGUIMIENTO_CAMPOS.length;
    return seguimientoColumnsPresent;
  } catch (err) {
    console.warn('[DOCUMENTOS] No se pudo verificar columnas de seguimiento, se asume ausentes', err);
    seguimientoColumnsPresent = false;
    return false;
  } finally {
    if (!client) executor.release();
  }
}

type DocumentoInput = Omit<Partial<Record<typeof CAMPOS_DOCUMENTO[number], any>>, 'tratamiento_impuestos'> & {
  tipo_documento?: TipoDocumento;
  tratamiento_impuestos?: TratamientoImpuestos;
};

export type PartidaInput = {
  producto_id?: number | null;
  descripcion_alterna?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
  total_partida?: number | null;
  archivo_imagen_1?: string | null;
  observaciones?: string | null;
};

export async function listarDocumentosRepository(tipoDocumento: TipoDocumento, empresaId: number) {
  const esFactura = ['factura', 'factura_compra'].includes((tipoDocumento || '').toLowerCase());
  const selectSaldo = esFactura ? 'COALESCE(ds.saldo, 0) AS saldo' : 'NULL::numeric AS saldo';
  const joinSaldo = esFactura ? 'LEFT JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id' : '';
  const hasSeguimiento = await ensureSeguimientoColumns();

  const selectSeguimiento = hasSeguimiento
    ? `d.producto_resumen,
       d.estado_seguimiento,
       d.comentario_seguimiento,`
    : `NULL::text AS producto_resumen,
       NULL::text AS estado_seguimiento,
       NULL::text AS comentario_seguimiento,`;

  const query = `
    SELECT
      d.id,
      d.serie,
      d.numero,
      d.fecha_documento,
      d.contacto_principal_id,
      d.agente_id,
      c.nombre AS nombre_cliente,
      c.email AS contacto_email,
      ${selectSeguimiento}
      d.subtotal,
      d.iva,
      d.total,
      d.estatus_documento,
      ${selectSaldo}
    FROM documentos d
    ${joinSaldo}
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    WHERE d.empresa_id = $1 AND LOWER(d.tipo_documento) = $2
    ORDER BY d.fecha_documento DESC, d.id DESC
  `;
  const { rows } = await pool.query(query, [empresaId, tipoDocumento.toLowerCase()]);
  return rows;
}

export async function obtenerDocumentoRepository(id: number, empresaId: number, tipoDocumento?: TipoDocumento) {
  const docQuery = `
    SELECT
      d.*,
      c.nombre AS cliente_nombre,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      TRIM(CONCAT_WS(' ', cd.calle, cd.numero_exterior, cd.numero_interior, cd.colonia, cd.ciudad, cd.estado, cd.cp, cd.pais)) AS cliente_direccion,
      d.rfc_receptor AS cliente_rfc,
      d.regimen_fiscal_receptor,
      d.uso_cfdi,
      d.forma_pago,
      d.metodo_pago,
      d.codigo_postal_receptor
    FROM documentos d
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    LEFT JOIN contactos_domicilios cd ON cd.contacto_id = c.id AND cd.es_principal = true
    WHERE d.empresa_id = $1 AND d.id = $2
      ${tipoDocumento ? 'AND LOWER(d.tipo_documento) = LOWER($3)' : ''}
    LIMIT 1
  `;
  const params = tipoDocumento ? [empresaId, id, tipoDocumento] : [empresaId, id];
  console.log('[BACK SQL DEBUG] obtenerDocumento docQuery', docQuery);
  console.log('[BACK SQL DEBUG] obtenerDocumento params', params);
  const { rows: docRows } = await pool.query(docQuery, params);
  const documento = docRows[0];
  if (!documento) return null;

  const partidasQuery = `
    SELECT dp.*, p.descripcion AS producto_descripcion, p.clave AS producto_clave
    FROM documentos_partidas dp
    LEFT JOIN productos p ON dp.producto_id = p.id
    WHERE dp.documento_id = $1
    ORDER BY dp.id
  `;
  console.log('[BACK SQL DEBUG] obtenerDocumento partidasQuery', partidasQuery);
  console.log('[BACK SQL DEBUG] obtenerDocumento partidas params', [id]);
  const { rows: partidas } = await pool.query(partidasQuery, [id]);

  console.log('[BACK IVA DEBUG] obtenerDocumentoRepository partidas raw', partidas.map((p) => ({
    id: p.id,
    producto_id: p.producto_id,
    subtotal_partida: p.subtotal_partida,
    total_partida: p.total_partida,
  })));

  // Obtener impuestos por partida y adjuntarlos sin duplicar filas
  if (partidas.length > 0) {
    const partidaIds = partidas.map((p) => p.id);
    const impuestosQuery = `
      SELECT dpi.partida_id,
             dpi.impuesto_id,
             dpi.tasa,
             dpi.base,
             dpi.monto,
             i.nombre,
             i.tipo
        FROM documentos_partidas_impuestos dpi
        LEFT JOIN impuestos i ON i.id::text = dpi.impuesto_id
       WHERE dpi.partida_id = ANY($1::int[])
       ORDER BY dpi.partida_id, dpi.id
    `;
    console.log('[BACK SQL DEBUG] obtenerDocumento impuestosQuery', impuestosQuery);
    console.log('[BACK SQL DEBUG] obtenerDocumento impuestos params', [partidaIds]);
    const { rows: impuestosRows } = await pool.query(impuestosQuery, [partidaIds]);
  console.log('[BACK IVA DEBUG] obtenerDocumentoRepository impuestosRows', impuestosRows);
    const impuestosPorPartida = impuestosRows.reduce<Record<number, any[]>>((acc, row) => {
      if (!acc[row.partida_id]) acc[row.partida_id] = [];
      acc[row.partida_id].push({
        impuesto_id: row.impuesto_id,
        nombre: row.nombre,
        tipo: row.tipo,
        tasa: Number(row.tasa),
        base: row.base,
        monto: Number(row.monto),
      });
      return acc;
    }, {});

    partidas.forEach((p: any) => {
      p.impuestos = impuestosPorPartida[p.id] ?? [];
    });

    console.log('[BACK IVA DEBUG] obtenerDocumentoRepository partidas con impuestos', partidas.map((p: any) => ({
      id: p.id,
      producto_id: p.producto_id,
      impuestos: p.impuestos,
    })));
  }

  return { documento, partidas };
}

const SERIE_DEFAULTS: Record<TipoDocumento, string> = {
  cotizacion: 'COT',
  factura: 'FAC',
  pedido: 'PED',
  remision: 'REM',
  orden_entrega: 'ODE',
  requisicion: 'REQ',
  orden_compra: 'OC',
  recepcion: 'REC',
  factura_compra: 'FCO',
};

export async function crearDocumentoRepository(data: DocumentoInput, empresaId: number, tipoDocumento: TipoDocumento) {
  const dataConDefaults: DocumentoInput = {
    estado_seguimiento: data.estado_seguimiento ?? 'cotizado',
    ...data,
  };

  const estatus = dataConDefaults.estatus_documento || 'Borrador';
  const tipoDocumentoNormalizado = (dataConDefaults.tipo_documento || tipoDocumento).toLowerCase() as TipoDocumento;
  const tipoDocumentoDb = tipoDocumentoNormalizado;

  if (dataConDefaults.tratamiento_impuestos === undefined || dataConDefaults.tratamiento_impuestos === null) {
    throw new Error('VALIDATION_ERROR: El tratamiento de impuestos es obligatorio');
  }

  // Prellenar datos fiscales del contacto en facturas si no vienen en la petición
  if (tipoDocumentoDb === 'factura' && dataConDefaults.contacto_principal_id) {
    try {
      const { rows: contactoRows } = await pool.query(
        `SELECT nombre FROM contactos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
        [dataConDefaults.contacto_principal_id, empresaId]
      );
      const nombreContacto = contactoRows[0]?.nombre || null;

      const { rows: fiscalesRows } = await pool.query(
        `SELECT rfc, regimen_fiscal, uso_cfdi, forma_pago, metodo_pago
           FROM contactos_datos_fiscales
          WHERE contacto_id = $1
          LIMIT 1`,
        [dataConDefaults.contacto_principal_id]
      );
      const fiscales = fiscalesRows[0] || {};

      // CP fiscal ahora proviene del domicilio principal (cp_sat)
      const { rows: domicilioRows } = await pool.query(
        `SELECT cp_sat
           FROM contactos_domicilios
          WHERE contacto_id = $1
            AND es_principal = true
          LIMIT 1`,
        [dataConDefaults.contacto_principal_id]
      );
      const cpSat = domicilioRows[0]?.cp_sat ?? null;

      dataConDefaults.rfc_receptor = dataConDefaults.rfc_receptor ?? fiscales.rfc ?? null;
      dataConDefaults.nombre_receptor = dataConDefaults.nombre_receptor ?? nombreContacto ?? null;
      dataConDefaults.regimen_fiscal_receptor = dataConDefaults.regimen_fiscal_receptor ?? fiscales.regimen_fiscal ?? null;
      dataConDefaults.uso_cfdi = dataConDefaults.uso_cfdi ?? fiscales.uso_cfdi ?? null;
      dataConDefaults.forma_pago = dataConDefaults.forma_pago ?? fiscales.forma_pago ?? null;
      dataConDefaults.metodo_pago = dataConDefaults.metodo_pago ?? fiscales.metodo_pago ?? null;
      dataConDefaults.codigo_postal_receptor = dataConDefaults.codigo_postal_receptor ?? cpSat ?? null;
    } catch (err) {
      console.warn('No se pudieron precargar datos fiscales del contacto', err);
    }
  }

  // Asigna número secuencial si no viene en la petición
  let numero = dataConDefaults.numero;
  if (numero === undefined || numero === null) {
    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_numero
       FROM documentos
       WHERE empresa_id = $1
         AND LOWER(tipo_documento) = LOWER($2)
         AND COALESCE(serie, '') = COALESCE($3, '')`,
      [empresaId, tipoDocumentoDb, dataConDefaults.serie ?? SERIE_DEFAULTS[tipoDocumentoNormalizado] ?? '']
    );
    numero = rows[0]?.next_numero ?? 1;
  }

  // Serie por defecto por tipo de documento (evita null / constraint de NOT NULL)
  const serie = dataConDefaults.serie ?? SERIE_DEFAULTS[tipoDocumentoNormalizado] ?? 'DOC';

  const valores: any[] = [empresaId, tipoDocumentoDb, estatus, serie, numero];

  const columnas: string[] = ['empresa_id', 'tipo_documento', 'estatus_documento', 'serie', 'numero'];
  const hasSeguimiento = await ensureSeguimientoColumns();

  CAMPOS_DOCUMENTO.forEach((campo) => {
    // serie y numero ya se agregaron con sus defaults
    if (campo === 'serie' || campo === 'numero' || campo === 'estatus_documento') return;
    if (!hasSeguimiento && (SEGUIMIENTO_CAMPOS as readonly string[]).includes(campo)) return;
    if (dataConDefaults[campo] !== undefined) {
      columnas.push(campo);
      valores.push(dataConDefaults[campo]);
    }
  });

  const params = valores.map((_, idx) => `$${idx + 1}`).join(', ');
  const query = `INSERT INTO documentos (${columnas.join(', ')}) VALUES (${params}) RETURNING *`;

  // Validar duplicado serie + número + tipo + empresa
  const { rowCount: dupCount } = await pool.query(
    `SELECT 1 FROM documentos
     WHERE empresa_id = $1
       AND LOWER(tipo_documento) = LOWER($2)
       AND COALESCE(serie,'') = COALESCE($3,'')
       AND numero = $4
     LIMIT 1`,
    [empresaId, tipoDocumentoDb, serie, numero]
  );
  if ((dupCount ?? 0) > 0) {
    const err: any = new Error(`Ya existe un documento con la serie ${serie ?? ''} y número ${numero}.`);
    err.code = 'DOCUMENTO_DUPLICADO';
    throw err;
  }

  const { rows } = await pool.query(query, valores);
  return rows[0];
}

export async function actualizarDocumentoRepository(
  id: number,
  data: DocumentoInput,
  empresaId: number,
  tipoDocumento?: TipoDocumento
) {
  if (
    Object.prototype.hasOwnProperty.call(data, 'tratamiento_impuestos')
    && (data.tratamiento_impuestos === undefined || data.tratamiento_impuestos === null)
  ) {
    throw new Error('VALIDATION_ERROR: El tratamiento de impuestos es obligatorio');
  }
  const hasSeguimiento = await ensureSeguimientoColumns();

  // Traer valores actuales para comparar serie/número
  const { rows: currentRows } = await pool.query(
    `SELECT id, serie, numero, tipo_documento
       FROM documentos
      WHERE id = $1 AND empresa_id = $2 ${tipoDocumento ? 'AND LOWER(tipo_documento) = LOWER($3)' : ''}
      LIMIT 1`,
    tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]
  );
  const current = currentRows[0];
  if (!current) return null;

  const dataToUpdate: DocumentoInput = { ...data };
  const serieActual = current.serie ?? null;
  const serieNueva = dataToUpdate.serie ?? serieActual;
  const tipoDestino = (dataToUpdate.tipo_documento ?? current.tipo_documento) as TipoDocumento;

  // Si cambió la serie, reasignar número secuencial para esa serie
  if (serieNueva !== serieActual) {
    const { rows: nextRows } = await pool.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_numero
         FROM documentos
        WHERE empresa_id = $1
          AND LOWER(tipo_documento) = LOWER($2)
          AND COALESCE(serie, '') = COALESCE($3, '')`,
      [empresaId, tipoDestino, serieNueva ?? '']
    );
    dataToUpdate.numero = nextRows[0]?.next_numero ?? 1;
  }

  const entries = CAMPOS_DOCUMENTO.filter((campo) => {
    if (!hasSeguimiento && (SEGUIMIENTO_CAMPOS as readonly string[]).includes(campo)) return false;
    return dataToUpdate[campo] !== undefined;
  });
  const sets = entries.map((campo, idx) => `${campo} = $${idx + 1}`).join(', ');
  const valores = entries.map((campo) => dataToUpdate[campo]);
  if (!sets) {
    const query = `SELECT * FROM documentos WHERE id = $1 AND empresa_id = $2 ${tipoDocumento ? 'AND LOWER(tipo_documento) = LOWER($3)' : ''}`;
    const { rows } = await pool.query(query, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);
    return rows[0] || null;
  }

  const whereTipo = tipoDocumento ? ` AND LOWER(tipo_documento) = LOWER($${valores.length + 3})` : '';
  const query = `
    UPDATE documentos
    SET ${sets}
    WHERE id = $${valores.length + 1} AND empresa_id = $${valores.length + 2}${whereTipo}
    RETURNING *
  `;

  const params = tipoDocumento ? [...valores, id, empresaId, tipoDocumento] : [...valores, id, empresaId];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function agregarPartidaRepository(documentoId: number, data: PartidaInput, empresaId: number, client?: PoolClient) {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    const { rows: docRows } = await executor.query(
      'SELECT tipo_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1',
      [documentoId, empresaId]
    );
    const docRow = docRows[0];
    if (!docRow) return null;
    const permiteImagen = String(docRow.tipo_documento ?? '').toLowerCase() === 'cotizacion';

    const campos: string[] = ['documento_id'];
    const valores: any[] = [documentoId];

    const camposPermitidos: Array<keyof PartidaInput> = [
      // numero_partida se maneja aparte (secuencial)
      'producto_id',
      'descripcion_alterna',
      'cantidad',
      'precio_unitario',
      'subtotal_partida',
      'total_partida',
      ...(permiteImagen ? (['archivo_imagen_1'] as Array<keyof PartidaInput>) : []),
      'observaciones',
    ];

    camposPermitidos.forEach((campo) => {
      if (data[campo] !== undefined) {    
        campos.push(campo);
        valores.push(data[campo]);
      }
    });

    // Asegurar columnas de total inicializados (el motor de impuestos recalcula después)
    if (!campos.includes('total_partida')) {
      campos.push('total_partida');
      valores.push(data.total_partida ?? data.subtotal_partida ?? 0);
    }

  // numero_partida secuencial (COUNT + 1 para ese documento)
    const nextNumeroSql = `(
      SELECT COALESCE(MAX(numero_partida), 0) + 1 FROM documentos_partidas WHERE documento_id = $1
    )`;
    campos.push('numero_partida');
    valores.push(null); // placeholder para mantener índices; lo sustituimos en query

    const params = valores.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `INSERT INTO documentos_partidas (${campos.join(', ')})
      VALUES (${params.substring(0, params.lastIndexOf(','))}, ${nextNumeroSql})
      RETURNING *`;
    const { rows } = await executor.query(query, valores);
    return rows[0];
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}

export async function reemplazarPartidasRepository(
  documentoId: number,
  partidas: PartidaInput[],
  empresaId: number,
  client?: PoolClient
) {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    const { rows: docRows } = await executor.query(
      'SELECT tipo_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1',
      [documentoId, empresaId]
    );
    const docRow = docRows[0];
    if (!docRow) {
      return null;
    }
    const permiteImagen = String(docRow.tipo_documento ?? '').toLowerCase() === 'cotizacion';

    if (ownedClient) {
      await executor.query('BEGIN');
    }
    console.log('[documentos] reemplazarPartidasRepository - delete partidas documento', documentoId);
    await executor.query('DELETE FROM documentos_partidas WHERE documento_id = $1', [documentoId]);

    const insertQuery = `
      INSERT INTO documentos_partidas (
        documento_id,
        numero_partida,
        producto_id,
        descripcion_alterna,
        cantidad,
        precio_unitario,
        subtotal_partida,
        total_partida,
        archivo_imagen_1,
        observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const insertedRows: any[] = [];
    for (const [idx, partida] of partidas.entries()) {
      const values = [
        documentoId,
        idx + 1, // numero_partida secuencial por documento
        partida.producto_id ?? null,
        partida.descripcion_alterna ?? null,
        partida.cantidad ?? 0,
        partida.precio_unitario ?? 0,
        partida.subtotal_partida ?? 0,
        partida.total_partida ?? partida.subtotal_partida ?? 0,
        permiteImagen ? partida.archivo_imagen_1 ?? null : null,
        partida.observaciones ?? null,
      ];
      console.log('[documentos] reemplazarPartidasRepository - insert partida', {
        documentoId,
        numero_partida: idx + 1,
        total_partida: values[8],
      });
      const { rows } = await executor.query(insertQuery, values);
      console.log('[documentos] partida insertada id', rows[0]?.id);
      insertedRows.push(rows[0]);
    }

    if (ownedClient) {
      await executor.query('COMMIT');
    }
    console.log('[documentos] reemplazarPartidasRepository - commit partidas', { documentoId, count: insertedRows.length });
  return insertedRows;
  } catch (error) {
    if (ownedClient) {
      await executor.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}

export async function eliminarDocumentoRepository(id: number, empresaId: number, tipoDocumento?: TipoDocumento) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deletePartidasSql = tipoDocumento
      ? 'DELETE FROM documentos_partidas dp WHERE dp.documento_id = $1 AND EXISTS (SELECT 1 FROM documentos d WHERE d.id = $1 AND d.empresa_id = $2 AND LOWER(d.tipo_documento) = LOWER($3))'
      : 'DELETE FROM documentos_partidas dp WHERE dp.documento_id = $1 AND EXISTS (SELECT 1 FROM documentos d WHERE d.id = $1 AND d.empresa_id = $2)';

    await client.query(deletePartidasSql, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);

    const deleteDocumentoSql = tipoDocumento
      ? 'DELETE FROM documentos WHERE id = $1 AND empresa_id = $2 AND LOWER(tipo_documento) = LOWER($3)'
      : 'DELETE FROM documentos WHERE id = $1 AND empresa_id = $2';

    const result = await client.query(deleteDocumentoSql, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
