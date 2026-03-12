import pool from "../../../config/database";

export type ParametroOpcion = {
  valor: string;
  etiqueta: string;
  orden: number | null;
};

export type ParametroSistema = {
  parametro_id: number;
  clave: string;
  nombre: string;
  tipo_dato: string | null;
  tipo_control: string;
  valor_default: string | null;
  valor_empresa: string | null;
  valor_resuelto: string | null;
  tiene_valor_empresa: boolean;
  parametro_padre_id: number | null;
  valor_activacion: string | null;
  modulo_id: number | null;
  modulo_clave: string | null;
  modulo_nombre: string | null;
  opciones: ParametroOpcion[];
};

export type ParametrosModulo = {
  modulo_id: number | null;
  modulo_clave: string | null;
  modulo_nombre: string | null;
  parametros: ParametroSistema[];
};

type ParametroRow = {
  parametro_id: number;
  clave: string;
  nombre: string;
  tipo_dato: string | null;
  tipo_control: string | null;
  valor_default: string | null;
  parametro_padre_id: number | null;
  valor_activacion: string | null;
  modulo_id: number | null;
  modulo_clave: string | null;
  modulo_nombre: string | null;
  valor_empresa: string | null;
};

type ParametroOpcionRow = {
  parametro_id: number;
  valor: string;
  etiqueta: string;
  orden: number | null;
};

function resolveModuloNombre(row: { modulo_nombre: string | null; modulo_clave: string | null }): string {
  if (row.modulo_nombre) return row.modulo_nombre;
  if (row.modulo_clave) return row.modulo_clave;
  return "General";
}

export async function obtenerParametrosPorEmpresa(empresaId: number): Promise<ParametrosModulo[]> {
  const [parametrosRes, opcionesRes] = await Promise.all([
    pool.query<ParametroRow>(
      `SELECT
         p.parametro_id,
         p.clave,
         p.nombre,
         p.tipo_dato,
         p.tipo_control,
         p.valor_default,
         p.parametro_padre_id,
         p.valor_activacion,
         pm.modulo_id,
         m.clave AS modulo_clave,
         m.nombre AS modulo_nombre,
         pe.valor AS valor_empresa
       FROM core.parametros p
       LEFT JOIN core.parametros_modulos pm ON pm.parametro_id = p.parametro_id
       LEFT JOIN core.modulos m ON m.modulo_id = pm.modulo_id
       LEFT JOIN core.parametros_empresa pe
              ON pe.parametro_id = p.parametro_id AND pe.empresa_id = $1
       ORDER BY m.nombre NULLS LAST, p.nombre ASC, p.parametro_id ASC`,
      [empresaId]
    ),
    pool.query<ParametroOpcionRow>(
      `SELECT parametro_id, valor, etiqueta, orden
         FROM core.parametros_opciones
        ORDER BY parametro_id, orden ASC NULLS LAST, etiqueta ASC`
    ),
  ]);

  const opcionesPorParametro = new Map<number, ParametroOpcion[]>();
  for (const opt of opcionesRes.rows) {
    const list = opcionesPorParametro.get(opt.parametro_id) ?? [];
    list.push({ valor: opt.valor, etiqueta: opt.etiqueta, orden: opt.orden });
    opcionesPorParametro.set(opt.parametro_id, list);
  }

  const parametros: ParametroSistema[] = parametrosRes.rows.map((row) => {
    const valor_resuelto = row.valor_empresa ?? row.valor_default ?? null;
    return {
      parametro_id: row.parametro_id,
      clave: row.clave,
      nombre: row.nombre,
      tipo_dato: row.tipo_dato,
      tipo_control: row.tipo_control ?? "input",
      valor_default: row.valor_default,
      valor_empresa: row.valor_empresa,
      valor_resuelto,
      tiene_valor_empresa: row.valor_empresa !== null && row.valor_empresa !== undefined,
      parametro_padre_id: row.parametro_padre_id,
      valor_activacion: row.valor_activacion,
      modulo_id: row.modulo_id,
      modulo_clave: row.modulo_clave,
      modulo_nombre: row.modulo_nombre,
      opciones: opcionesPorParametro.get(row.parametro_id) ?? [],
    };
  });

  const modulosMap = new Map<string, ParametrosModulo>();

  for (const param of parametros) {
    const key = String(param.modulo_id ?? "__general__");
    if (!modulosMap.has(key)) {
      modulosMap.set(key, {
        modulo_id: param.modulo_id,
        modulo_clave: param.modulo_clave,
  modulo_nombre: resolveModuloNombre(param),
        parametros: [],
      });
    }
    modulosMap.get(key)!.parametros.push(param);
  }

  return Array.from(modulosMap.values()).sort((a, b) => {
    const nameA = a.modulo_nombre?.toLowerCase() ?? "";
    const nameB = b.modulo_nombre?.toLowerCase() ?? "";
    return nameA.localeCompare(nameB);
  });
}

export async function upsertParametroEmpresa(
  empresaId: number,
  parametroId: number,
  valor: string | number | boolean | null | undefined
) {
  const parametroExiste = await pool.query(`SELECT parametro_id FROM core.parametros WHERE parametro_id = $1 LIMIT 1`, [parametroId]);
  if (!parametroExiste.rows[0]) {
    const error = new Error("PARAMETRO_NO_ENCONTRADO");
    throw error;
  }

  const valorTexto = valor === null || valor === undefined ? null : String(valor);

  const { rows } = await pool.query(
    `INSERT INTO core.parametros_empresa (empresa_id, parametro_id, valor)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, parametro_id)
     DO UPDATE SET valor = EXCLUDED.valor
     RETURNING empresa_id, parametro_id, valor`,
    [empresaId, parametroId, valorTexto]
  );

  return rows[0];
}