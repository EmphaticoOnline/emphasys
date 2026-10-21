import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Regresión móvil: al tocar una imagen del chat (enviada o recibida) debe
 * abrirse un visor dentro de la app con un botón X para volver a la misma
 * conversación, en lugar de navegar al archivo crudo con <a target="_blank">.
 */
const mobileView = readFileSync(new URL('./LeadsMobileView.tsx', import.meta.url), 'utf8');

const imageBlock = (() => {
  const start = mobileView.indexOf("{msg.tipoContenido === 'image' && msg.mediaUrl && (\n          <Box");
  assert.ok(start >= 0, 'no se encontró el bloque de imagen de la burbuja');
  return mobileView.slice(start, mobileView.indexOf('</Box>', start));
})();

test('la imagen del chat abre el visor interno, no un enlace externo', () => {
  assert.doesNotMatch(imageBlock, /target="_blank"/);
  assert.doesNotMatch(imageBlock, /href=/);
  assert.match(imageBlock, /onClick=\{\(\) => setImageViewerOpen\(true\)\}/);
});

test('el visor no distingue imágenes enviadas de recibidas', () => {
  assert.match(mobileView, /<ChatImageViewer\s+open=\{imageViewerOpen\}\s+src=\{msg\.mediaUrl\}/);
  const viewerUse = mobileView.slice(mobileView.indexOf('<ChatImageViewer'), mobileView.indexOf('/>', mobileView.indexOf('<ChatImageViewer')));
  assert.doesNotMatch(viewerUse, /isMine/);
});

test('el visor tiene botón X accesible respetando el área segura', () => {
  const viewer = mobileView.slice(mobileView.indexOf('function ChatImageViewer'), mobileView.indexOf('type MessageBubbleProps'));
  assert.match(viewer, /aria-label="Cerrar imagen"/);
  assert.match(viewer, /<CloseIcon \/>/);
  assert.match(viewer, /top: 'calc\(8px \+ env\(safe-area-inset-top, 0px\)\)'/);
  assert.match(viewer, /right: 'calc\(8px \+ env\(safe-area-inset-right, 0px\)\)'/);
  assert.match(viewer, /onClose=\{onClose\}/);
});
