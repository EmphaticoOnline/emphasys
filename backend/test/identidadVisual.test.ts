/**
 * Identidad visual por empresa (E3): contraste, regla de origen y endpoints.
 * No toca la base de datos: `config/database` se reemplaza por un pool simulado
 * antes de cargar el controlador.
 *
 * Ejecutar: npm --prefix backend run test:identidad-visual
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { Request, Response } from "express";

// ── Pool simulado ─────────────────────────────────────────────────────────────

type Consulta = { sql: string; params: unknown[] };
type Estado = {
  empresas: number[];
  miembros: Array<[usuarioId: number, empresaId: number]>;
  identidad: Record<number, Record<string, unknown>>;
};

const consultas: Consulta[] = [];
let estado: Estado = { empresas: [], miembros: [], identidad: {} };

function responder(sql: string, params: unknown[] = []) {
  consultas.push({ sql, params });
  const texto = sql.replace(/\s+/g, " ");
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(texto.trim())) return { rows: [] };
  if (texto.includes("FROM core.usuarios_empresas")) {
    const [usuarioId, empresaId] = params as number[];
    const es = estado.miembros.some(([u, e]) => u === usuarioId && e === empresaId);
    return { rows: es ? [{ id: empresaId, identificador: `emp${empresaId}`, nombre: "Demo" }] : [] };
  }
  if (texto.includes("FROM core.empresas_identidad_visual")) {
    const fila = estado.identidad[params[0] as number];
    return { rows: fila ? [fila] : [] };
  }
  if (texto.includes("INSERT INTO core.empresas_identidad_visual")) {
    const [empresaId, primario, acento, sidebar, superficie, modo, oPrimario, oAcento, oSidebar, usuario] = params;
    const previa = estado.identidad[empresaId as number] ?? {};
    const fila = {
      ...filaVacia(empresaId as number),
      ...previa,
      color_primario: primario,
      color_acento: acento,
      color_sidebar: sidebar,
      color_superficie_secundaria: superficie,
      modo,
      origen_primario: oPrimario,
      origen_acento: oAcento,
      origen_sidebar: oSidebar,
      actualizado_por: usuario,
      updated_at: "2026-10-20T12:00:00.000Z",
    };
    estado.identidad[empresaId as number] = fila;
    return { rows: [fila] };
  }
  if (texto.includes("FROM core.empresas")) {
    const id = params[0] as number;
    return { rows: estado.empresas.includes(id) ? [{ id, identificador: `emp${id}`, nombre: "Demo" }] : [] };
  }
  throw new Error(`Consulta no simulada: ${texto}`);
}

const poolSimulado = {
  query: async (sql: string, params?: unknown[]) => responder(sql, params),
  connect: async () => ({ query: async (sql: string, params?: unknown[]) => responder(sql, params), release: () => {} }),
};

const rutaDatabase = require.resolve(path.join(__dirname, "../src/config/database"));
require.cache[rutaDatabase] = {
  id: rutaDatabase,
  filename: rutaDatabase,
  loaded: true,
  exports: { __esModule: true, default: poolSimulado },
} as unknown as NodeModule;

// Se cargan después del reemplazo del pool.
/* eslint-disable @typescript-eslint/no-var-requires */
const contraste = require("../src/shared/identidadVisual/contraste") as typeof import("../src/shared/identidadVisual/contraste");
const cambios = require("../src/shared/identidadVisual/cambios") as typeof import("../src/shared/identidadVisual/cambios");
const controlador = require("../src/controllers/empresasIdentidadVisualController") as typeof import("../src/controllers/empresasIdentidadVisualController");

function filaVacia(empresaId: number): Record<string, unknown> {
  return {
    empresa_id: empresaId,
    color_primario: null,
    color_acento: null,
    color_sidebar: null,
    color_superficie_secundaria: null,
    modo: "emphasys",
    origen_primario: "emphasys",
    origen_acento: "emphasys",
    origen_sidebar: "emphasys",
    propuesta_primario: null,
    propuesta_acento: null,
    propuesta_sidebar: null,
    propuesta_estado: null,
    propuesta_confianza: null,
    propuesta_detalle: null,
    propuesta_asset_id: null,
    propuesta_algoritmo_version: null,
    propuesta_generada_at: null,
    actualizado_por: null,
    created_at: "2026-10-20T10:00:00.000Z",
    updated_at: "2026-10-20T10:00:00.000Z",
  };
}

const CON_PROPUESTA = {
  propuesta_primario: "#8a2433",
  propuesta_acento: "#0f6b5e",
  propuesta_sidebar: "#2a1d22",
  propuesta_estado: "ok",
  propuesta_confianza: "0.820",
  propuesta_detalle: { candidatos: 4 },
  propuesta_asset_id: 41,
  propuesta_algoritmo_version: 1,
  propuesta_generada_at: "2026-10-20T09:00:00.000Z",
};

