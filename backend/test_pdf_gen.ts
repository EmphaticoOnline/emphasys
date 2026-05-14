import { generarDocumentoPDF } from './src/modules/documentos/documentos.pdf';
import * as fs from 'fs';

async function run() {
    const commonData = {
        empresa_id: 1,
        folio: "123",
        fecha: "2023-10-27",
        cliente_nombre: "Cliente de Prueba",
        tipo_documento: 'orden_servicio'
    };

    const data1 = {
        ...commonData,
        conceptos: [{ descripcion: "Item 1", cantidad: 1, precio_unitario: 100, importe: 100 }]
    };
    // @ts-ignore
    const pdf1 = await generarDocumentoPDF(data1);
    fs.writeFileSync('/tmp/os-mock-1page.pdf', pdf1);

    const dataMulti = {
        ...commonData,
        conceptos: Array.from({ length: 50 }, (_, i) => ({
            descripcion: `Item multipagina numero ${i}`,
            cantidad: 1,
            precio_unitario: 100,
            importe: 100
        }))
    };
    // @ts-ignore
    const pdfMulti = await generarDocumentoPDF(dataMulti);
    fs.writeFileSync('/tmp/os-mock-multipage.pdf', pdfMulti);
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
