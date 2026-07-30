import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { generarComplementoPagoPdfDesdeXml } from '../modules/documentos/complemento-pago.pdf';
import { obtenerLogoEmpresaPath } from '../modules/documentos/documentos.pdf';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(
      `SELECT dc.xml_timbrado, dc.estado_sat, dc.cadena_original
         FROM documentos d
         JOIN documentos_cfdi dc ON dc.documento_id = d.id
        WHERE d.id = 177 AND d.empresa_id = 1
          AND d.tipo_documento = 'pago_cliente'
          AND d.serie = 'PCL' AND d.numero = 3
        LIMIT 1`
    );
    if (!rows[0]?.xml_timbrado) throw new Error('PCL-003 no tiene XML timbrado');
    const pdf = await generarComplementoPagoPdfDesdeXml(String(rows[0].xml_timbrado), {
      estadoSat: rows[0].estado_sat,
      cadenaOriginal: rows[0].cadena_original,
      logoPath: await obtenerLogoEmpresaPath(1),
    });
    const output = path.resolve(process.cwd(), 'artifacts', 'PCL-003-complemento-pago.pdf');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, pdf);
    console.log(output);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
