import { Client, PoolClient } from 'pg';

const EMPRESA_DICOR_ID = 9;
const SISTEMA_ORIGEN = 'DICOR';
const TIPO_ENTIDAD = 'producto';
const IVA_ID = 'iva_16';
const SAT_UNIDAD_CLAVE = 'LTR';
const UNIDAD_EMPRESA_CLAVE = 'LITRO';
const APPLY = process.argv.includes('--apply');

type ProductoOrigen = {
  id: number;
  clave: string;
  descripcion: string;
  clasificacion: string | null;
  familia: string | null;
  linea: string | null;
  activo: boolean | null;
  codigo_producto_sat: string | null;
  observaciones: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function sourceClient(): Client {
  return new Client({
    host: requiredEnv('DICOR_PG_HOST'),
    port: Number(requiredEnv('DICOR_PG_PORT')),
    database: requiredEnv('DICOR_PG_DATABASE'),
    user: requiredEnv('DICOR_PG_USER'),
    password: requiredEnv('DICOR_PG_PASSWORD'),
  });
}

function targetClient(): Client {
  return new Client({
    host: requiredEnv('EMPHASYS_PG_HOST'),
    port: Number(requiredEnv('EMPHASYS_PG_PORT')),
    database: requiredEnv('EMPHASYS_PG_DATABASE'),
    user: requiredEnv('EMPHASYS_PG_USER'),
    password: requiredEnv('EMPHASYS_PG_PASSWORD'),
    options: APPLY ? undefined : '-c default_transaction_read_only=on',
  });
}

function clean(value: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function ensureLiterUnit(client: PoolClient | Client): Promise<number> {
  const satUnit = await client.query<{ id: number }>(
    `SELECT id FROM sat.unidades WHERE clave = $1`,
    [SAT_UNIDAD_CLAVE],
  );

  let satUnitId = satUnit.rows[0]?.id;
  if (!satUnitId) {
    const source = await client.query<{ texto: string; vigencia_hasta: string | null }>(
      `SELECT texto, vigencia_hasta
         FROM sat.claves_unidades
        WHERE id = $1`,
      [SAT_UNIDAD_CLAVE],
    );
    const catalog = source.rows[0];
    if (!catalog || (catalog.vigencia_hasta ?? '').trim() !== '') {
      throw new Error('No existe una clave SAT LTR vigente y verificable.');
    }
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO sat.unidades (clave, descripcion, vigente)
       VALUES ($1, $2, true)
       ON CONFLICT (clave) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING id`,
      [SAT_UNIDAD_CLAVE, catalog.texto],
    );
    satUnitId = inserted.rows[0].id;
  }

  const existing = await client.query<{ id: number; unidad_sat_id: number; activo: boolean }>(
    `SELECT id, unidad_sat_id, activo
       FROM unidades
      WHERE empresa_id = $1 AND clave = $2`,
    [EMPRESA_DICOR_ID, UNIDAD_EMPRESA_CLAVE],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].unidad_sat_id !== satUnitId || !existing.rows[0].activo) {
      throw new Error('La unidad LITRO existente para empresa 9 es inconsistente.');
    }
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO unidades (clave, descripcion, unidad_sat_id, empresa_id, activo)
     VALUES ($1, 'Litro', $2, $3, true)
     RETURNING id`,
    [UNIDAD_EMPRESA_CLAVE, satUnitId, EMPRESA_DICOR_ID],
  );
  return inserted.rows[0].id;
}

async function main() {
  const source = sourceClient();
  const target = targetClient();
  await source.connect();
  await target.connect();

  try {
    await source.query('BEGIN READ ONLY');
    const origin = await source.query<ProductoOrigen>(
      `SELECT id, clave, descripcion, clasificacion, familia, linea, activo,
              codigo_producto_sat, observaciones
         FROM public.productos
        ORDER BY id`,
    );
    await target.query('BEGIN');
    await target.query(`SET LOCAL lock_timeout = '10s'`);
    await target.query(`SET LOCAL statement_timeout = '60s'`);

    const company = await target.query(
      `SELECT 1 FROM core.empresas WHERE id = $1 AND activo = true`,
      [EMPRESA_DICOR_ID],
    );
    if (company.rowCount !== 1) throw new Error('La empresa DICOR 9 no existe o no está activa.');

    const infra = await target.query<{ present: string | null }>(
      `SELECT to_regclass('migrate.entidades_correspondencias')::text AS present`,
    );
    if (!infra.rows[0]?.present) {
      throw new Error('Falta aplicar 20260820_migracion_correspondencias.sql.');
    }

    const tax = await target.query(
      `SELECT 1
         FROM impuestos i
         JOIN core.empresas_impuestos_default eid ON eid.impuesto_id = i.id
        WHERE eid.empresa_id = $1 AND i.id = $2 AND i.tipo = 'traslado'
          AND i.tasa = 16 AND i.activo = true`,
      [EMPRESA_DICOR_ID, IVA_ID],
    );
    if (tax.rowCount !== 1) throw new Error('La política IVA 16 de empresa 9 no es inequívoca.');

    const unitId = await ensureLiterUnit(target);
    const normalizedKeys = origin.rows.map((row) => normalizeKey(row.clave));
    if (new Set(normalizedKeys).size !== normalizedKeys.length) {
      throw new Error('Las claves normalizadas DICOR colisionan entre sí.');
    }

    for (const row of origin.rows) {
      const idOrigen = String(row.id);
      const key = normalizeKey(row.clave);
      const description = row.descripcion.trim();
      const satProductKey = clean(row.codigo_producto_sat);

      const mapping = await target.query<{ id_destino: string }>(
        `SELECT id_destino
           FROM migrate.entidades_correspondencias
          WHERE sistema_origen = $1 AND tipo_entidad = $2
            AND id_origen = $3 AND empresa_destino_id = $4`,
        [SISTEMA_ORIGEN, TIPO_ENTIDAD, idOrigen, EMPRESA_DICOR_ID],
      );

      let productId: number;
      if (mapping.rows[0]) {
        productId = Number(mapping.rows[0].id_destino);
        const existing = await target.query(
          `SELECT 1 FROM productos
            WHERE id = $1 AND empresa_id = $2 AND clave = $3`,
          [productId, EMPRESA_DICOR_ID, key],
        );
        if (existing.rowCount !== 1) {
          throw new Error(`Correspondencia inconsistente para producto DICOR ${idOrigen}.`);
        }
        if (APPLY) await target.query(
          `UPDATE productos SET descripcion=$1, activo=$2, clasificacion=$3, familia=$4,
             linea=$5, clave_producto_sat=$6, observaciones=$7
           WHERE id=$8 AND empresa_id=$9`,
          [description, row.activo !== false, clean(row.clasificacion), clean(row.familia),
           clean(row.linea), satProductKey, clean(row.observaciones), productId, EMPRESA_DICOR_ID],
        );
      } else {
        const collision = await target.query(
          `SELECT id FROM productos WHERE empresa_id = $1 AND clave = $2`,
          [EMPRESA_DICOR_ID, key],
        );
        if (collision.rowCount) {
          throw new Error(`La clave normalizada ${key} ya existe sin correspondencia.`);
        }

        if (!APPLY) continue;
        const inserted = await target.query<{ id: number }>(
          `INSERT INTO productos (
             empresa_id, clave, descripcion, activo, clasificacion, tipo_producto,
             familia, linea, unidad_venta_id, unidad_inventario_id,
             clave_producto_sat, observaciones, retiene_iva, retiene_isr
           ) VALUES ($1,$2,$3,$4,$5,'inventariable',$6,$7,$8,$8,$9,$10,false,false)
           RETURNING id`,
          [
            EMPRESA_DICOR_ID, key, description, row.activo !== false,
            clean(row.clasificacion), clean(row.familia), clean(row.linea), unitId,
            satProductKey, clean(row.observaciones),
          ],
        );
        productId = inserted.rows[0].id;

        await target.query(
          `INSERT INTO migrate.entidades_correspondencias
             (sistema_origen, tipo_entidad, id_origen, empresa_destino_id, id_destino, metadata)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [SISTEMA_ORIGEN, TIPO_ENTIDAD, idOrigen, EMPRESA_DICOR_ID, productId, { clave_origen: row.clave }],
        );
      }

      if (APPLY) await target.query(
        `INSERT INTO productos_impuestos (producto_id, impuesto_id)
         VALUES ($1::integer, $2::varchar)
         ON CONFLICT (producto_id, impuesto_id) DO NOTHING`,
        [productId, IVA_ID],
      );
    }

    await target.query(APPLY ? 'COMMIT' : 'ROLLBACK');
    await source.query('ROLLBACK');
    console.log(JSON.stringify({ ok: true, productos_origen: origin.rowCount }, null, 2));
  } catch (error) {
    await target.query('ROLLBACK').catch(() => undefined);
    await source.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
