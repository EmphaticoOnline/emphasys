import * as pdfModule from './src/modules/documentos/documentos.pdf';
import * as plantillasService from './src/modules/plantillas/plantillas.service';

// Mock the service to avoid database connection
(plantillasService as any).obtenerPlantillaParaDocumento = async () => null;

async function run() {
  const documentoBase = {
    tipo_documento: 'orden_servicio',
    fecha_documento: '2023-10-27',
    cliente_nombre: 'Cliente de Prueba',
    nombre_receptor: 'Cliente de Prueba',
    subtotal: 1000,
    iva: 160,
    total: 1160,
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
    // 1 Page
    console.log('Generando 1 página...');
    const pdf1 = await pdfModule.generarDocumentoPDF({ documento: documentoBase, partidas: [partidaBase] }, 1);
    require('fs').writeFileSync('/tmp/os-mock-1page.pdf', pdf1);
    console.log('Generado: /tmp/os-mock-1page.pdf');

    // Multi Page (50 partidas)
    console.log('Generando multipágina...');
    const partidas50 = Array(50).fill(null).map((_, i) => ({
        ...partidaBase,
        producto_clave: `PROD-${(i+1).toString().padStart(2, '0')}`
    }));
    const pdfMulti = await pdfModule.generarDocumentoPDF({
        documento: { ...documentoBase, folio: 'TEST-MULTI' },
        partidas: partidas50
    }, 1);
    require('fs').writeFileSync('/tmp/os-mock-multipage.pdf', pdfMulti);
    console.log('Generado: /tmp/os-mock-multipage.pdf');
    
    console.log('PDFs generados con éxito.');
  } catch (err) {
    console.error('Error al generar PDFs:', err);
    process.exit(1);
  }
}

run();
