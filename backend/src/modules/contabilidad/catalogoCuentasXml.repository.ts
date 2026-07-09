import pool from '../../config/database';
import { contarCodigosAgrupadoresActivos, obtenerMapaCodigosAgrupadores } from './codigosAgrupadores.repository';

// ---------------------------------------------------------------------------
// Fase 6 de Contabilidad Electrónica: generación del XML de Catálogo de
// cuentas (Anexo 24, esquema CatalogoCuentas versión 1.3). Esta capa NO
// construye el XML (ver catalogoCuentasXml.builder.ts); solo arma la lista
// final de cuentas a incluir y corre las validaciones bloqueantes/de
// advertencia. El catálogo de cuentas no es información "por periodo" (las
// cuentas no tienen ejercicio/periodo propio); ejercicio/periodo aquí solo
// alimentan los atributos Anio/Mes del XML y, en el caso de la advertencia
// de "sin movimientos ni saldos", se evalúa contra el histórico completo de
// la empresa (no acotado al mes), porque una cuenta estructural del catálogo
// puede legítimamente no tener actividad en un mes específico.
// ---------------------------------------------------------------------------

export interface ErrorCatalogoXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaCatalogoXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface CuentaCatalogoXml {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  cod_agrup: string | null;
  nivel: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  sub_cta_de: string | null;
  afectable: boolean;
}

export interface CatalogoCuentasXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: { cuentas: number; errores: number; advertencias: number };
  cuentas: CuentaCatalogoXml[];
  errores: ErrorCatalogoXml[];
  advertencias: AdvertenciaCatalogoXml[];
}

interface CuentaRawRow {
  id: number;
  cuenta: string;
  descripcion: string;
  nivel: number | null;
  cuenta_padre_id: number | null;
  afectable: boolean;
  activa: boolean;
  codigo_agrupador_sat: string | null;
  naturaleza_saldo: 'D' | 'A' | null;
}

// Patrón básico de RFC (persona física de 13 posiciones o moral de 12):
// 3-4 letras/Ñ/&, 6 dígitos de fecha, 3 caracteres de homoclave. No es el
// patrón completo del XSD del SAT (que además valida rangos de día/mes);
// es la validación "de formato básico" que pide esta fase.
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

function resolverNaturalezaDescripcion(naturaleza: 'D' | 'A' | null): string | null {
  if (naturaleza === 'D') return 'Deudora';
  if (naturaleza === 'A') return 'Acreedora';
  return null;
}

