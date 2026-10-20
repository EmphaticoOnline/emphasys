/**
 * Análisis del logotipo: servicio (sharp real, PNG en memoria) y endpoint, con
 * `config/database` reemplazado por un pool simulado. No toca la base de datos.
 * Ejecutar: npm --prefix backend run test:identidad-visual
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import type { Request, Response } from "express";

type Consulta = { sql: string; params: unknown[] };
const consultas: Consulta[] = [];
let logo: { id: number; ruta: string } | null = null;
let filaPrevia: Record<string, unknown> | null = null;

function responder(sql: string, params: unknown[] = []) {
  consultas.push({ sql, params });
  const texto = sql.replace(/\s+/g, " ");
  if (texto.includes("FROM core.empresas_assets")) return { rows: logo ? [{ ...logo, empresa_id: params[0], tipo: "logo_default", activo: true }] : [] };
  if (texto.includes("INSERT INTO core.empresas_identidad_visual")) {
    const [empresa_id, propuesta_primario, propuesta_acento, propuesta_sidebar, propuesta_estado, propuesta_confianza, detalle, propuesta_asset_id, propuesta_algoritmo_version] = params;
    const fila = {
      color_primario: null, color_acento: null, color_sidebar: null,
      origen_primario: "emphasys", origen_acento: "emphasys", origen_sidebar: "emphasys",
      actualizado_por: null, created_at: "c", updated_at: "u",
      ...filaPrevia,
      empresa_id, propuesta_primario, propuesta_acento, propuesta_sidebar, propuesta_estado,
      propuesta_confianza: String(propuesta_confianza), propuesta_detalle: JSON.parse(detalle as string),
      propuesta_asset_id, propuesta_algoritmo_version, propuesta_generada_at: "ahora",
    };
    return { rows: [fila] };
  }
  if (texto.includes("FROM core.empresas")) return { rows: params[0] === 3 ? [{ id: 3, identificador: "emp3" }] : [] };
  throw new Error(`Consulta no simulada: ${texto}`);
}

const rutaDatabase = require.resolve(path.join(__dirname, "../src/config/database"));
require.cache[rutaDatabase] = {
  id: rutaDatabase, filename: rutaDatabase, loaded: true,
  exports: { __esModule: true, default: { query: async (sql: string, params?: unknown[]) => responder(sql, params) } },
} as unknown as NodeModule;

/* eslint-disable @typescript-eslint/no-var-requires */
const servicio = require("../src/services/empresasIdentidadVisualAnalisisService") as typeof import("../src/services/empresasIdentidadVisualAnalisisService");
const controlador = require("../src/controllers/empresasIdentidadVisualController") as typeof import("../src/controllers/empresasIdentidadVisualController");

/** PNG de 120×80: fondo blanco, bloque rojo grande y bloque azul chico. */
async function pngDosColores(): Promise<Buffer> {
  const w = 120, h = 80;
  const raw = Buffer.alloc(w * h * 4, 255);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = (y * w + x) * 4;
    if (x >= 10 && x < 70 && y >= 10 && y < 70) raw.set([200, 16, 46, 255], i);
    else if (x >= 80 && x < 110 && y >= 20 && y < 60) raw.set([21, 101, 192, 255], i);
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
const pngGris = () => sharp({ create: { width: 60, height: 60, channels: 4, background: { r: 90, g: 90, b: 90, alpha: 1 } } }).png().toBuffer();

const escrituras = () => consultas.filter((c) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(c.sql));
const columnasEscritas = (sql: string) => sql.split(/RETURNING/i)[0]!;

function reiniciar() {
  consultas.length = 0;
  logo = { id: 41, ruta: "/uploads/empresas/emp3/logo.png" };
  filaPrevia = null;
}

test("analiza un PNG real con sharp y guarda solo la propuesta", async () => {
  reiniciar();
  const png = await pngDosColores();
  const r = await servicio.analizarLogoEmpresa(3, async () => png);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.identidad.propuesta_estado, "ok");
  assert.match(String(r.identidad.propuesta_primario), /^#[0-9a-f]{6}$/);
  assert.equal(r.identidad.propuesta_asset_id, 41);
  const [insert] = escrituras();
  assert.ok(insert);
  assert.doesNotMatch(columnasEscritas(insert.sql), /color_|origen_|actualizado_por/, "no escribe colores aprobados ni su origen");
  assert.match(insert.sql, /ON CONFLICT \(empresa_id\) DO UPDATE/);
});

test("nunca sobrescribe colores personalizados: la fila conserva sus colores manuales", async () => {
  reiniciar();
  filaPrevia = { color_primario: "#7a1f2b", origen_primario: "manual" };
  const r = await servicio.analizarLogoEmpresa(3, async () => pngDosColores());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.identidad.color_primario, "#7a1f2b");
  assert.equal(r.identidad.origen_primario, "manual");
  assert.notEqual(r.identidad.propuesta_primario, null);
});