async function llamar(
  handler: (req: Request, res: Response) => Promise<unknown>,
  opciones: { auth?: { userId: number; esSuperadmin: boolean }; empresaId: string; body?: unknown }
) {
  const salida: { status: number; body: any } = { status: 200, body: undefined };
  const req = {
    auth: opciones.auth ? { email: "e3@prueba.test", ...opciones.auth } : undefined,
    params: { empresa_id: opciones.empresaId },
    body: opciones.body,
  } as unknown as Request;
  const res = {
    status(code: number) {
      salida.status = code;
      return this;
    },
    json(body: unknown) {
      salida.body = body;
      return this;
    },
  } as unknown as Response;
  await handler(req, res);
  return salida;
}

function reiniciar(parcial: Partial<Estado> = {}) {
  consultas.length = 0;
  estado = { empresas: [3], miembros: [[7, 3]], identidad: {}, ...parcial };
}

const SUPER = { userId: 1, esSuperadmin: true };
const USUARIO = { userId: 7, esSuperadmin: false };
/** Sentencias de escritura (por su verbo inicial; `FOR UPDATE` y `updated_at` no cuentan). */
const escrituras = () => consultas.filter((c) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(c.sql));

// ── Contraste ─────────────────────────────────────────────────────────────────

test("contraste: la identidad de Emphasys cumple todas las reglas", () => {
  assert.deepEqual(contraste.validarContraste(contraste.IDENTIDAD_EMPHASYS), []);
  const { razonContraste, FONDOS_REFERENCIA, IDENTIDAD_EMPHASYS } = contraste;
  assert.equal(Math.round(razonContraste("#ffffff", IDENTIDAD_EMPHASYS.primario) * 100) / 100, 12.66);
  assert.equal(Math.round(razonContraste(FONDOS_REFERENCIA.marfil, IDENTIDAD_EMPHASYS.sidebar) * 100) / 100, 11.5);
  assert.equal(Math.round(razonContraste(IDENTIDAD_EMPHASYS.acento, FONDOS_REFERENCIA.beige) * 100) / 100, 6.33);
});

test("contraste: razón WCAG en los extremos y simétrica", () => {
  assert.equal(contraste.razonContraste("#ffffff", "#000000"), 21);
  assert.equal(contraste.razonContraste("#000000", "#ffffff"), 21);
  assert.equal(contraste.razonContraste("#777777", "#777777"), 1);
});

test("contraste: solo el acento (texto sobre claro) se valida; primario y sidebar son fondos con texto automático", () => {
  const errores = contraste.validarContraste({ primario: "#ffd84d", acento: "#7fd0c8", sidebar: "#cccccc" });
  assert.deepEqual(
    errores.map((e) => `${e.color}/${e.contra}`),
    ["acento/blanco", "acento/marfil", "acento/beige"]
  );
  for (const error of errores) {
    assert.ok(error.ratio < error.minimo);
    assert.equal(error.minimo, 4.5);
  }
  assert.deepEqual(contraste.validarContraste({ primario: null }), []);
});

test("contraste: texto automático AA sobre cualquier fondo; Emphasys conserva sus textos", () => {
  for (const fondo of ["#b47716", "#808080", "#ffd84d", "#777777", "#000000", "#ffffff"]) {
    for (const texto of [contraste.textoSobrePrimario(fondo), contraste.textoSobreSidebar(fondo), contraste.textoSobreSuperficieSecundaria(fondo)]) {
      assert.ok(contraste.razonContraste(fondo, texto) >= 4.5, `${fondo} → ${texto}`);
    }
  }
  assert.equal(contraste.textoSobrePrimario("#1d2f68"), "#ffffff");
  assert.equal(contraste.textoSobreSidebar("#2c3344"), "#f7f4ee");
  assert.equal(contraste.textoSobreSuperficieSecundaria("#3c4149"), "#f4f0e8");
  assert.deepEqual(contraste.validarContraste({ primario: "#b47716", sidebar: "#b47716" }), []);
});

test("contraste: normalizarHex solo acepta #RRGGBB y lo pasa a minúsculas", () => {
  assert.equal(contraste.normalizarHex("#7A1F2B"), "#7a1f2b");
  assert.equal(contraste.normalizarHex("  #7a1f2b "), "#7a1f2b");
  for (const malo of ["7a1f2b", "#7a1f2", "#7a1f2bff", "#fff", "rgb(1,2,3)", "#gg0000", 123, null, undefined]) {
    assert.equal(contraste.normalizarHex(malo), null, String(malo));
  }
});

