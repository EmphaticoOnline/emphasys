import 'dotenv/config';
import pool from '../config/database';
import { materializeCartaPorte } from '../modules/transporte/carta-porte.service';
import { getTrip, updateTripAggregate } from '../modules/transporte/transporte.service';

const EMPRESA_ID = 8;
const VIAJE_ID = 1;
const DOCUMENTO_ID = 1773;

const isoDate = (value: unknown): unknown => value instanceof Date ? value.toISOString() : value;

const domicilios = [
  {
    referencia: 'CP_TEST_ORIGEN',
    pais: 'MEX', estado: 'JAL', municipio: '120', localidad: '10',
    codigoPostal: '45010', colonia: '0555', coloniaNombre: 'Ciudad Granja',
  },
  {
    referencia: 'CP_TEST_DESTINO',
    pais: 'MEX', estado: 'JAL', municipio: '073', localidad: '07',
    codigoPostal: '47000', colonia: '1732', coloniaNombre: 'San Juan de los Lagos Centro',
  },
] as const;

async function validarCatalogosYContexto(): Promise<void> {
  const { rows: links } = await pool.query(
    `SELECT v.id AS viaje_id, v.estatus, cp.id AS carta_porte_id, cp.estatus AS carta_estatus,
            cp.timbrado_at
       FROM transporte.viaje_documentos vd
       JOIN transporte.viajes v ON v.id=vd.viaje_id AND v.empresa_id=vd.empresa_id
       LEFT JOIN transporte.cartas_porte cp ON cp.viaje_id=v.id AND cp.empresa_id=v.empresa_id
      WHERE vd.empresa_id=$1 AND vd.documento_id=$2 AND v.id=$3
      ORDER BY cp.id DESC LIMIT 1`,
    [EMPRESA_ID, DOCUMENTO_ID, VIAJE_ID]
  );
  const link = links[0];
  if (!link) throw new Error(`El documento ${DOCUMENTO_ID} no está vinculado al viaje ${VIAJE_ID}.`);
  if (link.timbrado_at || link.carta_estatus === 'timbrado' || link.estatus === 'timbrado') {
    throw new Error('La Carta Porte o el viaje ya están timbrados; no se modificarán.');
  }

  for (const domicilio of domicilios) {
    const { rows } = await pool.query(
      `SELECT cp.id
         FROM sat.codigos_postales cp
         JOIN sat.estados e ON e.estado=cp.estado AND e.pais=$2
         JOIN sat.municipios m ON m.estado=cp.estado AND m.municipio=cp.municipio
         JOIN sat.localidades l ON l.estado=cp.estado AND l.localidad=cp.localidad
         JOIN sat.colonias c ON c.codigo_postal=cp.id AND c.colonia=$6
        WHERE cp.id=$1 AND cp.estado=$3 AND cp.municipio=$4 AND cp.localidad=$5
          AND (cp.vigencia_hasta='' OR cp.vigencia_hasta IS NULL)`,
      [domicilio.codigoPostal, domicilio.pais, domicilio.estado,
        domicilio.municipio, domicilio.localidad, domicilio.colonia]
    );
    if (!rows[0]) {
      throw new Error(`Catálogo SAT incompatible para ${domicilio.referencia}; no se modificaron datos.`);
    }
  }
}