export async function construirCatalogoCuentasXml(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<CatalogoCuentasXmlResultado> {
  const errores: ErrorCatalogoXml[] = [];
  const advertencias: AdvertenciaCatalogoXml[] = [];

  // 1) Empresa: RFC y razón social.
  const empresaResult = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const empresaRow = empresaResult.rows[0];
  const rfc = empresaRow?.rfc?.trim() ?? '';
  const razonSocial = empresaRow?.razon_social?.trim() ?? '';

  if (!rfc) {
    errores.push({ tipo: 'empresa_sin_rfc', motivo: 'La empresa no tiene RFC configurado.' });
  } else if (!RFC_REGEX.test(rfc)) {
    errores.push({ tipo: 'empresa_rfc_invalido', motivo: `El RFC "${rfc}" no tiene un formato válido.` });
  }

  // 2) Catálogo oficial de códigos agrupadores SAT: si está vacío, ninguna
  // cuenta puede validarse contra él (error global, no depende de una cuenta
  // en particular).
  const totalCodigosActivos = await contarCodigosAgrupadoresActivos();
  if (totalCodigosActivos === 0) {
    errores.push({
      tipo: 'catalogo_sat_codigos_vacio',
      motivo: 'El catálogo oficial de códigos agrupadores SAT no tiene registros activos.',
    });
  }
  const codigosPorCodigo = await obtenerMapaCodigosAgrupadores();

  // 3) Todas las cuentas de la empresa (activas E inactivas): se necesitan
  // las inactivas para poder detectar "padre inactivo"/"padre inexistente"
  // al resolver la cadena de ancestros de cada cuenta activa.
  const { rows: cuentasRows } = await pool.query<CuentaRawRow>(
    `SELECT c.id, c.cuenta, c.descripcion, c.nivel, c.cuenta_padre_id, c.afectable, c.activa,
            c.codigo_agrupador_sat, r.naturaleza_saldo
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     WHERE c.empresa_id = $1
     ORDER BY c.cuenta ASC`,
    [empresaId]
  );
  const cuentasPorId = new Map<number, CuentaRawRow>(cuentasRows.map((c) => [c.id, c]));

  // 4) Cuentas con al menos un movimiento o saldo histórico (para la
  // advertencia "sin movimientos ni saldos"), sin acotar a ejercicio/periodo
  // por lo explicado arriba.
  const movResult = await pool.query<{ cuenta_id: string }>(
    `SELECT cuenta_id FROM contabilidad.polizas_detalle WHERE empresa_id = $1
     UNION
     SELECT cuenta_id FROM contabilidad.cuentas_saldos_mensuales WHERE empresa_id = $1`,
    [empresaId]
  );
  const cuentasConActividad = new Set(movResult.rows.map((r) => Number(r.cuenta_id)));

  // 5) Resolver, para cada cuenta activa, si toda su cadena de ancestros
  // (cuenta_padre_id hacia arriba) existe y está activa. Si la cadena se
  // rompe en el padre directo, se reporta el error específico sobre ESTA
  // cuenta (padre_inexistente/padre_inactivo). Si el padre directo está bien
  // pero es la cadena de MÁS ARRIBA la que se rompe, se reporta
  // "padre_no_incluible" sobre esta cuenta (error 12 del pedido).
  const resueltos = new Map<number, boolean>();
  function resolverCadena(id: number, visitados: Set<number>): boolean {
    if (resueltos.has(id)) return resueltos.get(id) as boolean;
    if (visitados.has(id)) {
      resueltos.set(id, false);
      return false;
    }
    visitados.add(id);

    const cuenta = cuentasPorId.get(id);
    if (!cuenta) {
      resueltos.set(id, false);
      return false;
    }
    if (cuenta.cuenta_padre_id == null) {
      resueltos.set(id, true);
      return true;
    }

    const padre = cuentasPorId.get(cuenta.cuenta_padre_id);
    if (!padre) {
      errores.push({
        tipo: 'cuenta_padre_inexistente',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta hace referencia a una cuenta padre que no existe.',
      });
      resueltos.set(id, false);
      return false;
    }
    if (!padre.activa) {
      errores.push({
        tipo: 'cuenta_padre_inactivo',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: `La cuenta padre "${padre.cuenta}" está inactiva.`,
      });
      resueltos.set(id, false);
      return false;
    }

    const padreOk = resolverCadena(padre.id, visitados);
    if (!padreOk) {
      errores.push({
        tipo: 'cuenta_padre_no_incluible',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta padre no puede incluirse en el catálogo por un problema más arriba en su propia jerarquía.',
      });
      resueltos.set(id, false);
      return false;
    }

    resueltos.set(id, true);
    return true;
  }

  // 6) Set final de cuentas a incluir: cada cuenta activa cuya cadena
  // resuelva bien, más TODOS sus ancestros (activos, ya validados al
  // resolver la cadena). No se limita a cuentas afectables.
  const idsIncluidos = new Set<number>();
  for (const cuenta of cuentasRows) {
    if (!cuenta.activa) continue;
    const ok = resolverCadena(cuenta.id, new Set());
    if (!ok) continue;
    let actual: CuentaRawRow | undefined = cuenta;
    while (actual) {
      idsIncluidos.add(actual.id);
      actual = actual.cuenta_padre_id != null ? cuentasPorId.get(actual.cuenta_padre_id) : undefined;
    }
  }

  // 7) Validaciones de campo por cuenta incluida + armado de la fila para
  // el XML/preview.
  const cuentasXml: CuentaCatalogoXml[] = [];
  for (const id of idsIncluidos) {
    const cuenta = cuentasPorId.get(id);
    if (!cuenta) continue;

    if (!cuenta.cuenta?.trim()) {
      errores.push({
        tipo: 'cuenta_sin_numero',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa no tiene número de cuenta.',
      });
    }
    if (!cuenta.descripcion?.trim()) {
      errores.push({
        tipo: 'cuenta_sin_descripcion',
        cuenta: cuenta.cuenta,
        motivo: 'La cuenta activa no tiene descripción.',
      });
    }
    if (cuenta.nivel == null) {
      errores.push({
        tipo: 'cuenta_sin_nivel',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa no tiene nivel definido.',
      });
    }
    if (!cuenta.naturaleza_saldo) {
      errores.push({
        tipo: 'cuenta_sin_naturaleza',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa no tiene rango/naturaleza resoluble.',
      });
    }

    const codigo = cuenta.codigo_agrupador_sat?.trim() || '';
    if (!codigo) {
      errores.push({
        tipo: 'cuenta_sin_codigo_agrupador',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa no tiene código agrupador SAT.',
      });
    } else if (!codigosPorCodigo.has(codigo)) {
      errores.push({
        tipo: 'codigo_agrupador_inexistente',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: `El código agrupador "${codigo}" no existe en el catálogo oficial SAT.`,
      });
    } else if (codigosPorCodigo.get(codigo) === false) {
      errores.push({
        tipo: 'codigo_agrupador_inactivo',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: `El código agrupador "${codigo}" está inactivo en el catálogo oficial SAT.`,
      });
    }

    // Advertencias (no bloquean).
    if (cuenta.afectable && !cuentasConActividad.has(cuenta.id)) {
      advertencias.push({
        tipo: 'cuenta_sin_movimientos_ni_saldos',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta no tiene movimientos ni saldos registrados.',
      });
    }
    if (!cuenta.afectable) {
      advertencias.push({
        tipo: 'cuenta_incluida_por_jerarquia',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'Cuenta no afectable incluida solo para preservar la jerarquía del catálogo.',
      });
    }

    const padre = cuenta.cuenta_padre_id != null ? cuentasPorId.get(cuenta.cuenta_padre_id) : undefined;
    const subCtaDe = padre && idsIncluidos.has(padre.id) ? padre.cuenta : null;

    cuentasXml.push({
      cuenta_id: cuenta.id,
      num_cta: cuenta.cuenta,
      descripcion: cuenta.descripcion,
      cod_agrup: codigo || null,
      nivel: cuenta.nivel ?? 0,
      naturaleza: cuenta.naturaleza_saldo,
      naturaleza_descripcion: resolverNaturalezaDescripcion(cuenta.naturaleza_saldo),
      sub_cta_de: subCtaDe,
      afectable: cuenta.afectable,
    });
  }

  // Orden final estable y repetible: número de cuenta ascendente.
  cuentasXml.sort((a, b) => a.num_cta.localeCompare(b.num_cta, 'es'));

  // Duplicados de NumCta: aunque (empresa_id, cuenta) es UNIQUE en BD, se
  // revalida aquí porque es justo el tipo de cosa que el XML no debe tener
  // nunca, y es una verificación barata sobre una lista ya en memoria.
  const vistos = new Set<string>();
  for (const c of cuentasXml) {
    if (vistos.has(c.num_cta)) {
      errores.push({
        tipo: 'cuenta_numero_duplicado',
        cuenta: c.num_cta,
        descripcion: c.descripcion,
        motivo: `El número de cuenta "${c.num_cta}" está duplicado en el catálogo.`,
      });
    }
    vistos.add(c.num_cta);
  }

  return {
    ok: errores.length === 0,
    empresa: { rfc, razon_social: razonSocial },
    ejercicio,
    periodo,
    resumen: { cuentas: cuentasXml.length, errores: errores.length, advertencias: advertencias.length },
    cuentas: cuentasXml,
    errores,
    advertencias,
  };
}
