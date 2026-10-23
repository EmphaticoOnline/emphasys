import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const service = fs.readFileSync(path.join(__dirname, '../src/crm/conversaciones.service.ts'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '../src/crm/conversaciones.controller.ts'), 'utf8');
const backfill = fs.readFileSync(path.join(__dirname, '../../database/migrations/20261023_backfill_crm_mensajes_media_url.sql'), 'utf8');

for (const tipo of ['Imagen', 'Audio', 'Documento', 'Video']) {
  test(`persistencia saliente de ${tipo} incluye media_url`, () => {
    const start = service.indexOf(`registrarMensaje${tipo}SalienteWhatsapp`);
    assert.notEqual(start, -1);
    const end = service.indexOf('\nexport const ', start + 1);
    assert.match(service.slice(start, end === -1 ? undefined : end), /media_url/);
  });
}

test('reenvío normaliza mensajes nuevos y legacy con la misma referencia', () => {
  assert.match(service, /COALESCE\(media_url, NULLIF\(contenido, ''\)\) AS media_url/);
  assert.match(controller, /!mensajeOriginal\.media_url/);
  assert.match(controller, /verifyMediaUrlReachable\(mensajeOriginal\.media_url\)/);
});

test('backfill solo afecta salientes multimedia con URL HTTP(S) y es idempotente', () => {
  assert.match(backfill, /tipo_mensaje = 'saliente'/);
  assert.match(backfill, /tipo_contenido IN \('image', 'audio', 'document', 'video'\)/);
  assert.match(backfill, /NULLIF\(BTRIM\(media_url\), ''\) IS NULL/);
  assert.match(backfill, /contenido ~\* '\^https\?:\/\/\[\^\[:space:\]\]\+\$'/);
  assert.doesNotMatch(backfill, /tipo_mensaje = 'entrante'/);
});

test('persistencia entrante y mensajes de texto conservan sus rutas', () => {
  assert.match(service, /registrarMensajeEntranteWhatsapp/);
  assert.match(service, /tipo_contenido.*media_url.*caption.*mime_type/s);
  const texto = service.slice(service.indexOf('registrarMensajeTextoSalienteWhatsapp'), service.indexOf('registrarMensajeImagenSalienteWhatsapp'));
  assert.doesNotMatch(texto, /media_url/);
});
