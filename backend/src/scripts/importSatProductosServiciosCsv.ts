import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

type ExportOptions = {
	inputPath: string;
	sheetName: string;
	outputPath: string;
};

const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '..', '.env') });

const OUTPUT_COLUMNS = [
	'id',
	'texto',
	'iva_trasladado',
	'ieps_trasladado',
	'complemento',
	'vigencia_desde',
	'vigencia_hasta',
	'estimulo_frontera',
	'similares',
] as const;

function normalizeKey(value: string) {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: unknown): string {
	return String(value ?? '').replace(/\r?\n/g, ' ').trim();
}

function normalizeCode(value: unknown): string {
	const raw = normalizeText(value);
	if (!raw) return '';
	const digitsOnly = raw.replace(/\D/g, '');
	if (digitsOnly && digitsOnly.length <= 8) {
		return digitsOnly.padStart(8, '0');
	}
	return raw;
}

function normalizeDate(value: unknown): string {
	const raw = normalizeText(value);
	if (!raw) return '';

	const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	if (isoMatch) return isoMatch[1];

	const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashMatch) {
		const [, day, month, year] = slashMatch;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	const parsed = new Date(raw);
	if (!Number.isNaN(parsed.getTime())) {
		const year = parsed.getFullYear();
		const month = String(parsed.getMonth() + 1).padStart(2, '0');
		const day = String(parsed.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	return raw;
}

function csvEscape(value: string) {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function parseArgs(): ExportOptions {
	const argv = process.argv.slice(2);
	const getArg = (name: string, fallback: string) => {
		const index = argv.indexOf(name);
		return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
	};

	const inputPath = getArg('--input', '/Users/antoniodiaz/OneDrive/Emphasys/SAT/Catalogos/catCFDI_V_4_24082022.xls');
	const sheetName = getArg('--sheet', 'c_ClaveProdServ');
	const outputPath = getArg('--output', path.join(projectRoot, 'database', 'tmp', 'sat_productos_servicios.csv'));

	return { inputPath, sheetName, outputPath };
}

function findHeaderRowIndex(rows: unknown[][]) {
	const found = rows.findIndex((row) => normalizeKey(String(row[0] ?? '')) === 'cclaveprodserv');

	if (found >= 0) {
		return found;
	}

	const fallback = rows.findIndex((row) => {
		const normalized = row.map((cell) => normalizeKey(String(cell ?? '')));
		return normalized.includes('descripcion') && normalized.includes('incluirivatrasladado');
	});

	if (fallback < 0) {
		throw new Error('No se pudo ubicar la fila de encabezados en la hoja c_ClaveProdServ');
	}

	return fallback;
}

function resolveColumnIndex(headerRow: unknown[], aliases: string[], target: string) {
	for (let index = 0; index < headerRow.length; index += 1) {
		const normalized = normalizeKey(String(headerRow[index] ?? ''));
		if (!normalized) continue;
		if (aliases.some((alias) => normalized === normalizeKey(alias))) {
			return index;
		}
	}

	throw new Error(`No se encontró la columna requerida: ${target}`);
}

async function main() {
	const { inputPath, sheetName, outputPath } = parseArgs();
	const workbook = XLSX.readFile(inputPath, { cellDates: true });
	const sheet = workbook.Sheets[sheetName];

	if (!sheet) {
		throw new Error(`La hoja ${sheetName} no existe en ${inputPath}`);
	}

	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false, blankrows: false });
	if (rows.length === 0) {
		throw new Error(`La hoja ${sheetName} no contiene filas de datos`);
	}

	const headerRowIndex = findHeaderRowIndex(rows);
	const headerRow = rows[headerRowIndex] ?? [];
	const columns = {
		id: resolveColumnIndex(headerRow, ['c_ClaveProdServ', 'cClaveProdServ'], 'id'),
		texto: resolveColumnIndex(headerRow, ['Descripción', 'Descripcion'], 'texto'),
		iva_trasladado: resolveColumnIndex(headerRow, ['Incluir IVA trasladado'], 'iva_trasladado'),
		ieps_trasladado: resolveColumnIndex(headerRow, ['Incluir IEPS trasladado'], 'ieps_trasladado'),
		complemento: resolveColumnIndex(headerRow, ['Complemento que debe incluir'], 'complemento'),
		vigencia_desde: resolveColumnIndex(headerRow, ['FechaInicioVigencia'], 'vigencia_desde'),
		vigencia_hasta: resolveColumnIndex(headerRow, ['FechaFinVigencia'], 'vigencia_hasta'),
		estimulo_frontera: resolveColumnIndex(headerRow, ['Estímulo Franja Fronteriza', 'Estimulo Franja Fronteriza'], 'estimulo_frontera'),
		similares: resolveColumnIndex(headerRow, ['Palabras similares'], 'similares'),
	};

	const csvRows: string[] = [OUTPUT_COLUMNS.join(',')];
	let exported = 0;

	for (const row of rows.slice(headerRowIndex + 1)) {
		const id = normalizeCode(row[columns.id]);
		const texto = normalizeText(row[columns.texto]);
		if (!id || !texto) continue;

		const values = {
			id,
			texto,
			iva_trasladado: normalizeText(row[columns.iva_trasladado]),
			ieps_trasladado: normalizeText(row[columns.ieps_trasladado]),
			complemento: normalizeText(row[columns.complemento]),
			vigencia_desde: normalizeDate(row[columns.vigencia_desde]),
			vigencia_hasta: normalizeDate(row[columns.vigencia_hasta]),
			estimulo_frontera: normalizeText(row[columns.estimulo_frontera]),
			similares: normalizeText(row[columns.similares]),
		};

		csvRows.push(OUTPUT_COLUMNS.map((column) => csvEscape(values[column])).join(','));
		exported += 1;
	}

	if (exported === 0) {
		throw new Error(`No se generaron filas válidas desde la hoja ${sheetName}`);
	}

	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${csvRows.join('\n')}\n`, { encoding: 'utf-8' });

	console.log(JSON.stringify({ inputPath, sheetName, outputPath, exported }, null, 2));
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});