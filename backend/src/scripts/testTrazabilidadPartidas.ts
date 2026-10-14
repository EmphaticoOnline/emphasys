import assert from 'node:assert/strict';
import { assertSoloImagenPartidasModificadas } from '../modules/documentos/documentos.repository';

const tratamientos = ['estandar', 'sin_iva'];

for (const tratamiento of tratamientos) {
  const actuales = [{ id: 1, producto_id: 6215, es_parte_oportunidad: false, cantidad: 2 }];

  // Una edición de encabezado no debe revalidar defaults de la partida.
  assert.doesNotThrow(() => assertSoloImagenPartidasModificadas(actuales, [{ id: 1 }], 'COT-TEST'));

  // Representaciones equivalentes tampoco son cambios reales.
  assert.doesNotThrow(() => assertSoloImagenPartidasModificadas(
    actuales,
    [{ id: 1, es_parte_oportunidad: 'false' as unknown as boolean, cantidad: '2' as unknown as number }],
    'COT-TEST',
  ));

  // Un cambio verdadero en una partida heredada sigue bloqueado.
  assert.throws(
    () => assertSoloImagenPartidasModificadas(actuales, [{ id: 1, es_parte_oportunidad: true }], 'COT-TEST'),
    /No se puede modificar "es_parte_oportunidad"/,
  );

  console.log(`OK trazabilidad ${tratamiento}`);
}

console.log('Pruebas de trazabilidad de partidas completadas.');
