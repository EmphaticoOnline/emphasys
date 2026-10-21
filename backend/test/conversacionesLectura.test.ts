/**
 * Marcado de lectura de conversaciones de WhatsApp (POST /conversaciones/:id/leer).
 * Regresión: un usuario con rol Administrador que además es el vendedor
 * asignado nunca registraba la lectura, así que su contador no bajaba.
 *
 * No toca la base de datos: `config/database` se reemplaza por un pool simulado
 * antes de cargar el controlador. El INSERT simulado evalúa las condiciones
 * reales del WHERE (`ct.vendedor_id = $n`, `$n = false`), de modo que cualquier
 * condición extra que vuelva a bloquear a un perfil hace fallar la prueba.
 *
 * Ejecutar: npm --prefix backend run test:conversaciones-lectura
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { Request, Response } from "express";

// ── Pool simulado ─────────────────────────────────────────────────────────────

const EMPRESA = 2;

type Usuario = { id: number; es_superadmin: boolean; vendedor_contacto_id: number | null; roles: string[] };
type Lectura = { empresa_id: number; usuario_id: number; conversacion_id: number };

const usuarios: Record<number, Usuario> = {
  // Administrador y vendedor asignado (caso de Ernesto).
  2: { id: 2, es_superadmin: false, vendedor_contacto_id: 18, roles: ["Administrador"] },
  // Administrador sin ser el vendedor asignado de la conversación.
  3: { id: 3, es_superadmin: false, vendedor_contacto_id: 17, roles: ["Administrador"] },
  // Vendedor normal.
  10: { id: 10, es_superadmin: false, vendedor_contacto_id: 19, roles: ["Vendedor"] },
  // Superadmin sin contacto de vendedor.
  99: { id: 99, es_superadmin: true, vendedor_contacto_id: null, roles: [] },
};

// conversacion_id → vendedor_id del contacto
const conversaciones: Record<number, { empresa_id: number; vendedor_id: number | null }> = {
  500: { empresa_id: EMPRESA, vendedor_id: 18 },
  501: { empresa_id: EMPRESA, vendedor_id: 19 },
  502: { empresa_id: 7, vendedor_id: 18 },
};

let lecturas: Lectura[] = [];

function evaluarInsertLectura(sql: string, params: unknown[]) {
  const [empresaId, usuarioId, conversacionId] = params as number[];
  const conv = conversaciones[conversacionId];
  if (!conv || conv.empresa_id !== empresaId) return { rows: [], rowCount: 0 };
  const where = sql.slice(sql.indexOf("WHERE"), sql.indexOf("ON CONFLICT"));
  for (const [, idx] of where.matchAll(/ct\.vendedor_id = \$(\d+)/g)) {
    if (conv.vendedor_id === null || conv.vendedor_id !== params[Number(idx) - 1]) return { rows: [], rowCount: 0 };
  }
  for (const [, idx] of where.matchAll(/\$(\d+) = false/g)) {
    if (params[Number(idx) - 1] !== false) return { rows: [], rowCount: 0 };
  }
  const existente = lecturas.find((l) => l.empresa_id === empresaId && l.usuario_id === usuarioId && l.conversacion_id === conversacionId);
  if (!existente) lecturas.push({ empresa_id: empresaId, usuario_id: usuarioId, conversacion_id: conversacionId });
  return { rows: [{ conversacion_id: conversacionId }], rowCount: 1 };
}

function responder(sql: string, params: unknown[] = []) {
  const texto = sql.replace(/\s+/g, " ");
  if (texto.includes("INSERT INTO crm.conversaciones_lecturas")) return evaluarInsertLectura(texto, params);
  if (texto.includes("FROM core.usuarios_roles")) {
    const [usuarioId, empresaId] = params as number[];
    const usuario = usuarios[usuarioId];
    const roles = empresaId === EMPRESA && usuario ? usuario.roles : [];
    return { rows: roles.map((nombre, i) => ({ id: i + 1, nombre, descripcion: null })) };
  }
  if (texto.includes("FROM core.usuarios u")) {
    const usuario = usuarios[params[0] as number];
    return { rows: usuario ? [{ ...usuario, nombre: "Usuario", email: "u@x", activo: true, ruta_inicio: null }] : [] };
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

// Se carga después del reemplazo del pool.
/* eslint-disable @typescript-eslint/no-var-requires */
const controlador = require("../src/crm/conversaciones.controller") as typeof import("../src/crm/conversaciones.controller");

async function marcar(usuarioId: number, conversacionId: number | string) {
  const usuario = usuarios[usuarioId];
  const req = {
    params: { id: String(conversacionId) },
    auth: { userId: usuarioId, esSuperadmin: usuario?.es_superadmin ?? false },
    context: { empresaId: EMPRESA },
  } as unknown as Request;
  let status = 200;
  let body: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  } as unknown as Response;
  await controlador.marcarConversacionLeidaWhatsapp(req, res);
  return { status, body: body as { marked?: boolean; message?: string } };
}

test.beforeEach(() => { lecturas = []; });

test("administrador que es el vendedor asignado registra la lectura", async () => {
  const r = await marcar(2, 500);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { marked: true });
  assert.deepEqual(lecturas, [{ empresa_id: EMPRESA, usuario_id: 2, conversacion_id: 500 }]);
});

test("administrador que NO es el vendedor asignado consulta sin alterar contadores", async () => {
  const r = await marcar(3, 500);
  assert.deepEqual(r.body, { marked: false });
  assert.deepEqual(lecturas, []);
});

test("vendedor normal asignado registra la lectura", async () => {
  const r = await marcar(10, 501);
  assert.deepEqual(r.body, { marked: true });
  assert.deepEqual(lecturas, [{ empresa_id: EMPRESA, usuario_id: 10, conversacion_id: 501 }]);
});

test("vendedor normal no asignado no altera contadores", async () => {
  const r = await marcar(10, 500);
  assert.deepEqual(r.body, { marked: false });
  assert.deepEqual(lecturas, []);
});

test("superadmin sin contacto de vendedor no altera contadores", async () => {
  const r = await marcar(99, 500);
  assert.deepEqual(r.body, { marked: false });
  assert.deepEqual(lecturas, []);
});

test("la lectura no cruza empresas aunque coincida el vendedor", async () => {
  const r = await marcar(2, 502);
  assert.deepEqual(r.body, { marked: false });
  assert.deepEqual(lecturas, []);
});

test("reabrir la misma conversación actualiza la lectura sin duplicarla", async () => {
  await marcar(2, 500);
  const r = await marcar(2, 500);
  assert.deepEqual(r.body, { marked: true });
  assert.equal(lecturas.length, 1);
});

test("id de conversación inválido responde 400", async () => {
  const r = await marcar(2, "abc");
  assert.equal(r.status, 400);
  assert.deepEqual(lecturas, []);
});
