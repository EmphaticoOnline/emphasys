/**
 * Análisis del logotipo: algoritmo puro con imágenes sintéticas (sin sharp ni BD).
 * Ejecutar: npm --prefix backend run test:identidad-visual
 */
import assert from "node:assert/strict";
import test from "node:test";
import { analizarLogo, hexARgb, oklchARgb, rgbAOklch, type ImagenRgba } from "../src/shared/identidadVisual/analisisLogo";
import { razonContraste, validarContraste } from "../src/shared/identidadVisual/contraste";

type Figura = { color: string | null; alfa?: number; x0: number; y0: number; x1: number; y1: number };

/** Imagen de 64×64 con fondo y rectángulos. `color: null` = transparente. */
function imagen(fondo: string | null, figuras: Figura[] = [], lado = 64): ImagenRgba {
  const data = new Uint8Array(lado * lado * 4);
  const pintar = (i: number, color: string | null, alfa = 255) => {
    const [r, g, b] = color ? hexARgb(color) : [0, 0, 0];
    data.set([r, g, b, color ? alfa : 0], i * 4);
  };
  for (let i = 0; i < lado * lado; i += 1) pintar(i, fondo);
  for (const f of figuras) {
    for (let y = f.y0; y < f.y1; y += 1) for (let x = f.x0; x < f.x1; x += 1) pintar(y * lado + x, f.color, f.alfa);
  }
  return { width: lado, height: lado, data };
}

const tono = (hex: string) => rgbAOklch(hexARgb(hex)).h;
const difTono = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

test("OKLCH: ida y vuelta conserva el color", () => {
  for (const hex of ["#1d2f68", "#006261", "#c8102e", "#ffd84d", "#000000", "#ffffff"]) {
    const [r, g, b] = oklchARgb(rgbAOklch(hexARgb(hex)));
    const [r0, g0, b0] = hexARgb(hex);
    assert.ok(Math.abs(r - r0) <= 1 && Math.abs(g - g0) <= 1 && Math.abs(b - b0) <= 1, hex);
  }
});

test("logo de dos colores sobre blanco: primario = dominante, acento = segundo color, contraste válido", () => {
  const r = analizarLogo(imagen("#ffffff", [
    { color: "#c8102e", x0: 8, y0: 8, x1: 40, y1: 56 },
    { color: "#1565c0", x0: 44, y0: 20, x1: 56, y1: 44 },
  ]));
  assert.equal(r.estado, "ok");
  if (r.estado !== "ok") return;
  assert.ok(difTono(tono(r.colores.primario), tono("#c8102e")) < 15, "primario rojo");
  assert.ok(difTono(tono(r.colores.acento), tono("#1565c0")) < 15, "acento azul");
  assert.ok(difTono(tono(r.colores.sidebar), tono("#c8102e")) < 25, "sidebar derivado del primario");
  assert.deepEqual(validarContraste(r.colores), []);
  assert.equal(r.detalle.fondo, "#ffffff");
  assert.equal(r.detalle.acentoDesde, "segundo_color");
  assert.ok(r.confianza > 0.5 && r.confianza <= 1);
});

test("fondo transparente y un solo color: acento es una variante del primario", () => {
  const r = analizarLogo(imagen(null, [{ color: "#2e7d32", x0: 10, y0: 10, x1: 54, y1: 54 }]));
  assert.equal(r.estado, "ok");
  if (r.estado !== "ok") return;
  assert.equal(r.detalle.fondo, "transparente");
  assert.equal(r.detalle.acentoDesde, "variante_del_primario");
  assert.notEqual(r.colores.acento, r.colores.primario);
  assert.deepEqual(validarContraste(r.colores), []);
});

test("fondo de color (no blanco) se detecta por el borde y se ignora", () => {
  const r = analizarLogo(imagen("#1d2f68", [{ color: "#f57c00", x0: 16, y0: 16, x1: 48, y1: 48 }]));
  assert.equal(r.estado, "ok");
  if (r.estado !== "ok") return;
  assert.equal(r.detalle.fondo, "#1d2f68");
  assert.ok(difTono(tono(r.colores.primario), tono("#f57c00")) < 20, "primario naranja, no el fondo azul");
});

test("un color claro se oscurece hasta cumplir 4.5:1 sin cambiar de tono", () => {
  const r = analizarLogo(imagen("#ffffff", [{ color: "#ffd84d", x0: 8, y0: 8, x1: 56, y1: 56 }]));
  assert.equal(r.estado, "ok");
  if (r.estado !== "ok") return;
  assert.ok(razonContraste("#ffffff", r.colores.primario) >= 4.5);
  const ajustes = r.detalle.ajustes as { primario: { pasos: number } };
  assert.ok(ajustes.primario.pasos > 0);
  assert.ok(difTono(tono(r.colores.primario), tono("#ffd84d")) < 25);
});

test("logo tipo Emphasys (marino y verde petróleo) propone tonos equivalentes", () => {
  const r = analizarLogo(imagen("#ffffff", [
    { color: "#1d2f68", x0: 6, y0: 6, x1: 44, y1: 58 },
    { color: "#006261", x0: 46, y0: 6, x1: 58, y1: 40 },
  ]));
  assert.equal(r.estado, "ok");
  if (r.estado !== "ok") return;
  assert.ok(difTono(tono(r.colores.primario), tono("#1d2f68")) < 10);
  assert.ok(difTono(tono(r.colores.acento), tono("#006261")) < 10);
});

test("sin colores útiles: monocromático, vacío, casi blanco o con muy poco color", () => {
  const casos: Record<string, ImagenRgba> = {
    negro: imagen("#ffffff", [{ color: "#111111", x0: 8, y0: 8, x1: 56, y1: 56 }]),
    grises: imagen(null, [{ color: "#777777", x0: 8, y0: 8, x1: 56, y1: 56 }, { color: "#333333", x0: 20, y0: 20, x1: 40, y1: 40 }]),
    vacio: imagen(null),
    blanco: imagen("#ffffff"),
    casiBlanco: imagen("#ffffff", [{ color: "#fbfbfb", x0: 8, y0: 8, x1: 56, y1: 56 }]),
    pocoColor: imagen("#ffffff", [{ color: "#111111", x0: 4, y0: 4, x1: 60, y1: 60 }, { color: "#c8102e", x0: 30, y0: 30, x1: 32, y1: 32 }]),
  };
  for (const [nombre, img] of Object.entries(casos)) {
    const r = analizarLogo(img);
    assert.equal(r.estado, "sin_colores_utiles", nombre);
    assert.equal(r.confianza, 0, nombre);
    assert.equal(typeof r.detalle.motivo, "string", nombre);
  }
});

test("píxeles semitransparentes del borde (antialias) no cuentan como color", () => {
  const r = analizarLogo(imagen(null, [{ color: "#c8102e", alfa: 60, x0: 0, y0: 0, x1: 64, y1: 64 }]));
  assert.equal(r.estado, "sin_colores_utiles");
});

test("es determinista", () => {
  const img = imagen("#ffffff", [{ color: "#6a1b9a", x0: 8, y0: 8, x1: 56, y1: 40 }, { color: "#00897b", x0: 8, y0: 44, x1: 56, y1: 56 }]);
  assert.deepEqual(analizarLogo(img), analizarLogo(img));
});