// ── Regla de origen y confirmación ───────────────────────────────────────────

const VIGENTES = {
  colores: { primario: "#7a1f2b", acento: "#0f6b5e", sidebar: null },
  origen: { primario: "manual", acento: "analisis", sidebar: "emphasys" },
  propuesta: { primario: "#8a2433", acento: "#0f6b5e", sidebar: "#2a1d22" },
} as const;

test("origen: lo decide el servidor (null → emphasys, propuesta → analisis, otro → manual)", () => {
  const r = cambios.aplicarCambios(cambios.VIGENTES_EMPHASYS, { primario: "#123456" }, false);
  assert.ok(r.ok);
  assert.deepEqual(r.origen, { primario: "manual", acento: "emphasys", sidebar: "emphasys" });

  const conPropuesta = { ...VIGENTES, colores: { ...VIGENTES.colores }, origen: { ...VIGENTES.origen } };
  const r2 = cambios.aplicarCambios(conPropuesta, { sidebar: "#2a1d22", acento: null }, false);
  assert.ok(r2.ok);
  assert.deepEqual(r2.colores, { primario: "#7a1f2b", acento: null, sidebar: "#2a1d22" });
  assert.deepEqual(r2.origen, { primario: "manual", acento: "emphasys", sidebar: "analisis" });
  assert.deepEqual(r2.cambiados, ["sidebar", "acento"]);
});

test("confirmación: cambiar un color manual sin confirmar no aplica nada (409)", () => {
  const sinConfirmar = cambios.aplicarCambios({ ...VIGENTES } as never, { primario: "#8a2433", sidebar: "#2a1d22" }, false);
  assert.deepEqual(sinConfirmar, { ok: false, conflictos: ["primario"] });
  const volverAEmphasys = cambios.aplicarCambios({ ...VIGENTES } as never, { primario: null }, false);
  assert.deepEqual(volverAEmphasys, { ok: false, conflictos: ["primario"] });

  const confirmado = cambios.aplicarCambios({ ...VIGENTES } as never, { primario: "#8a2433" }, true);
  assert.ok(confirmado.ok);
  assert.equal(confirmado.origen.primario, "analisis");
});

test("confirmación: un valor igual al vigente no cuenta como cambio ni pide confirmar", () => {
  const r = cambios.aplicarCambios({ ...VIGENTES } as never, { primario: "#7a1f2b" }, false);
  assert.ok(r.ok);
  assert.deepEqual(r.cambiados, []);
  assert.equal(r.origen.primario, "manual");
});

// ── GET ───────────────────────────────────────────────────────────────────────

test("GET: sin fila responde la identidad de Emphasys (200)", async () => {
  reiniciar();
  const r = await llamar(controlador.obtenerIdentidadVisualController, { auth: USUARIO, empresaId: "3" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, {
    empresa_id: 3,
    colores: { primario: null, acento: null, sidebar: null },
    origen: { primario: "emphasys", acento: "emphasys", sidebar: "emphasys" },
    propuesta: null,
    updated_at: null,
    actualizado_por: null,
  });
  assert.deepEqual(escrituras(), []);
});

test("GET: un usuario de otra empresa recibe 403; id inválido 400; sin sesión 401", async () => {
  reiniciar();
  assert.equal((await llamar(controlador.obtenerIdentidadVisualController, { auth: { userId: 8, esSuperadmin: false }, empresaId: "3" })).status, 403);
  assert.equal((await llamar(controlador.obtenerIdentidadVisualController, { auth: USUARIO, empresaId: "abc" })).status, 400);
  assert.equal((await llamar(controlador.obtenerIdentidadVisualController, { empresaId: "3" })).status, 401);
  assert.equal((await llamar(controlador.obtenerIdentidadVisualController, { auth: SUPER, empresaId: "99" })).status, 404);
});

test("GET: el detalle técnico de la propuesta solo lo ve el superadministrador", async () => {
  reiniciar({ identidad: { 3: { ...filaVacia(3), ...CON_PROPUESTA } } });
  const usuario = await llamar(controlador.obtenerIdentidadVisualController, { auth: USUARIO, empresaId: "3" });
  assert.equal(usuario.status, 200);
  assert.equal(usuario.body.propuesta.confianza, 0.82);
  assert.equal("detalle" in usuario.body.propuesta, false);

  const superadmin = await llamar(controlador.obtenerIdentidadVisualController, { auth: SUPER, empresaId: "3" });
  assert.deepEqual(superadmin.body.propuesta.detalle, { candidatos: 4 });
});

// ── PUT ───────────────────────────────────────────────────────────────────────

test("PUT: solo el superadministrador puede modificar (403)", async () => {
  reiniciar();
  const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: USUARIO, empresaId: "3", body: { colores: { primario: "#7a1f2b" } } });
  assert.equal(r.status, 403);
  assert.deepEqual(consultas, []);
});

