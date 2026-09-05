import 'dotenv/config';
import pool from '../config/database';
import { vincularFacturaViaje } from '../modules/transporte/carta-porte-timbrado.service';
import { createTrip } from '../modules/transporte/transporte.service';

const EMPRESA_ID = 8;
const USUARIO_ID = 9;
const DOCUMENTO_ID = 1773;
const FOLIO_INTERNO = 'CP-TEST-0001';

const payload = {
  folioInterno: FOLIO_INTERNO,
  clienteContactoId: 5348,
  estatus: 'borrador',
  fechaProgramada: '2026-08-25T08:00:00-06:00',
  fechaInicio: '2026-08-25T08:00:00-06:00',
  fechaFin: '2026-08-25T11:00:00-06:00',
  vehiculoId: 1,
  referenciaCliente: 'CP TEST EMPRESA 8',
  observaciones: 'Caso de prueba interno; no timbrar.',
  ubicaciones: [
    {
      domicilioId: 3168,
      tipo: 'origen',
      secuencia: 1,
      fechaHoraProgramada: '2026-08-25T08:00:00-06:00',
    },
    {
      domicilioId: 3169,
      tipo: 'destino',
      secuencia: 2,
      fechaHoraProgramada: '2026-08-25T11:00:00-06:00',
      distanciaRecorrida: 155,
    },
  ],
  mercancias: [
    {
      productoId: 6177,
      cantidad: 31_000,
      pesoKg: 25_000,
      valorMercancia: 100_000,
      origenSecuencia: 1,
      destinoSecuencia: 2,
    },
  ],
  figuras: [
    { tipoFigura: 'operador', operadorId: 1, contactoId: 5351, secuencia: 1 },
  ],
  remolques: [{ remolqueId: 1, orden: 1 }],
};

async function preflight(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM core.empresas WHERE id=$1 AND activo=true) AS empresa_ok,
       EXISTS (
         SELECT 1 FROM core.usuarios u
         JOIN core.usuarios_empresas ue ON ue.usuario_id=u.id
         WHERE u.id=$2 AND u.activo=true AND ue.empresa_id=$1 AND ue.activo=true
       ) AS usuario_ok,
       EXISTS (
         SELECT 1 FROM public.documentos
         WHERE id=$3 AND empresa_id=$1 AND LOWER(tipo_documento)='factura'
       ) AS factura_ok,
       (SELECT descripcion FROM public.productos WHERE id=6177 AND empresa_id=$1) AS mercancia,
       (SELECT contacto_id FROM transporte.operadores WHERE id=1 AND empresa_id=$1) AS operador_contacto_id,
       (SELECT id FROM transporte.viajes WHERE empresa_id=$1 AND folio_interno=$4 LIMIT 1) AS viaje_existente`,
    [EMPRESA_ID, USUARIO_ID, DOCUMENTO_ID, FOLIO_INTERNO]
  );

  const check = rows[0];
  if (!check.empresa_ok) throw new Error(`La empresa ${EMPRESA_ID} no existe o no está activa.`);
  if (!check.usuario_ok) throw new Error(`El usuario de prueba ${USUARIO_ID} no está activo en la empresa ${EMPRESA_ID}.`);
  if (!check.factura_ok) throw new Error(`La factura ${DOCUMENTO_ID} no existe en la empresa ${EMPRESA_ID}.`);
  if (!String(check.mercancia ?? '').trim().toUpperCase().startsWith('DIESEL')) {
    throw new Error('La mercancía 1 de la empresa 8 no corresponde a DIESEL. No se creó el viaje.');
  }
  if (Number(check.operador_contacto_id) !== 5351) {
    throw new Error('El operador 1 no corresponde al contacto 5351. No se creó el viaje.');
  }
  if (check.viaje_existente) {
    throw new Error(`Ya existe ${FOLIO_INTERNO}; viaje_id=${check.viaje_existente}. No se creó un duplicado.`);
  }
}

async function main(): Promise<void> {
  await preflight();

  // Misma función de dominio que usa POST /api/transporte/viajes.
  const aggregate = await createTrip(EMPRESA_ID, USUARIO_ID, payload);
  const viajeId = Number((aggregate as any)?.viaje?.id);
  if (!Number.isInteger(viajeId) || viajeId <= 0) {
    throw new Error('El servicio Transporte no devolvió un viaje_id válido.');
  }

  // Vincula la factura mediante el servicio existente; no materializa ni timbra Carta Porte.
  await vincularFacturaViaje(viajeId, DOCUMENTO_ID, EMPRESA_ID);

  console.log(JSON.stringify({
    ok: true,
    viaje_id: viajeId,
    empresa_id: EMPRESA_ID,
    usuario_id: USUARIO_ID,
    documento_id: DOCUMENTO_ID,
    estatus: (aggregate as any).viaje.estatus,
    timbrado: false,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`[crear-viaje-prueba] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
