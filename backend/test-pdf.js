const { generarDocumentoPDF } = require('./dist/modules/documentos/documentos.pdf.js');
const fs = require('fs');

async function run() {
  const mockData = {
    tipo_documento: 'orden_servicio',
    cabecera: {
      numero: '12345',
      fecha: '2023-10-27',
      proveedor: 'Proveedor Mock',
      solicitante: 'Solicitante Mock',
      proyecto: 'Proyecto Mock',
      nota: 'Nota Mock'
    },
    partidas: [
      {
        posicion: 1,
        cantidad: 10,
        unidad: 'PZ',
        descripcion: 'Partida de prueba 1',
        precioUnitario: 100,
        importe: 1000
      }
    ]
  };

  try {
    // Corrected parameter order based on grep: (data, empresaId)
    const pdfBuffer = await generarDocumentoPDF(mockData, 1);
    fs.writeFileSync('/tmp/os-mock.pdf', pdfBuffer);
    console.log('PDF generated successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    process.exit(1);
  }
}

run();