test("PUT: valida el cuerpo antes de consultar la base (400)", async () => {
  for (const body of [
    undefined,
    { colores: [] },
    { colores: {} },
    { colores: { fondo: "#000000" } },
    { colores: { primario: "#12345" } },
    { colores: { primario: "#7a1f2b" }, confirmarSobrescritura: "si" },
  ]) {
    reiniciar();
    const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: SUPER, empresaId: "3", body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(typeof r.body.message, "string");
    assert.deepEqual(consultas, [], JSON.stringify(body));
  }
});

test("PUT: rechaza acento sin contraste con el detalle por color (400)", async () => {
  reiniciar();
  const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: SUPER, empresaId: "3", body: { colores: { acento: "#7FD0C8" } } });
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.errores.map((e: { color: string; contra: string }) => `${e.color}/${e.contra}`), ["acento/blanco", "acento/marfil", "acento/beige"]);
  assert.deepEqual(consultas, []);
});

test("PUT: empresa inexistente 404", async () => {
  reiniciar();
  const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: SUPER, empresaId: "99", body: { colores: { primario: "#7a1f2b" } } });
  assert.equal(r.status, 404);
  assert.deepEqual(escrituras(), []);
});

test("PUT: guarda normalizado, con origen del servidor, usuario y transacción", async () => {
  reiniciar({ identidad: { 3: { ...filaVacia(3), ...CON_PROPUESTA } } });
  const r = await llamar(controlador.actualizarIdentidadVisualController, {
    auth: SUPER,
    empresaId: "3",
    body: { colores: { primario: "#7A1F2B", sidebar: "#2A1D22" } },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.colores, { primario: "#7a1f2b", acento: null, sidebar: "#2a1d22" });
  assert.deepEqual(r.body.origen, { primario: "manual", acento: "emphasys", sidebar: "analisis" });
  assert.equal(r.body.actualizado_por, 1);
  assert.deepEqual(r.body.propuesta.detalle, { candidatos: 4 });

  const sqls = consultas.map((c) => c.sql.replace(/\s+/g, " ").trim());
  const inicio = sqls.indexOf("BEGIN");
  assert.ok(inicio >= 0);
  assert.match(sqls[inicio + 1]!, /FOR UPDATE$/);
  assert.match(sqls[inicio + 2]!, /^INSERT INTO core\.empresas_identidad_visual .* ON CONFLICT \(empresa_id\) DO UPDATE .* updated_at = now\(\)/);
  assert.equal(sqls[inicio + 3], "COMMIT");
  assert.deepEqual(escrituras()[0]!.params, [3, "#7a1f2b", null, "#2a1d22", null, "emphasys", "manual", "emphasys", "analisis", 1, "automatico"]);
  // Lo que escribe (antes de RETURNING) no toca la propuesta; RETURNING sí la lee.
  assert.doesNotMatch(sqls[inicio + 2]!.split(" RETURNING ")[0]!, /propuesta_/, "el PUT no escribe la propuesta");
});

test("PUT: sobrescribir un color manual sin confirmar responde 409 y no escribe", async () => {
  reiniciar({ identidad: { 3: { ...filaVacia(3), color_primario: "#7a1f2b", origen_primario: "manual" } } });
  const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: SUPER, empresaId: "3", body: { colores: { primario: null } } });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.conflictos, ["primario"]);
  assert.deepEqual(escrituras(), []);
  assert.ok(consultas.some((c) => c.sql === "ROLLBACK"));

  reiniciar({ identidad: { 3: { ...filaVacia(3), color_primario: "#7a1f2b", origen_primario: "manual" } } });
  const confirmado = await llamar(controlador.actualizarIdentidadVisualController, {
    auth: SUPER,
    empresaId: "3",
    body: { colores: { primario: null }, confirmarSobrescritura: true },
  });
  assert.equal(confirmado.status, 200);
  assert.deepEqual(confirmado.body.colores, { primario: null, acento: null, sidebar: null });
  assert.equal(confirmado.body.origen.primario, "emphasys");
});

test("PUT: si nada cambia no crea ni modifica la fila", async () => {
  reiniciar();
  const r = await llamar(controlador.actualizarIdentidadVisualController, { auth: SUPER, empresaId: "3", body: { colores: { primario: null } } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.colores, { primario: null, acento: null, sidebar: null });
  assert.deepEqual(escrituras(), []);
});
