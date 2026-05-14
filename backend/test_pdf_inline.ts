const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request.includes('../../config/database')) {
    return { query: async () => ({ rows: [] }), pool: { query: async () => ({ rows: [] }) } };
  }
  if (request.includes('/plantillas.service')) {
    return { obtenerPlantillaParaDocumento: async () => null };
  }
  if (request.includes('/generarCadenaQR')) {
    return { generarImagenQR: async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', DatosQrCfdi: class {} };
  }
  return originalLoad.apply(this, arguments);
};

import * as pdfModule from './src/modules/documentos/documentos.pdf';
import * as fs from 'fs';

async function run() {
  const documentoBase = {
    tipo_documento: 'orden_servicio',
    fecha_documento: '2023-10-27',
    cliente_nombre: 'Cliente de Prueba',
    nombre_receptor: 'Cliente de Prueba',
    subtotal: 1000,
    iva: 160,
    total: 1160,
    moneda: 'MXN',
    observaciones: '',
    empresa_id: 1,
    folio: 'TEST-001'
  };

  const partidaBase = {
    producto_clave: 'PROD-01',
    descripcion_alterna: 'Descripción del producto de prueba',
    cantidad: 1,
    precio_unitario: 1000,
    subtotal_partida: 1000
  };

  try {
    console.log('Generando 1 página...');
    const pdf1 = await pdfModule.generarDocumentoPDF({ documento: documentoBase, partidas: [partidaBase] }, 1);
    fs.writeFileSync('/tmp/os-mock-1page.pdf', pdf1);

    console.log('Generando multipágina...');
    const partidas60 = Array(60).fill(null).map((_, i) => ({
        ...partidaBase,
        producto_clave: `PROD-${(i+1).toString().padStart(2, '0')}`
    }));
    const pdfMulti = await pdfModule.generarDocumentoPDF({
        documento: { ...documentoBase, folio: 'TEST-MULTI' },
        partidas: partidas60
    }, 1);
    fs.writeFileSync('/tmp/os-mock-multipage.pdf', pdfMulti);
    
    console.log('SUCCESS');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