test("logo sin colores útiles queda como 'sin_colores_utiles' sin colores propuestos", async () => {
  reiniciar();
  const r = await servicio.analizarLogoEmpresa(3, async () => pngGris());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.identidad.propuesta_estado, "sin_colores_utiles");
  assert.equal(r.identidad.propuesta_primario, null);
  assert.equal(Number(r.identidad.propuesta_confianza), 0);
});

test("un archivo ilegible se registra como 'error' y no lanza", async () => {
  reiniciar();
  const r = await servicio.analizarLogoEmpresa(3, async () => Buffer.from("no es una imagen"));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.identidad.propuesta_estado, "error");
  assert.equal(r.identidad.propuesta_primario, null);
  assert.equal(typeof (r.identidad.propuesta_detalle as { motivo?: unknown }).motivo, "string");
});

test("sin logo_default no analiza ni escribe", async () => {
  reiniciar();
  logo = null;
  assert.deepEqual(await servicio.analizarLogoEmpresa(3), { ok: false, motivo: "sin_logo" });
  assert.deepEqual(escrituras(), []);
});

test("la ruta del asset no puede salir del directorio de uploads", () => {
  const raiz = "/srv/emphasys/uploads";
  assert.equal(servicio.rutaAbsolutaAsset("/uploads/empresas/emp3/logo.png", raiz), "/srv/emphasys/uploads/empresas/emp3/logo.png");
  assert.equal(servicio.rutaAbsolutaAsset("/uploads/../../etc/passwd", raiz), null);
  assert.equal(servicio.rutaAbsolutaAsset("/uploads/", raiz), null);
});

async function llamar(auth: { userId: number; esSuperadmin: boolean } | undefined, empresaId: string) {
  const salida: { status: number; body: any } = { status: 200, body: undefined };
  const res = { status(c: number) { salida.status = c; return this; }, json(b: unknown) { salida.body = b; return this; } } as unknown as Response;
  await controlador.analizarIdentidadVisualController({ auth: auth && { email: "x", ...auth }, params: { empresa_id: empresaId } } as unknown as Request, res);
  return salida;
}

test("POST analizar: solo superadmin; 404 sin empresa o sin logo; nada se escribe si se rechaza", async () => {
  reiniciar();
  assert.equal((await llamar({ userId: 7, esSuperadmin: false }, "3")).status, 403);
  assert.equal((await llamar(undefined, "3")).status, 401);
  assert.equal((await llamar({ userId: 1, esSuperadmin: true }, "99")).status, 404);
  logo = null;
  assert.equal((await llamar({ userId: 1, esSuperadmin: true }, "3")).status, 404);
  assert.deepEqual(escrituras(), []);
});

test("subir un logo_default dispara el análisis en segundo plano sin bloquear la subida", () => {
  const fuente = readFileSync(path.join(__dirname, "../src/controllers/empresasController.ts"), "utf8");
  assert.match(fuente, /if \(tipo === "logo_default"\) \{[\s\S]*?void analizarLogoEmpresa\(empresaId\)\.catch\(/);
  const subida = fuente.slice(fuente.indexOf("export async function subirAssetEmpresaController"));
  assert.ok(subida.indexOf("void analizarLogoEmpresa") < subida.indexOf("return res.status(201).json(asset)"));
});
