import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '..', '.env') });

import pool from '../config/database';

// Columnas telefónicas reales de public.contactos (verificado contra el esquema en vivo).
// La tabla NO tiene celular, whatsapp, telefono_movil ni telefono_principal.
const CAMPOS_TELEFONO = ['telefono', 'telefono_secundario'] as const;
type CampoTelefono = (typeof CAMPOS_TELEFONO)[number];

const AUDIT_TABLE = 'public.contactos_telefonos_normalizacion_log';

type Estado = 'vacio' | 'ya_normalizado' | 'cambia' | 'invalido';

type Resultado = {
  estado: Estado;
  normalizado: string | null;
};

function normalizarTelefonoMx(raw: string | null): Resultado {
  if (raw === null || raw.trim() === '') {
    return { estado: 'vacio', normalizado: null };
  }

  const original = raw.trim();
  let limpio = original.replace(/[\s\-().]/g, '');
  if (limpio.startsWith('+')) {
    limpio = limpio.slice(1);
  }

  if (!/^\d+$/.test(limpio)) {
    return { estado: 'invalido', normalizado: null };
  }

  let nacional: string | null = null;
  if (limpio.length === 10) {
    nacional = limpio;
  } else if (limpio.length === 13 && limpio.startsWith('521')) {
    nacional = limpio.slice(3);
  } else if (limpio.length === 12 && limpio.startsWith('52')) {
    nacional = limpio.slice(2);
  } else if (limpio.length === 13 && (limpio.startsWith('044') || limpio.startsWith('045'))) {
    nacional = limpio.slice(3);
  } else if (limpio.length === 12 && limpio.startsWith('01')) {
    nacional = limpio.slice(2);
  }

  // El primer dígito de un número nacional mexicano (LADA) siempre está en el rango 2-9;
  // ningún LADA empieza en 0 o 1. Esto detecta prefijos viejos (01/044/045) mal recortados
  // que de otro modo se colarían como si fueran un número de 10 dígitos ya válido.
  if (!nacional || !/^[2-9]\d{9}$/.test(nacional)) {
    return { estado: 'invalido', normalizado: null };
  }

  const normalizado = `52${nacional}`;
  return { estado: normalizado === original ? 'ya_normalizado' : 'cambia', normalizado };
}

type Args = {
  empresaId: number;
  apply: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);

  const getValue = (flag: string): string | undefined => {
    const eqPrefix = `${flag}=`;
    const eqArg = argv.find((a) => a.startsWith(eqPrefix));
    if (eqArg) return eqArg.slice(eqPrefix.length);

    const idx = argv.indexOf(flag);
    if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];

    return undefined;
  };

  const empresaIdRaw = getValue('--empresa-id');
  if (!empresaIdRaw || !/^\d+$/.test(empresaIdRaw)) {
    throw new Error('Debes indicar --empresa-id=<numero> (obligatorio)');
  }

  const apply = argv.includes('--apply');

  return { empresaId: Number(empresaIdRaw), apply };
}

type Cambio = {
  contactoId: number;
  campo: CampoTelefono;
  antes: string;
  despues: string;
};

type Invalido = {
  contactoId: number;
  campo: CampoTelefono;
  valor: string;
};

async function main() {
  const { empresaId, apply } = parseArgs();

  const empresaResult = await pool.query('SELECT id, nombre FROM core.empresas WHERE id = $1', [empresaId]);
  if (empresaResult.rowCount === 0) {
    throw new Error(`No existe ninguna empresa con id=${empresaId}`);
  }
  const empresaNombre = empresaResult.rows[0].nombre as string;

  const contactosResult = await pool.query(
    `SELECT id, telefono, telefono_secundario FROM public.contactos WHERE empresa_id = $1 ORDER BY id`,
    [empresaId],
  );

  let yaNormalizados = 0;
  const cambios: Cambio[] = [];
  const invalidos: Invalido[] = [];

  for (const row of contactosResult.rows) {
    for (const campo of CAMPOS_TELEFONO) {
      const valorOriginal: string | null = row[campo];
      const { estado, normalizado } = normalizarTelefonoMx(valorOriginal);

      if (estado === 'vacio') continue;

      if (estado === 'ya_normalizado') {
        yaNormalizados += 1;
      } else if (estado === 'cambia' && normalizado) {
        cambios.push({ contactoId: row.id, campo, antes: valorOriginal as string, despues: normalizado });
      } else if (estado === 'invalido') {
        invalidos.push({ contactoId: row.id, campo, valor: (valorOriginal as string).trim() });
      }
    }
  }

  console.log('='.repeat(70));
  console.log(`Normalización de teléfonos — empresa_id=${empresaId} (${empresaNombre})`);
  console.log(`Modo: ${apply ? 'APLICAR CAMBIOS' : 'DRY-RUN (sin escribir en la base de datos)'}`);
  console.log('='.repeat(70));
  console.log(`Contactos revisados:        ${contactosResult.rowCount}`);
  console.log(`Teléfonos que cambiarían:   ${cambios.length}`);
  console.log(`Teléfonos ya normalizados:  ${yaNormalizados}`);
  console.log(`Teléfonos inválidos/dudosos:${' '.repeat(0)} ${invalidos.length}`);
  console.log('');

  if (cambios.length > 0) {
    console.log(`Muestra de cambios (hasta 15 de ${cambios.length}):`);
    for (const c of cambios.slice(0, 15)) {
      console.log(`  contacto ${c.contactoId} · ${c.campo}: "${c.antes}" -> "${c.despues}"`);
    }
    console.log('');
  }

  if (invalidos.length > 0) {
    console.log(`Teléfonos inválidos para revisión manual (hasta 30 de ${invalidos.length}):`);
    for (const inv of invalidos.slice(0, 30)) {
      console.log(`  contacto ${inv.contactoId} · ${inv.campo}: "${inv.valor}"`);
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry-run finalizado. No se modificó nada en la base de datos.');
    console.log(`Para aplicar los cambios: npm run normalize-phones -- --empresa-id=${empresaId} --apply`);
    return;
  }

  if (cambios.length === 0) {
    console.log('No hay cambios que aplicar.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        contacto_id INTEGER NOT NULL,
        campo VARCHAR(30) NOT NULL,
        valor_anterior VARCHAR(30),
        valor_nuevo VARCHAR(30) NOT NULL,
        empresa_id INTEGER NOT NULL,
        fecha TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const c of cambios) {
      await client.query(
        `INSERT INTO ${AUDIT_TABLE} (contacto_id, campo, valor_anterior, valor_nuevo, empresa_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [c.contactoId, c.campo, c.antes, c.despues, empresaId],
      );

      await client.query(
        `UPDATE public.contactos SET ${c.campo} = $1 WHERE id = $2 AND empresa_id = $3`,
        [c.despues, c.contactoId, empresaId],
      );
    }

    await client.query('COMMIT');
    console.log(`Cambios aplicados y registrados en ${AUDIT_TABLE}: ${cambios.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return pool.end();
  });