async function corregirMaestros(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const domicilio of domicilios) {
      const updated = await client.query(
        `UPDATE transporte.ubicaciones
            SET pais=$3, estado=$4, municipio=$5, localidad=$6,
                codigo_postal=$7, colonia=$8, updated_at=now()
          WHERE empresa_id=$1 AND tipo_referencia=$2`,
        [EMPRESA_ID, domicilio.referencia, domicilio.pais, domicilio.estado,
          domicilio.municipio, domicilio.localidad, domicilio.codigoPostal, domicilio.colonia]
      );
      if (updated.rowCount !== 1) {
        throw new Error(`Se esperaba una ubicación ${domicilio.referencia}; encontradas: ${updated.rowCount}.`);
      }

      await client.query(
        `UPDATE public.contactos_domicilios d
            SET colonia=$3, colonia_sat=$4, ciudad=$5, estado=$6,
                cp=$7::text, cp_sat=$7::text, pais=$8
           FROM public.contactos c
          WHERE c.id=d.contacto_id AND c.empresa_id=$1 AND c.codigo_legacy=$2
            AND d.identificador='CP_TEST_FISCAL'`,
        [EMPRESA_ID, domicilio.referencia, domicilio.coloniaNombre, domicilio.colonia,
          domicilio.localidad, domicilio.estado, domicilio.codigoPostal, domicilio.pais]
      );
    }

    const operador = domicilios[0];
    const operatorUpdate = await client.query(
      `UPDATE public.contactos_domicilios d
          SET colonia=$2, colonia_sat=$3, ciudad=$4, estado=$5,
              cp=$6::text, cp_sat=$6::text, pais=$7
         FROM public.contactos c
        WHERE c.id=d.contacto_id AND c.empresa_id=$1 AND c.codigo_legacy='CP_TEST_OPERADOR'
          AND d.identificador='CP_TEST_FISCAL'`,
      [EMPRESA_ID, operador.coloniaNombre, operador.colonia,
        operador.localidad, operador.estado, operador.codigoPostal, operador.pais]
    );
    if (operatorUpdate.rowCount !== 1) {
      throw new Error(`Se esperaba un domicilio CP_TEST_OPERADOR; encontrados: ${operatorUpdate.rowCount}.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function refrescarViajeYMaterializar() {
  const aggregate = await getTrip(EMPRESA_ID, VIAJE_ID) as any;
  const viaje = aggregate.viaje;
  await updateTripAggregate(EMPRESA_ID, VIAJE_ID, {
    folioInterno: viaje.folio_interno,
    clienteContactoId: viaje.cliente_contacto_id,
    estatus: 'borrador',
    fechaProgramada: isoDate(viaje.fecha_programada),
    fechaInicio: isoDate(viaje.fecha_inicio),
    fechaFin: isoDate(viaje.fecha_fin),
    vehiculoId: viaje.vehiculo_id,
    referenciaCliente: viaje.referencia_cliente,
    observaciones: viaje.observaciones,
    ubicaciones: aggregate.ubicaciones.map((item: any) => ({
      ubicacionId: item.ubicacion_id,
      tipo: item.tipo,
      secuencia: item.secuencia,
      fechaHoraProgramada: isoDate(item.fecha_hora_programada),
      fechaHoraReal: isoDate(item.fecha_hora_real),
      distanciaRecorrida: item.distancia_recorrida,
    })),
    mercancias: aggregate.mercancias.map((item: any) => ({
      mercanciaId: item.mercancia_id,
      cantidad: item.cantidad,
      pesoKg: item.peso_kg,
      valorMercancia: item.valor_mercancia,
      origenSecuencia: aggregate.ubicaciones.find((u: any) => u.id === item.origen_viaje_ubicacion_id)?.secuencia,
      destinoSecuencia: aggregate.ubicaciones.find((u: any) => u.id === item.destino_viaje_ubicacion_id)?.secuencia,
    })),
    figuras: aggregate.figuras.map((item: any) => ({
      tipoFigura: item.tipo_figura,
      operadorId: item.operador_id,
      contactoId: item.contacto_id,
      secuencia: item.secuencia,
    })),
    remolques: aggregate.remolques.map((item: any) => ({
      remolqueId: item.remolque_id,
      orden: item.orden,
    })),
  });
  return materializeCartaPorte(VIAJE_ID, EMPRESA_ID);
}

async function main(): Promise<void> {
  await validarCatalogosYContexto();
  await corregirMaestros();
  const result = await refrescarViajeYMaterializar();
  console.log(JSON.stringify({
    ok: true,
    viaje_id: VIAJE_ID,
    carta_porte_id: Number((result.materializacion as any).id),
    id_ccp: result.cartaPorte31.IdCCP,
    estatus: result.estado,
    ubicaciones: result.cartaPorte31.Ubicaciones.map((item) => ({
      tipo: item.TipoUbicacion,
      domicilio: item.Domicilio,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
