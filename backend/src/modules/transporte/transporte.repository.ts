import type { PoolClient, QueryResultRow } from 'pg';
import pool from '../../config/database';
import type {
  OperadorMaster,
  RemolqueMaster,
  UbicacionMaster,
  ProductoMercanciaMaster,
  ViajeInput,
} from './transporte.types';
import { TransporteError } from './transporte.types';

export type DbClient = Pick<PoolClient, 'query'>;

export async function listAvailableLocations(empresaId: number, options: { q?: string; contactoId?: number; tipoPropietario?: string; activos?: boolean; limit?: number }) {
  const params: unknown[] = [empresaId];
  const where = [
    'd.activo = CASE WHEN $2 THEN true ELSE d.activo END',
    '((d.contacto_id IS NOT NULL AND c.empresa_id = $1) OR d.empresa_id = $1)',
  ];
  params.push(options.activos !== false);
  if (options.contactoId) { params.push(options.contactoId); where.push(`d.contacto_id=$${params.length}`); }
  if (options.tipoPropietario === 'contacto') where.push('d.contacto_id IS NOT NULL');
  if (options.tipoPropietario === 'empresa') where.push('d.empresa_id IS NOT NULL');
  if (options.q?.trim()) { params.push(`%${options.q.trim()}%`); where.push(`concat_ws(' ', c.nombre, e.identificador, d.identificador, d.calle, d.colonia, d.ciudad, d.cp, d.cp_sat) ILIKE $${params.length}`); }
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  params.push(limit);
  const { rows } = await pool.query(`SELECT d.id domicilio_id, CASE WHEN d.contacto_id IS NULL THEN 'empresa' ELSE 'contacto' END tipo_propietario,
      d.contacto_id, d.empresa_id, COALESCE(c.nombre,e.identificador) propietario_nombre, d.identificador, d.es_principal,
      d.tipo_referencia, d.calle, d.numero_exterior, d.numero_interior, d.colonia, d.ciudad, d.estado, d.cp codigo_postal,
      d.pais, d.cp_sat, d.colonia_sat, d.latitud, d.longitud, d.activo
    FROM public.contactos_domicilios d LEFT JOIN public.contactos c ON c.id=d.contacto_id AND c.empresa_id=$1
    LEFT JOIN core.empresas e ON e.id=d.empresa_id AND e.id=$1
    WHERE ${where.join(' AND ')} ORDER BY d.es_principal DESC, d.activo DESC, propietario_nombre, d.identificador LIMIT $${params.length}`, params);
  return rows;
}

export async function listAvailableOperators(empresaId: number) {
  const { rows } = await pool.query(`SELECT o.id operador_id, o.contacto_id, c.nombre,
      COALESCE(cdf.rfc,c.rfc) rfc, cdf.curp, o.numero_licencia, o.tipo_licencia, o.vigencia_licencia
    FROM transporte.operadores o JOIN public.contactos c ON c.id=o.contacto_id AND c.empresa_id=o.empresa_id
    LEFT JOIN public.contactos_datos_fiscales cdf ON cdf.contacto_id=c.id
    WHERE o.empresa_id=$1 AND o.activo=true ORDER BY c.nombre`, [empresaId]);
  return rows;
}

export async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findContact(client: DbClient, empresaId: number, contactoId: number) {
  const { rows } = await client.query(
    `SELECT c.id, c.nombre, COALESCE(cdf.rfc, c.rfc) AS rfc, cdf.curp,
            CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object(
              'calle', cd.calle, 'numeroExterior', cd.numero_exterior,
              'numeroInterior', cd.numero_interior, 'colonia', COALESCE(cd.colonia_sat, cd.colonia),
              'localidad', cd.ciudad, 'estado', cd.estado, 'pais', cd.pais,
              'codigoPostal', COALESCE(cd.cp_sat, cd.cp), 'referencia', cd.cruces
            ) END AS domicilio
       FROM public.contactos c
       LEFT JOIN public.contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
       LEFT JOIN public.contactos_domicilios cd ON cd.contacto_id = c.id AND cd.es_principal = true
      WHERE c.id = $1 AND c.empresa_id = $2
      LIMIT 1`,
    [contactoId, empresaId]
  );
  return rows[0] ?? null;
}

