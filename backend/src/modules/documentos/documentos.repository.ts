import pool from '../../config/database';
import type { TipoDocumento } from '../../types/documentos';

export type Documento = {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  subtotal: number;
  iva: number;
  total: number;
  estatus_documento: string;
  moneda: string | null;
  observaciones?: string | null;
  usuario_creacion_id?: number | null;
};

export type Partida = {
  id: number;
  documento_id: number;
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal_partida: number;
  iva_monto: number;
  total_partida: number;
  producto_descripcion?: string | null;
  producto_clave?: string | null;
  observaciones?: string | null;
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
  'subtotal',
  'iva',
  'total',
  'estatus_documento',
  'usuario_creacion_id',
] as const;

type DocumentoInput = Partial<Record<typeof CAMPOS_DOCUMENTO[number], any>> & {
  tipo_documento?: TipoDocumento;
};

type PartidaInput = {
  producto_id?: number | null;
  descripcion_alterna?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
  iva_monto?: number | null;
  total_partida?: number | null;
  observaciones?: string | null;
};

export async function listarDocumentosRepository(tipoDocumento: TipoDocumento, empresaId: number) {
  const query = `
    SELECT
      d.id,
      d.serie,
      d.numero,
      d.fecha_documento,
  d.contacto_principal_id,
  c.nombre AS nombre_cliente,
  c.email AS contacto_email,
      d.subtotal,
      d.iva,
      d.total,
      d.estatus_documento
    FROM documentos d
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
  const { rows: partidas } = await pool.query(partidasQuery, [id]);

  return { documento, partidas };
}

const SERIE_DEFAULTS: Record<TipoDocumento, string> = {
  cotizacion: 'COT',
  factura: 'FAC',
  pedido: 'PED',
  remision: 'REM',
};

export async function crearDocumentoRepository(data: DocumentoInput, empresaId: number, tipoDocumento: TipoDocumento) {
  const estatus = data.estatus_documento || 'Borrador';
  const tipoDocumentoNormalizado = (data.tipo_documento || tipoDocumento).toLowerCase() as TipoDocumento;
  const tipoDocumentoDb = tipoDocumentoNormalizado;

  // Prellenar datos fiscales del contacto en facturas si no vienen en la petición
  if (tipoDocumentoDb === 'factura' && data.contacto_principal_id) {
    try {
      const { rows: contactoRows } = await pool.query(
        `SELECT nombre FROM contactos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
        [data.contacto_principal_id, empresaId]
      );
      const nombreContacto = contactoRows[0]?.nombre || null;

      const { rows: fiscalesRows } = await pool.query(
        `SELECT rfc, regimen_fiscal, uso_cfdi, forma_pago, metodo_pago, codigo_postal
           FROM contactos_datos_fiscales
          WHERE contacto_id = $1
          LIMIT 1`,
        [data.contacto_principal_id]
      );
      const fiscales = fiscalesRows[0] || {};

      data.rfc_receptor = data.rfc_receptor ?? fiscales.rfc ?? null;
      data.nombre_receptor = data.nombre_receptor ?? nombreContacto ?? null;
      data.regimen_fiscal_receptor = data.regimen_fiscal_receptor ?? fiscales.regimen_fiscal ?? null;
      data.uso_cfdi = data.uso_cfdi ?? fiscales.uso_cfdi ?? null;
      data.forma_pago = data.forma_pago ?? fiscales.forma_pago ?? null;
      data.metodo_pago = data.metodo_pago ?? fiscales.metodo_pago ?? null;
      data.codigo_postal_receptor = data.codigo_postal_receptor ?? fiscales.codigo_postal ?? null;
    } catch (err) {
      console.warn('No se pudieron precargar datos fiscales del contacto', err);
    }
  }

  // Asigna número secuencial si no viene en la petición
  let numero = data.numero;
  if (numero === undefined || numero === null) {
    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_numero
       FROM documentos
       WHERE empresa_id = $1
         AND LOWER(tipo_documento) = LOWER($2)
         AND COALESCE(serie, '') = COALESCE($3, '')`,
      [empresaId, tipoDocumentoDb, data.serie ?? SERIE_DEFAULTS[tipoDocumentoNormalizado] ?? '']
    );
    numero = rows[0]?.next_numero ?? 1;
  }

  // Serie por defecto por tipo de documento (evita null / constraint de NOT NULL)
  const serie = data.serie ?? SERIE_DEFAULTS[tipoDocumentoNormalizado] ?? 'DOC';

  const valores: any[] = [empresaId, tipoDocumentoDb, estatus, serie, numero];

  const columnas: string[] = ['empresa_id', 'tipo_documento', 'estatus_documento', 'serie', 'numero'];
  CAMPOS_DOCUMENTO.forEach((campo) => {
    // serie y numero ya se agregaron con sus defaults
    if (campo === 'serie' || campo === 'numero' || campo === 'estatus_documento') return;
    if (data[campo] !== undefined) {
      columnas.push(campo);
      valores.push(data[campo]);
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
  const entries = CAMPOS_DOCUMENTO.filter((campo) => data[campo] !== undefined);
  const sets = entries.map((campo, idx) => `${campo} = $${idx + 1}`).join(', ');
  const valores = entries.map((campo) => data[campo]);
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

export async function agregarPartidaRepository(documentoId: number, data: PartidaInput, empresaId: number) {
  const client = await pool.connect();
  try {
    const { rowCount: docExists } = await client.query('SELECT 1 FROM documentos WHERE id = $1 AND empresa_id = $2', [documentoId, empresaId]);
    if (!docExists) return null;

    const campos: string[] = ['documento_id'];
    const valores: any[] = [documentoId];

  const camposPermitidos: Array<keyof PartidaInput> = [
    // numero_partida se maneja aparte (secuencial)
    'producto_id',
    'descripcion_alterna',
    'cantidad',
    'precio_unitario',
    'subtotal_partida',
    'iva_monto',
    'total_partida',
    'observaciones',
  ];

    camposPermitidos.forEach((campo) => {
      if (data[campo] !== undefined) {
        campos.push(campo);
        valores.push(data[campo]);
      }
    });

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
    const { rows } = await client.query(query, valores);
    return rows[0];
  } finally {
    client.release();
  }
}

export async function reemplazarPartidasRepository(documentoId: number, partidas: PartidaInput[], empresaId: number) {
  const client = await pool.connect();
  try {
    const { rowCount: docExists } = await client.query('SELECT 1 FROM documentos WHERE id = $1 AND empresa_id = $2', [documentoId, empresaId]);
    if (!docExists) {
      return null;
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM documentos_partidas WHERE documento_id = $1', [documentoId]);

    const insertQuery = `
      INSERT INTO documentos_partidas (
        documento_id,
        numero_partida,
        producto_id,
        descripcion_alterna,
        cantidad,
        precio_unitario,
        subtotal_partida,
        iva_monto,
        total_partida,
        observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const inserted: any[] = [];
    partidas.forEach((partida, idx) => {
      const values = [
        documentoId,
        idx + 1, // numero_partida secuencial por documento
        partida.producto_id ?? null,
        partida.descripcion_alterna ?? null,
        partida.cantidad ?? 0,
        partida.precio_unitario ?? 0,
        partida.subtotal_partida ?? 0,
        partida.iva_monto ?? 0,
        partida.total_partida ?? 0,
        partida.observaciones ?? null,
      ];
      inserted.push(client.query(insertQuery, values).then((r) => r.rows[0]));
    });

    for (const p of inserted) {
      await p;
    }

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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
