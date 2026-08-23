import 'dotenv/config';
import pool from '../config/database';
import { materializeCartaPorte } from '../modules/transporte/carta-porte.service';
import { TransporteError } from '../modules/transporte/transporte.types';

const EMPRESA_ID = 8;
const VIAJE_ID = 1;
const USUARIO_ID = 9;

async function validarContextoDePrueba(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM core.usuarios u
         JOIN core.usuarios_empresas ue ON ue.usuario_id = u.id
        WHERE u.id = $1
          AND u.activo = true
          AND ue.empresa_id = $2
          AND ue.activo = true
     ) AS autorizado`,
    [USUARIO_ID, EMPRESA_ID]
  );

  if (!rows[0]?.autorizado) {
    throw new Error(
      `El usuario de prueba ${USUARIO_ID} no está activo o autorizado para la empresa ${EMPRESA_ID}.`
    );
  }
}

async function main(): Promise<void> {
  await validarContextoDePrueba();

  // Es exactamente la función de dominio invocada por
  // POST /api/transporte/viajes/:id/validar-carta-porte.
  const result = await materializeCartaPorte(VIAJE_ID, EMPRESA_ID);
  const materializacion = result.materializacion as Record<string, unknown>;
  const cartaPorteId = Number(materializacion?.id);
  const idCcp = String(materializacion?.id_ccp ?? result.cartaPorte31?.IdCCP ?? '');

  if (!Number.isInteger(cartaPorteId) || cartaPorteId <= 0) {
    throw new Error('El servicio no devolvió un carta_porte_id válido.');
  }
  if (!idCcp) {
    throw new Error('El servicio no devolvió IdCCP.');
  }

  console.log(JSON.stringify({
    ok: true,
    viaje_id: VIAJE_ID,
    carta_porte_id: cartaPorteId,
    id_ccp: idCcp,
    estatus: result.estado,
    snapshot: result.cartaPorte31,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    const failure = error instanceof TransporteError
      ? {
          ok: false,
          viaje_id: VIAJE_ID,
          campo_faltante_o_error: error.message,
          code: error.code,
          status_code: error.statusCode,
        }
      : {
          ok: false,
          viaje_id: VIAJE_ID,
          campo_faltante_o_error: error instanceof Error ? error.message : String(error),
        };

    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
