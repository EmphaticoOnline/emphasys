import pool from '../../config/database';

// ---------------------------------------------------------------------------
// Fase 3.1 de e-contabilidad: sugerencias REVISABLES de código agrupador SAT.
// Nunca guarda nada; solo propone. Cada sugerencia se arma en dos pasos:
//
//   1. Un "matcher" decide si aplica a la cuenta (por descripción y/o por
//      grupo/subgrupo del rango) y qué términos de búsqueda usar.
//   2. Esos términos se buscan de verdad en sat.codigos_agrupadores
//      (activo = true): si no hay ningún candidato real en el catálogo,
//      NO se sugiere nada (nunca se inventa un código).
//
// La confianza combina cuántas señales independientes coincidieron (texto
// de la descripción, prefijo de la cuenta, grupo/subgrupo del rango) con
// qué tan ambiguo resultó el catálogo (muchos candidatos = confianza baja,
// sin importar las señales).
// ---------------------------------------------------------------------------

export type NivelConfianza = 'alta' | 'media' | 'baja';

export interface CodigoAgrupadorCatalogo {
  id: number;
  codigo: string;
  descripcion: string;
  nivel: number | null;
  naturaleza: string | null;
  activo: boolean;
}

export interface SugerenciaCodigoAgrupador {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  codigo_actual: string | null;
  codigo_sugerido: string;
  descripcion_sugerida: string;
  confianza: NivelConfianza;
  motivo: string;
  reemplaza_invalido: boolean;
}

interface ContextoCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  descripcionNormalizada: string;
  prefijoCuenta: string;
  codigoActual: string | null;
  grupo: string | null;
  subgrupo: string | null;
}

interface ResultadoMatcher {
  terminos: string[];
  senales: number;
  notas: string[];
  confianzaMaxima: NivelConfianza;
}

type Matcher = (ctx: ContextoCuenta) => ResultadoMatcher | null;