export async function findVehicle(client: DbClient, empresaId: number, id: number) {
  const { rows } = await client.query(
    `SELECT * FROM transporte.vehiculos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

/**
 * Resuelve un domicilio operativo desde public.contactos_domicilios (maestro
 * consolidado). La validación multiempresa es explícita: el domicilio debe
 * pertenecer a un Contacto de la empresa activa o directamente a la empresa
 * activa (modelo XOR de contactos_domicilios). Devuelve null en cualquier otro
 * caso para que el llamador rechace la referencia.
 */
export async function findLocation(client: DbClient, empresaId: number, domicilioId: number): Promise<UbicacionMaster | null> {
  const { rows } = await client.query<UbicacionMaster>(
    `SELECT d.id,
            COALESCE(c.nombre, emp.razon_social, emp.nombre) AS nombre,
            CASE WHEN d.contacto_id IS NOT NULL
                 THEN COALESCE(cdf.rfc, c.rfc)
                 ELSE emp.rfc
            END AS rfc,
            d.calle, d.numero_exterior, d.numero_interior,
            COALESCE(d.colonia_sat, d.colonia) AS colonia,
            COALESCE(cp.localidad, d.ciudad) AS localidad,
            cp.municipio AS municipio,
            COALESCE(cp.estado, d.estado) AS estado,
            CASE WHEN upper(coalesce(d.pais, '')) IN ('MÉXICO', 'MEXICO', 'MX', 'MEX')
                 THEN 'MEX' ELSE d.pais
            END AS pais,
            COALESCE(d.cp_sat, d.cp) AS codigo_postal,
            d.cruces AS referencia,
            d.latitud, d.longitud
       FROM public.contactos_domicilios d
       LEFT JOIN public.contactos c ON c.id = d.contacto_id
       LEFT JOIN public.contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
       LEFT JOIN core.empresas emp ON emp.id = d.empresa_id
       LEFT JOIN sat.codigos_postales cp ON cp.id = COALESCE(d.cp_sat, d.cp)
      WHERE d.id = $1
        AND (
             (d.contacto_id IS NOT NULL AND c.empresa_id = $2)
          OR (d.empresa_id = $2)
        )
      LIMIT 1`,
    [domicilioId, empresaId]
  );
  return rows[0] ?? null;
}

export async function findProductMerchandise(client: DbClient, empresaId: number, id: number): Promise<ProductoMercanciaMaster | null> {
  const { rows } = await client.query<ProductoMercanciaMaster>(
    `SELECT p.id, p.descripcion, p.clave_bienes_transportados_sat, p.clave_unidad_sat,
            COALESCE(uv.descripcion, ui.descripcion) AS unidad_descripcion,
            p.es_material_peligroso AS material_peligroso, p.clave_material_peligroso_sat AS clave_material_peligroso,
            p.clave_embalaje_sat AS embalaje, p.descripcion_embalaje
       FROM public.productos p
       LEFT JOIN public.unidades uv ON uv.id=p.unidad_venta_id
       LEFT JOIN public.unidades ui ON ui.id=p.unidad_inventario_id
      WHERE p.id=$1 AND p.empresa_id=$2 LIMIT 1`, [id, empresaId]);
  return rows[0] ?? null;
}

export async function findOperator(client: DbClient, empresaId: number, id: number): Promise<OperadorMaster | null> {
  const { rows } = await client.query<OperadorMaster>(
    `SELECT o.id, o.contacto_id, o.numero_licencia, o.tipo_licencia, o.vigencia_licencia,
            c.nombre, COALESCE(cdf.rfc, c.rfc) AS rfc, cdf.curp,
            CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object(
              'calle', cd.calle, 'numeroExterior', cd.numero_exterior,
              'numeroInterior', cd.numero_interior, 'colonia', COALESCE(cd.colonia_sat, cd.colonia),
              'localidad', COALESCE(cp.localidad, cd.ciudad), 'municipio', cp.municipio,
              'estado', COALESCE(cp.estado, cd.estado), 'pais', COALESCE(estado.pais, cd.pais),
              'codigoPostal', COALESCE(cd.cp_sat, cd.cp), 'referencia', cd.cruces
            ) END AS domicilio
       FROM transporte.operadores o
       JOIN public.contactos c ON c.id = o.contacto_id AND c.empresa_id = o.empresa_id
       LEFT JOIN public.contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
       LEFT JOIN public.contactos_domicilios cd ON cd.contacto_id = c.id AND cd.es_principal = true
       LEFT JOIN sat.codigos_postales cp ON cp.id = COALESCE(cd.cp_sat, cd.cp)
       LEFT JOIN sat.estados estado ON estado.estado = cp.estado
      WHERE o.id = $1 AND o.empresa_id = $2 AND o.activo = true
      LIMIT 1`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

export async function findTrailer(client: DbClient, empresaId: number, id: number): Promise<RemolqueMaster | null> {
  const { rows } = await client.query<RemolqueMaster>(
    `SELECT id, placas, subtipo_remolque_sat
       FROM transporte.remolques
      WHERE id = $1 AND empresa_id = $2
      LIMIT 1`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

export async function insertTrip(client: DbClient, empresaId: number, usuarioId: number, input: ViajeInput): Promise<number> {
  const { rows } = await client.query<{ id: string | number }>(
    `INSERT INTO transporte.viajes (
       empresa_id, folio_interno, cliente_contacto_id, estatus, fecha_programada,
       fecha_inicio, fecha_fin, vehiculo_id, referencia_cliente, observaciones, creado_por
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [empresaId, input.folioInterno, input.clienteContactoId, input.estatus,
      input.fechaProgramada, input.fechaInicio, input.fechaFin, input.vehiculoId,
      input.referenciaCliente, input.observaciones, usuarioId]
  );
  return Number(rows[0].id);
}

export async function lockTrip(client: DbClient, empresaId: number, id: number) {
  const { rows } = await client.query(
    `SELECT id, estatus FROM transporte.viajes WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

export async function updateTrip(client: DbClient, empresaId: number, id: number, input: ViajeInput): Promise<void> {
  await client.query(
    `UPDATE transporte.viajes SET folio_interno=$3, cliente_contacto_id=$4, estatus=$5,
       fecha_programada=$6, fecha_inicio=$7, fecha_fin=$8, vehiculo_id=$9,
       referencia_cliente=$10, observaciones=$11, updated_at=now()
     WHERE id=$1 AND empresa_id=$2`,
    [id, empresaId, input.folioInterno, input.clienteContactoId, input.estatus,
      input.fechaProgramada, input.fechaInicio, input.fechaFin, input.vehiculoId,
      input.referenciaCliente, input.observaciones]
  );
}

export async function clearTripChildren(client: DbClient, empresaId: number, viajeId: number): Promise<void> {
  await client.query(`DELETE FROM transporte.viaje_mercancias WHERE empresa_id=$1 AND viaje_id=$2`, [empresaId, viajeId]);
  await client.query(`DELETE FROM transporte.viaje_figuras WHERE empresa_id=$1 AND viaje_id=$2`, [empresaId, viajeId]);
  await client.query(`DELETE FROM transporte.viaje_remolques WHERE empresa_id=$1 AND viaje_id=$2`, [empresaId, viajeId]);
  await client.query(`DELETE FROM transporte.viaje_ubicaciones WHERE empresa_id=$1 AND viaje_id=$2`, [empresaId, viajeId]);
}

export async function insertLocation(client: DbClient, values: unknown[]): Promise<number> {
  const { rows } = await client.query<{ id: string | number }>(
    `INSERT INTO transporte.viaje_ubicaciones (
       empresa_id, viaje_id, tipo, secuencia,
       remitente_destinatario_nombre, remitente_destinatario_rfc,
       fecha_hora_programada, fecha_hora_real, distancia_recorrida,
       domicilio_snapshot, coordenadas_snapshot
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [
      values[0], values[1], values[3], values[4], values[5], values[6], values[7], values[8],
      values[9], values[10], values[11],
    ]
  );
  return Number(rows[0].id);
}

export async function insertMerchandise(client: DbClient, values: unknown[]): Promise<void> {
  await client.query(
    `INSERT INTO transporte.viaje_mercancias (
       empresa_id, viaje_id, producto_id, descripcion_snapshot,
       clave_bienes_transportados_sat, clave_unidad_sat, unidad_descripcion,
       cantidad, peso_kg, valor_mercancia, material_peligroso,
       clave_material_peligroso, embalaje, descripcion_embalaje,
       origen_viaje_ubicacion_id, destino_viaje_ubicacion_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, values
  );
}

export async function insertFigure(client: DbClient, values: unknown[]): Promise<void> {
  await client.query(
    `INSERT INTO transporte.viaje_figuras
       (empresa_id, viaje_id, tipo_figura, operador_id, contacto_id, secuencia, datos_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, values
  );
}

export async function insertTrailer(client: DbClient, values: unknown[]): Promise<void> {
  await client.query(
    `INSERT INTO transporte.viaje_remolques
       (empresa_id, viaje_id, remolque_id, orden, datos_snapshot)
     VALUES ($1,$2,$3,$4,$5)`, values
  );
}

export interface ReinsertableMercancia {
  producto_id: number | null;
  descripcion_snapshot: string;
  clave_bienes_transportados_sat: string | null;
  clave_unidad_sat: string | null;
  unidad_descripcion: string | null;
  cantidad: string | number;
  peso_kg: string | number;
  valor_mercancia: string | number | null;
  material_peligroso: boolean;
  clave_material_peligroso: string | null;
  embalaje: string | null;
  descripcion_embalaje: string | null;
  origen_secuencia: number | null;
  destino_secuencia: number | null;
}

/**
 * Lee las mercancías actuales de un viaje con la secuencia de sus ubicaciones
 * de origen/destino, para poder reinsertarlas verbatim tras reconstruir las
 * ubicaciones. No consulta el maestro de Productos: preserva el snapshot tal
 * como quedó capturado.
 */
export async function getReinsertableMercancias(
  client: DbClient, empresaId: number, viajeId: number
): Promise<ReinsertableMercancia[]> {
  return rows<ReinsertableMercancia & QueryResultRow>(client,
    `SELECT m.producto_id, m.descripcion_snapshot, m.clave_bienes_transportados_sat,
            m.clave_unidad_sat, m.unidad_descripcion, m.cantidad, m.peso_kg,
            m.valor_mercancia, m.material_peligroso, m.clave_material_peligroso,
            m.embalaje, m.descripcion_embalaje,
            o.secuencia AS origen_secuencia, d.secuencia AS destino_secuencia
       FROM transporte.viaje_mercancias m
       LEFT JOIN transporte.viaje_ubicaciones o
         ON o.id = m.origen_viaje_ubicacion_id AND o.empresa_id = m.empresa_id AND o.viaje_id = m.viaje_id
       LEFT JOIN transporte.viaje_ubicaciones d
         ON d.id = m.destino_viaje_ubicacion_id AND d.empresa_id = m.empresa_id AND d.viaje_id = m.viaje_id
      WHERE m.empresa_id = $1 AND m.viaje_id = $2
      ORDER BY m.id`, [empresaId, viajeId]);
}

export async function insertPreservedMercancia(client: DbClient, values: unknown[]): Promise<void> {
  await client.query(
    `INSERT INTO transporte.viaje_mercancias (
       empresa_id, viaje_id, producto_id, descripcion_snapshot,
       clave_bienes_transportados_sat, clave_unidad_sat, unidad_descripcion,
       cantidad, peso_kg, valor_mercancia, material_peligroso,
       clave_material_peligroso, embalaje, descripcion_embalaje,
       origen_viaje_ubicacion_id, destino_viaje_ubicacion_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, values
  );
}

async function rows<T extends QueryResultRow>(client: DbClient, sql: string, params: unknown[]): Promise<T[]> {
  return (await client.query<T>(sql, params)).rows;
}

/**
 * Partidas de un documento (factura) listas para importarse como mercancías del
 * Viaje: copia la descripción/cantidad/valor de la partida y los atributos SAT
 * del producto asociado. NO reproduce cálculos fiscales/comerciales de
 * Documentos; es sólo lectura para poblar los snapshots de Carta Porte.
 */
export async function listImportablePartidas(empresaId: number, documentoId: number) {
  return rows(pool,
    `SELECT dp.id AS partida_id,
            dp.numero_partida,
            dp.producto_id,
            COALESCE(NULLIF(btrim(dp.descripcion_alterna), ''), p.descripcion) AS descripcion,
            dp.cantidad,
            dp.unidad AS unidad_partida,
            COALESCE(uv.descripcion, ui.descripcion) AS unidad_descripcion,
            p.clave_unidad_sat,
            p.clave_bienes_transportados_sat,
            COALESCE(p.es_material_peligroso, false) AS material_peligroso,
            p.clave_material_peligroso_sat AS clave_material_peligroso,
            p.clave_embalaje_sat AS embalaje,
            p.descripcion_embalaje,
            dp.subtotal_partida AS valor_mercancia,
            CASE WHEN p.peso_unitario IS NOT NULL
                 THEN round(p.peso_unitario * dp.cantidad, 3) END AS peso_sugerido
       FROM public.documentos_partidas dp
       JOIN public.documentos d ON d.id = dp.documento_id AND d.empresa_id = $1
       LEFT JOIN public.productos p ON p.id = dp.producto_id
       LEFT JOIN public.unidades uv ON uv.id = p.unidad_venta_id
       LEFT JOIN public.unidades ui ON ui.id = p.unidad_inventario_id
      WHERE dp.documento_id = $2
        AND COALESCE(dp.es_gasto, false) = false
      ORDER BY dp.numero_partida, dp.id`, [empresaId, documentoId]);
}

export async function getTripAggregate(client: DbClient, empresaId: number, id: number) {
  const tripRows = await rows(client,
    `SELECT id, folio_interno, cliente_contacto_id, estatus, fecha_programada,
            fecha_inicio, fecha_fin, vehiculo_id, referencia_cliente, observaciones,
            creado_por, created_at, updated_at
       FROM transporte.viajes WHERE id=$1 AND empresa_id=$2`, [id, empresaId]);
  if (!tripRows[0]) return null;

  const [locations, merchandise, figures, trailers, documents, cartaRows] = await Promise.all([
    rows(client, `SELECT vu.*,
            vu.domicilio_snapshot AS domicilio
       FROM transporte.viaje_ubicaciones vu
      WHERE vu.viaje_id=$1 AND vu.empresa_id=$2 ORDER BY vu.secuencia, vu.id`, [id, empresaId]),
    rows(client, `SELECT m.*, o.secuencia AS origen_secuencia, d.secuencia AS destino_secuencia
       FROM transporte.viaje_mercancias m
       LEFT JOIN transporte.viaje_ubicaciones o
         ON o.id = m.origen_viaje_ubicacion_id AND o.empresa_id = m.empresa_id AND o.viaje_id = m.viaje_id
       LEFT JOIN transporte.viaje_ubicaciones d
         ON d.id = m.destino_viaje_ubicacion_id AND d.empresa_id = m.empresa_id AND d.viaje_id = m.viaje_id
      WHERE m.viaje_id=$1 AND m.empresa_id=$2 ORDER BY m.id`, [id, empresaId]),
    rows(client, `SELECT * FROM transporte.viaje_figuras WHERE viaje_id=$1 AND empresa_id=$2 ORDER BY secuencia,id`, [id, empresaId]),
    rows(client, `SELECT * FROM transporte.viaje_remolques WHERE viaje_id=$1 AND empresa_id=$2 ORDER BY orden,id`, [id, empresaId]),
    rows(client, `SELECT id, documento_id, tipo_relacion, principal, created_at FROM transporte.viaje_documentos WHERE viaje_id=$1 AND empresa_id=$2 ORDER BY id`, [id, empresaId]),
    rows(client, `SELECT id, documento_id, version, id_ccp, estatus, snapshot_json, validado_at, timbrado_at, created_at, updated_at FROM transporte.cartas_porte WHERE viaje_id=$1 AND empresa_id=$2 ORDER BY id DESC LIMIT 1`, [id, empresaId]),
  ]);
  return { viaje: tripRows[0], ubicaciones: locations, mercancias: merchandise, figuras: figures, remolques: trailers, documentos: documents, cartaPorte: cartaRows[0] ?? null };
}

export async function getTripAggregateFromPool(empresaId: number, id: number) {
  return getTripAggregate(pool, empresaId, id);
}

export async function getTripByDocument(client: DbClient, empresaId: number, documentoId: number) {
  const { rows } = await client.query(
    `SELECT v.id AS viaje_id, v.estatus, v.folio_interno, vd.documento_id,
            (SELECT row_to_json(cp) FROM transporte.cartas_porte cp
              WHERE cp.empresa_id=v.empresa_id AND cp.viaje_id=v.id
              ORDER BY cp.id DESC LIMIT 1) AS carta_porte
       FROM transporte.viaje_documentos vd
       JOIN transporte.viajes v ON v.id=vd.viaje_id AND v.empresa_id=vd.empresa_id
      WHERE vd.empresa_id=$1 AND vd.documento_id=$2 AND vd.tipo_relacion='factura_servicio' AND vd.principal=true
      ORDER BY vd.id DESC LIMIT 1`, [empresaId, documentoId]);
  return rows[0] ?? null;
}

export async function getCartaPorteBuildSource(client: DbClient, empresaId: number, viajeId: number) {
  const aggregate = await getTripAggregate(client, empresaId, viajeId);
  if (!aggregate) return null;
  const vehicleId = Number((aggregate.viaje as any).vehiculo_id);
  const vehiculo = vehicleId ? await findVehicle(client, empresaId, vehicleId) : null;
  return { ...aggregate, vehiculo };
}

export async function lockCurrentCartaPorte(client: DbClient, empresaId: number, viajeId: number) {
  const { rows } = await client.query(
    `SELECT id, documento_id, id_ccp, estatus, timbrado_at
       FROM transporte.cartas_porte
      WHERE empresa_id=$1 AND viaje_id=$2
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE`,
    [empresaId, viajeId]
  );
  return rows[0] ?? null;
}

export async function invalidateCurrentCartaPorteForEdit(
  client: DbClient,
  empresaId: number,
  viajeId: number
): Promise<boolean> {
  const current = await lockCurrentCartaPorte(client, empresaId, viajeId);
  if (!current) return false;
  if (current.timbrado_at || current.estatus === 'timbrado') {
    throw new TransporteError(
      'La Carta Porte timbrada es inmutable y el viaje no puede editarse.',
      409,
      'CARTA_PORTE_TIMBRADA'
    );
  }
  await client.query(
    `DELETE FROM transporte.cartas_porte
      WHERE id=$1 AND empresa_id=$2 AND viaje_id=$3`,
    [current.id, empresaId, viajeId]
  );
  return true;
}

export async function findPrincipalTripDocument(client: DbClient, empresaId: number, viajeId: number): Promise<number | null> {
  const { rows } = await client.query<{ documento_id: number }>(
    `SELECT documento_id
       FROM transporte.viaje_documentos
      WHERE empresa_id=$1 AND viaje_id=$2 AND tipo_relacion='factura_servicio'
      ORDER BY principal DESC, id ASC
      LIMIT 1`,
    [empresaId, viajeId]
  );
  return rows[0]?.documento_id ?? null;
}

export async function saveCartaPorteMaterialization(
  client: DbClient,
  values: {
    currentId?: number | null;
    empresaId: number;
    viajeId: number;
    documentoId: number | null;
    idCcp: string;
    snapshot: object;
  }
) {
  if (values.currentId) {
    const { rows } = await client.query(
      `UPDATE transporte.cartas_porte
          SET documento_id=$2, version='3.1', id_ccp=$3, estatus='validado',
              snapshot_json=$4, validado_at=now(), timbrado_at=NULL, updated_at=now()
        WHERE id=$1
        RETURNING id, empresa_id, viaje_id, documento_id, version, id_ccp, estatus,
                  snapshot_json, validado_at, timbrado_at, created_at, updated_at`,
      [values.currentId, values.documentoId, values.idCcp, values.snapshot]
    );
    return rows[0];
  }
  const { rows } = await client.query(
    `INSERT INTO transporte.cartas_porte
       (empresa_id, viaje_id, documento_id, version, id_ccp, estatus, snapshot_json, validado_at)
     VALUES ($1,$2,$3,'3.1',$4,'validado',$5,now())
     RETURNING id, empresa_id, viaje_id, documento_id, version, id_ccp, estatus,
               snapshot_json, validado_at, timbrado_at, created_at, updated_at`,
    [values.empresaId, values.viajeId, values.documentoId, values.idCcp, values.snapshot]
  );
  return rows[0];
}

export async function markTripValidated(client: DbClient, empresaId: number, viajeId: number): Promise<void> {
  await client.query(
    `UPDATE transporte.viajes SET estatus='validado', updated_at=now()
      WHERE id=$1 AND empresa_id=$2`,
    [viajeId, empresaId]
  );
}

export async function getCurrentCartaPorteFromPool(empresaId: number, viajeId: number) {
  const { rows } = await pool.query(
    `SELECT cp.id, cp.empresa_id, cp.viaje_id, cp.documento_id, cp.version,
            cp.id_ccp, cp.estatus, cp.snapshot_json, cp.validado_at,
            cp.timbrado_at, cp.created_at, cp.updated_at
       FROM transporte.cartas_porte cp
       JOIN transporte.viajes v ON v.id=cp.viaje_id AND v.empresa_id=cp.empresa_id
      WHERE cp.empresa_id=$1 AND cp.viaje_id=$2
      ORDER BY cp.id DESC LIMIT 1`,
    [empresaId, viajeId]
  );
  return rows[0] ?? null;
}

export async function linkPrincipalDocument(
  client: DbClient,
  empresaId: number,
  viajeId: number,
  documentoId: number
) {
  const trip = await lockTrip(client, empresaId, viajeId);
  if (!trip) return null;
  const { rows: documents } = await client.query(
    `SELECT id FROM public.documentos
      WHERE id=$1 AND empresa_id=$2 AND LOWER(tipo_documento)='factura'
      FOR UPDATE`,
    [documentoId, empresaId]
  );
  if (!documents[0]) throw new TransporteError('La factura no existe o no pertenece a la empresa activa.');
  const { rows: existingDocumentLinks } = await client.query(
    `SELECT viaje_id FROM transporte.viaje_documentos
      WHERE empresa_id=$1 AND documento_id=$2
        AND tipo_relacion='factura_servicio' AND principal=true
      FOR UPDATE`,
    [empresaId, documentoId]
  );
  if (existingDocumentLinks.some((row: any) => Number(row.viaje_id) !== viajeId)) {
    throw new TransporteError('La factura ya está vinculada como principal a otro viaje.', 409, 'FACTURA_VIAJE_DUPLICADA');
  }
  const carta = await lockCurrentCartaPorte(client, empresaId, viajeId);
  if (carta?.timbrado_at || carta?.estatus === 'timbrado') {
    throw new TransporteError('No puede cambiarse la factura de una Carta Porte timbrada.', 409, 'CARTA_PORTE_TIMBRADA');
  }
  await client.query(
    `DELETE FROM transporte.viaje_documentos
      WHERE empresa_id=$1 AND viaje_id=$2 AND tipo_relacion='factura_servicio'`,
    [empresaId, viajeId]
  );
  const { rows } = await client.query(
    `INSERT INTO transporte.viaje_documentos
       (empresa_id, viaje_id, documento_id, tipo_relacion, principal)
     VALUES ($1,$2,$3,'factura_servicio',true)
     RETURNING id, viaje_id, documento_id, tipo_relacion, principal, created_at`,
    [empresaId, viajeId, documentoId]
  );
  if (carta) {
    await client.query(
      `UPDATE transporte.cartas_porte SET documento_id=$2, updated_at=now()
        WHERE id=$1`,
      [carta.id, documentoId]
    );
  }
  return rows[0];
}

export async function findCartaPorteStampContext(documentoId: number, empresaId: number) {
  const { rows } = await pool.query(
    `SELECT v.id AS viaje_id, v.estatus AS viaje_estatus,
            cp.id AS carta_porte_id, cp.documento_id, cp.estatus AS carta_porte_estatus,
            cp.id_ccp, cp.snapshot_json
       FROM transporte.viaje_documentos vd
       JOIN transporte.viajes v ON v.id=vd.viaje_id AND v.empresa_id=vd.empresa_id
       LEFT JOIN transporte.cartas_porte cp ON cp.viaje_id=v.id AND cp.empresa_id=v.empresa_id
      WHERE vd.documento_id=$1 AND vd.empresa_id=$2
        AND vd.tipo_relacion='factura_servicio' AND vd.principal=true
      ORDER BY cp.id DESC NULLS LAST LIMIT 1`,
    [documentoId, empresaId]
  );
  return rows[0] ?? null;
}

export async function markTransportCancelledForDocument(client: DbClient, documentoId: number, empresaId: number) {
  return client.query(
    `WITH cartas AS (
       UPDATE transporte.cartas_porte cp
          SET estatus='cancelado', updated_at=now()
         FROM transporte.viaje_documentos vd
        WHERE vd.documento_id=$1 AND vd.empresa_id=$2
          AND vd.tipo_relacion='factura_servicio' AND vd.principal=true
          AND cp.viaje_id=vd.viaje_id AND cp.empresa_id=vd.empresa_id
        RETURNING cp.viaje_id, cp.empresa_id
     )
     UPDATE transporte.viajes v SET estatus='cancelado', updated_at=now()
      FROM cartas c WHERE v.id=c.viaje_id AND v.empresa_id=c.empresa_id`,
    [documentoId, empresaId]
  );
}
