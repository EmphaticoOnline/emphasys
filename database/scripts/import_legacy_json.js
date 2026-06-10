/**
 * Importa clientes.json y productos.json desde C:\temp\ a tablas staging en PostgreSQL.
 *
 * Uso:
 *   node database/scripts/import_legacy_json.js
 *
 * Variables de entorno: se leen de backend/.env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Cargar .env del backend manualmente (sin depender de dotenv global)
// ---------------------------------------------------------------------------
const envPath = path.join(__dirname, '..', '..', 'backend', '.env');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// 2. Cargar pg desde node_modules del backend
// ---------------------------------------------------------------------------
const pgPath = path.join(__dirname, '..', '..', 'backend', 'node_modules', 'pg');
const { Pool } = require(pgPath);

// ---------------------------------------------------------------------------
// 3. Configuración
// ---------------------------------------------------------------------------
const FILES = {
  clientes:  'C:\\temp\\clientes.json',
  productos: 'C:\\temp\\productos.json',
};

const TABLES = {
  clientes:  'migrate.clientes_legacy_supplier_json',
  productos: 'migrate.productos_legacy_supplier_json',
};

const BATCH_SIZE = 500;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const raw  = fs.readFileSync(filePath, 'latin1');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`El archivo ${filePath} no contiene un arreglo JSON en el nivel raíz.`);
  }
  return data;
}

async function truncateTable(client, table) {
  await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY`);
}

async function insertBatches(client, table, records) {
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // Construye: INSERT INTO t (data) VALUES ($1),($2),...
    const placeholders = batch.map((_, idx) => `($${idx + 1})`).join(', ');
    const values       = batch.map(r => JSON.stringify(r));

    await client.query(
      `INSERT INTO ${table} (data) VALUES ${placeholders}`,
      values
    );

    inserted += batch.length;
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------
async function main() {
  const client = await pool.connect();

  try {
    // Crear schema y tablas si no existen
    await client.query(`CREATE SCHEMA IF NOT EXISTS migrate`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS migrate.clientes_legacy_supplier_json (
        id               bigserial PRIMARY KEY,
        data             jsonb NOT NULL,
        fecha_importacion timestamptz DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS migrate.productos_legacy_supplier_json (
        id               bigserial PRIMARY KEY,
        data             jsonb NOT NULL,
        fecha_importacion timestamptz DEFAULT now()
      )
    `);

    await client.query('BEGIN');

    for (const [key, filePath] of Object.entries(FILES)) {
      const table = TABLES[key];

      console.log(`\n[${key}] Leyendo ${filePath}...`);
      const records = readJsonArray(filePath);
      console.log(`[${key}] ${records.length} registros leídos.`);

      console.log(`[${key}] Vaciando ${table}...`);
      await truncateTable(client, table);

      console.log(`[${key}] Insertando en lotes de ${BATCH_SIZE}...`);
      const inserted = await insertBatches(client, table, records);

      console.log(`[${key}] Importados: ${inserted} registros → ${table}`);
    }

    await client.query('COMMIT');
    console.log('\nImportación completada exitosamente.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError durante la importación (se hizo ROLLBACK):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