function normalizar(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function contienePalabra(texto: string, patron: RegExp): boolean {
  return patron.test(texto);
}

// ── Matchers, en orden de prioridad (el primero que aplique gana) ──────────
// Los de subgrupo van primero porque son la señal más específica que ya
// existe en el propio catálogo interno de la empresa (rangos_cuentas).

const MATCHERS: Array<{ clave: string; evaluar: Matcher }> = [
  {
    clave: 'subgrupo_costo_ventas',
    evaluar: (ctx) =>
      ctx.subgrupo === 'Costo de Ventas'
        ? {
            terminos: ['costo de venta'],
            senales: 3,
            notas: ['El rango de la cuenta está clasificado como "Costo de Ventas".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'subgrupo_gastos_administracion',
    evaluar: (ctx) =>
      ctx.subgrupo === 'Gastos de Administración'
        ? {
            terminos: ['gastos de administracion'],
            senales: 3,
            notas: ['El rango de la cuenta está clasificado como "Gastos de Administración".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'subgrupo_gastos_venta',
    evaluar: (ctx) =>
      ctx.subgrupo === 'Gastos de Venta'
        ? {
            terminos: ['gastos de venta'],
            senales: 3,
            notas: ['El rango de la cuenta está clasificado como "Gastos de Venta".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'subgrupo_gastos_financieros',
    evaluar: (ctx) =>
      ctx.subgrupo === 'Gastos Financieros'
        ? {
            terminos: ['gastos financieros'],
            senales: 3,
            notas: ['El rango de la cuenta está clasificado como "Gastos Financieros".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'caja',
    evaluar: (ctx) => {
      if (!contienePalabra(ctx.descripcionNormalizada, /\bcaja\b/)) return null;
      const prefijoCoincide = ['100', '101'].includes(ctx.prefijoCuenta);
      const notas = ['La descripción de la cuenta contiene "caja".'];
      if (prefijoCoincide) notas.push('La cuenta inicia con un prefijo típico de Caja (100/101).');
      return { terminos: ['caja'], senales: prefijoCoincide ? 3 : 2, notas, confianzaMaxima: 'alta' };
    },
  },
  {
    clave: 'bancos',
    evaluar: (ctx) => {
      if (!contienePalabra(ctx.descripcionNormalizada, /\bbanco(s)?\b|\bbbva\b|\bbanamex\b|\bsantander\b|\bbanorte\b|\bhsbc\b|\bscotiabank\b|\binbursa\b|\bazteca\b/)) {
        return null;
      }
      const prefijoCoincide = ctx.prefijoCuenta === '102';
      const notas = ['La descripción de la cuenta hace referencia a un banco.'];
      if (prefijoCoincide) notas.push('La cuenta inicia con el prefijo típico de Bancos (102).');
      return { terminos: ['banco'], senales: prefijoCoincide ? 3 : 2, notas, confianzaMaxima: 'alta' };
    },
  },
  {
    clave: 'clientes',
    evaluar: (ctx) => {
      if (!contienePalabra(ctx.descripcionNormalizada, /\bcliente(s)?\b/)) return null;
      const prefijoCoincide = ctx.prefijoCuenta === '105';
      const notas = ['La descripción de la cuenta contiene "cliente(s)".'];
      if (prefijoCoincide) notas.push('La cuenta inicia con el prefijo típico de Clientes (105).');
      return { terminos: ['cliente'], senales: prefijoCoincide ? 3 : 2, notas, confianzaMaxima: 'alta' };
    },
  },
  {
    clave: 'proveedores',
    evaluar: (ctx) => {
      if (!contienePalabra(ctx.descripcionNormalizada, /\bproveedor(es)?\b/)) return null;
      const prefijoCoincide = ctx.prefijoCuenta === '201';
      const notas = ['La descripción de la cuenta contiene "proveedor(es)".'];
      if (prefijoCoincide) notas.push('La cuenta inicia con el prefijo típico de Proveedores (201).');
      return { terminos: ['proveedor'], senales: prefijoCoincide ? 3 : 2, notas, confianzaMaxima: 'alta' };
    },
  },
  {
    clave: 'iva_acreditable',
    evaluar: (ctx) =>
      /\biva\b/.test(ctx.descripcionNormalizada) && /acreditable/.test(ctx.descripcionNormalizada)
        ? {
            terminos: ['iva acreditable'],
            senales: 2,
            notas: ['La descripción de la cuenta contiene "IVA acreditable".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'iva_trasladado',
    evaluar: (ctx) =>
      /\biva\b/.test(ctx.descripcionNormalizada) && /traslad/.test(ctx.descripcionNormalizada)
        ? {
            terminos: ['iva traslad'],
            senales: 2,
            notas: ['La descripción de la cuenta contiene "IVA trasladado".'],
            confianzaMaxima: 'alta',
          }
        : null,
  },
  {
    clave: 'subgrupo_ventas',
    evaluar: (ctx) =>
      ctx.subgrupo === 'Ventas'
        ? {
            terminos: ['ventas y/o servicios', 'ingresos'],
            senales: 2,
            notas: ['El rango de la cuenta está clasificado como "Ventas".'],
            confianzaMaxima: 'media',
          }
        : null,
  },
  {
    clave: 'ventas_ingresos',
    evaluar: (ctx) => {
      const tieneVenta = /\bventa(s)?\b/.test(ctx.descripcionNormalizada);
      const tieneIngreso = /\bingreso(s)?\b/.test(ctx.descripcionNormalizada);
      if (!tieneVenta && !tieneIngreso) return null;
      const prefijoCoincide = ['400', '401'].includes(ctx.prefijoCuenta);
      const notas = [`La descripción de la cuenta contiene "${tieneVenta ? 'venta(s)' : 'ingreso(s)'}".`];
      if (prefijoCoincide) notas.push('La cuenta inicia con el prefijo típico de Ingresos (400/401).');
      return {
        terminos: [tieneVenta ? 'venta' : 'ingreso'],
        senales: prefijoCoincide ? 3 : 2,
        notas,
        confianzaMaxima: 'media',
      };
    },
  },
  {
    clave: 'costos_generico',
    evaluar: (ctx) =>
      /\bcosto(s)?\b/.test(ctx.descripcionNormalizada)
        ? {
            terminos: ['costo'],
            senales: 1,
            notas: ['La descripción de la cuenta contiene "costo(s)", sin más contexto para precisar la subcuenta.'],
            confianzaMaxima: 'baja',
          }
        : null,
  },
  {
    clave: 'gastos_generico',
    evaluar: (ctx) =>
      /\bgasto(s)?\b/.test(ctx.descripcionNormalizada)
        ? {
            terminos: ['gasto'],
            senales: 1,
            notas: ['La descripción de la cuenta contiene "gasto(s)", sin más contexto para precisar la subcuenta.'],
            confianzaMaxima: 'baja',
          }
        : null,
  },
];

function buscarCandidatos(terminos: string[], catalogo: CodigoAgrupadorCatalogo[]): CodigoAgrupadorCatalogo[] {
  const normalizados = terminos.map(normalizar);
  return catalogo.filter((c) => {
    const desc = normalizar(c.descripcion);
    return normalizados.some((t) => desc.includes(t));
  });
}

function elegirMejorCandidato(candidatos: CodigoAgrupadorCatalogo[], terminos: string[]): CodigoAgrupadorCatalogo {
  const normalizados = terminos.map(normalizar);
  const puntuar = (c: CodigoAgrupadorCatalogo): number => {
    const desc = normalizar(c.descripcion);
    let score = 0;
    if (normalizados.includes(desc)) score += 100; // coincidencia exacta de la descripción completa
    if (c.nivel === 2) score += 10; // subcuenta de primer nivel: más específica que la cuenta mayor
    score -= desc.length * 0.1; // entre candidatos similares, preferir la descripción más corta/precisa
    return score;
  };
  return [...candidatos].sort((a, b) => puntuar(b) - puntuar(a))[0];
}

const ORDEN_CONFIANZA: Record<NivelConfianza, number> = { alta: 2, media: 1, baja: 0 };

function calcularConfianza(senales: number, numCandidatos: number, tope: NivelConfianza): NivelConfianza {
  let nivel: NivelConfianza = senales >= 3 ? 'alta' : senales >= 2 ? 'media' : 'baja';
  if (numCandidatos > 6) nivel = 'baja'; // catálogo demasiado disperso: sin precisión real, sin importar las señales
  if (ORDEN_CONFIANZA[nivel] > ORDEN_CONFIANZA[tope]) nivel = tope;
  return nivel;
}

function generarSugerenciaParaCuenta(
  ctx: ContextoCuenta,
  catalogo: CodigoAgrupadorCatalogo[]
): SugerenciaCodigoAgrupador | null {
  for (const { evaluar } of MATCHERS) {
    const resultado = evaluar(ctx);
    if (!resultado) continue;

    const candidatos = buscarCandidatos(resultado.terminos, catalogo);
    if (candidatos.length === 0) continue; // sin coincidencia real en el catálogo: no se inventa nada, se prueba el siguiente matcher

    const mejor = elegirMejorCandidato(candidatos, resultado.terminos);
    const confianza = calcularConfianza(resultado.senales, candidatos.length, resultado.confianzaMaxima);

    const notas = [...resultado.notas];
    if (candidatos.length > 6) {
      notas.push(`El catálogo tiene ${candidatos.length} códigos posibles para este término; se eligió el más específico.`);
    }
    if (ctx.codigoActual) {
      notas.unshift(`Reemplaza el código actual ("${ctx.codigoActual}"), que no es válido en el catálogo oficial.`);
    }

    return {
      cuenta_id: ctx.id,
      cuenta: ctx.cuenta,
      descripcion: ctx.descripcion,
      codigo_actual: ctx.codigoActual,
      codigo_sugerido: mejor.codigo,
      descripcion_sugerida: mejor.descripcion,
      confianza,
      motivo: notas.join(' '),
      reemplaza_invalido: Boolean(ctx.codigoActual),
    };
  }
  return null;
}

export interface OpcionesSugerencias {
  soloSinCodigo: boolean;
}

export async function generarSugerenciasCodigosAgrupadores(
  empresaId: number,
  opciones: OpcionesSugerencias
): Promise<SugerenciaCodigoAgrupador[]> {
  const [{ rows: filasCuentas }, { rows: filasCatalogo }] = await Promise.all([
    // Solo cuentas afectables activas: son las únicas donde tiene sentido
    // capturar código agrupador (regla 2). Las cuentas agrupadoras/no
    // afectables nunca reciben sugerencia.
    pool.query(
      `SELECT c.id, c.cuenta, c.descripcion, c.codigo_agrupador_sat,
         r.grupo, r.subgrupo
       FROM contabilidad.cuentas c
       LEFT JOIN contabilidad.rangos_cuentas r
         ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
       WHERE c.empresa_id = $1 AND c.afectable = true AND c.activa = true
       ORDER BY c.cuenta`,
      [empresaId]
    ),
    pool.query(
      `SELECT id, codigo, descripcion, nivel, naturaleza, activo
       FROM sat.codigos_agrupadores
       WHERE activo = true`
    ),
  ]);

  const catalogo: CodigoAgrupadorCatalogo[] = filasCatalogo.map((r) => ({
    id: Number(r.id),
    codigo: r.codigo,
    descripcion: r.descripcion,
    nivel: r.nivel != null ? Number(r.nivel) : null,
    naturaleza: r.naturaleza,
    activo: r.activo,
  }));
  const codigosPorCodigo = new Map(catalogo.map((c) => [c.codigo, c]));

  const sugerencias: SugerenciaCodigoAgrupador[] = [];

  for (const fila of filasCuentas) {
    const codigoActual: string | null = fila.codigo_agrupador_sat?.trim() || null;

    // Regla 1: nunca sugerir para una cuenta que YA tiene un código válido
    // (activo en el catálogo). Solo se sugiere para "sin código" o
    // "código inválido" (regla 2 y 3).
    if (codigoActual) {
      const encontrado = codigosPorCodigo.get(codigoActual);
      const esValido = Boolean(encontrado?.activo);
      if (esValido) continue;
      if (opciones.soloSinCodigo) continue; // el caller solo quiere cuentas sin código, no reemplazos
    }

    const descripcionNormalizada = normalizar(fila.descripcion);
    const prefijoCuenta = (fila.cuenta.match(/\d+/)?.[0] ?? '').slice(0, 3);

    const ctx: ContextoCuenta = {
      id: Number(fila.id),
      cuenta: fila.cuenta,
      descripcion: fila.descripcion,
      descripcionNormalizada,
      prefijoCuenta,
      codigoActual,
      grupo: fila.grupo ?? null,
      subgrupo: fila.subgrupo ?? null,
    };

    const sugerencia = generarSugerenciaParaCuenta(ctx, catalogo);
    if (sugerencia) sugerencias.push(sugerencia);
  }

  return sugerencias;
}
