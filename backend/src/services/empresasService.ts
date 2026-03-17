import pool from "../config/database";
import { PoolClient } from "pg";
import { normalizeRFC } from "../shared/normalizers/rfc";

export type Empresa = {
  id: number;
  identificador: string;
  nombre: string;
  razon_social: string;
  rfc: string;
  regimen_fiscal_id: string;
  codigo_postal_id: string;
  estado_id: string;
  localidad_id: string | null;
  colonia_id: string | null;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  certificado_csd: string | null;
  llave_privada_csd: string | null;
  password_csd: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  activo: boolean;
  created_at?: string;
};

export type EmpresaPayload = Partial<
  Pick<
    Empresa,
    | "identificador"
    | "nombre"
    | "razon_social"
    | "rfc"
    | "regimen_fiscal_id"
    | "codigo_postal_id"
    | "estado_id"
    | "localidad_id"
    | "colonia_id"
    | "calle"
    | "numero_exterior"
    | "numero_interior"
    | "pais"
    | "telefono"
    | "email"
    | "sitio_web"
    | "certificado_csd"
    | "llave_privada_csd"
    | "password_csd"
    | "codigo_postal"
    | "regimen_fiscal"
    | "activo"
  >
>;

function sanitizePayload(payload: EmpresaPayload): EmpresaPayload {
  const clean: EmpresaPayload = {};

  const stringFields: Array<keyof EmpresaPayload> = [
    "identificador",
    "nombre",
    "razon_social",
    "regimen_fiscal_id",
    "codigo_postal_id",
    "estado_id",
    "localidad_id",
    "colonia_id",
    "calle",
    "numero_exterior",
    "numero_interior",
    "pais",
    "telefono",
    "email",
    "sitio_web",
    "certificado_csd",
    "llave_privada_csd",
    "password_csd",
    "codigo_postal",
    "regimen_fiscal",
  ];

  stringFields.forEach((field) => {
    if (payload[field] !== undefined) {
      const value = payload[field];
      clean[field] = (value === null ? null : String(value).trim()) as any;
    }
  });

  if (payload.rfc !== undefined) {
    clean.rfc = normalizeRFC(payload.rfc) ?? undefined;
  }

  if (payload.activo !== undefined) {
    clean.activo = Boolean(payload.activo);
  }

  return clean;
}

export async function listarEmpresasActivas(): Promise<Empresa[]> {
  const { rows } = await pool.query<Empresa>(
    `SELECT *
       FROM core.empresas
      WHERE activo = true
      ORDER BY nombre ASC`
  );

  return rows;
}

export async function obtenerEmpresaPorId(id: number): Promise<Empresa | null> {
  const { rows } = await pool.query<Empresa>(
    `SELECT *
       FROM core.empresas
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

async function validarUnicidadIdentificador(identificador: string, excluirId?: number, client?: PoolClient) {
  const executor = client ?? pool;
  const params: any[] = [identificador];
  let sql = `SELECT 1 FROM core.empresas WHERE lower(identificador) = lower($1)`;

  if (excluirId) {
    sql += ` AND id <> $2`;
    params.push(excluirId);
  }

  const { rowCount } = await executor.query(sql, params);
  return (rowCount ?? 0) > 0;
}

async function validarUnicidadRfc(rfc: string, excluirId?: number, client?: PoolClient) {
  const executor = client ?? pool;
  const params: any[] = [rfc];
  let sql = `SELECT 1 FROM core.empresas WHERE rfc = $1`;

  if (excluirId) {
    sql += ` AND id <> $2`;
    params.push(excluirId);
  }

  const { rowCount } = await executor.query(sql, params);
  return (rowCount ?? 0) > 0;
}

export async function crearEmpresa(payload: EmpresaPayload, usuarioId: number): Promise<Empresa> {
  const data = sanitizePayload(payload);

  if (!data.identificador || !data.nombre || !data.razon_social || !data.rfc || !data.regimen_fiscal_id || !data.codigo_postal_id || !data.estado_id) {
    throw new Error("DATOS_INCOMPLETOS");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

  const identificadorDuplicado = await validarUnicidadIdentificador(data.identificador, undefined, client);
    if (identificadorDuplicado) {
      throw new Error("IDENTIFICADOR_DUPLICADO");
    }

  const rfcDuplicado = await validarUnicidadRfc(data.rfc, undefined, client);
    if (rfcDuplicado) {
      throw new Error("RFC_DUPLICADO");
    }

    const values = [
      data.identificador,
      data.nombre,
      data.razon_social,
      data.rfc,
      data.regimen_fiscal_id,
      data.codigo_postal_id,
      data.estado_id,
      data.localidad_id ?? null,
      data.colonia_id ?? null,
      data.calle ?? null,
      data.numero_exterior ?? null,
      data.numero_interior ?? null,
      data.pais ?? "México",
      data.telefono ?? null,
      data.email ?? null,
      data.sitio_web ?? null,
      data.certificado_csd ?? null,
      data.llave_privada_csd ?? null,
      data.password_csd ?? null,
      data.codigo_postal ?? null,
      data.regimen_fiscal ?? null,
      data.activo ?? true,
    ];

    const { rows } = await client.query<Empresa>(
      `INSERT INTO core.empresas (
         identificador, nombre, razon_social, rfc,
         regimen_fiscal_id, codigo_postal_id, estado_id, localidad_id, colonia_id,
         calle, numero_exterior, numero_interior, pais,
         telefono, email, sitio_web,
         certificado_csd, llave_privada_csd, password_csd,
         codigo_postal, regimen_fiscal, activo
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16,
         $17, $18, $19,
         $20, $21, $22
       )
       RETURNING *`,
      values
    );

    const nueva = rows[0];

    // Ejecutar bootstrap de empresa (plpgsql) usando el usuario creador
    await client.query("CALL core.bootstrap_empresa($1, $2)", [nueva.id, usuarioId]);

    await client.query("COMMIT");
    return nueva;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizarEmpresa(id: number, payload: EmpresaPayload): Promise<Empresa | null> {
  const existente = await obtenerEmpresaPorId(id);
  if (!existente) return null;

  const data = sanitizePayload(payload);

  if (data.identificador) {
    const duplicado = await validarUnicidadIdentificador(data.identificador, id);
    if (duplicado) {
      const error = new Error("IDENTIFICADOR_DUPLICADO");
      throw error;
    }
  }

  if (data.rfc) {
    const duplicado = await validarUnicidadRfc(data.rfc, id);
    if (duplicado) {
      const error = new Error("RFC_DUPLICADO");
      throw error;
    }
  }

  const camposPermitidos: Array<keyof EmpresaPayload> = [
    "identificador",
    "nombre",
    "razon_social",
    "rfc",
    "regimen_fiscal_id",
    "codigo_postal_id",
    "estado_id",
    "localidad_id",
    "colonia_id",
    "calle",
    "numero_exterior",
    "numero_interior",
    "pais",
    "telefono",
    "email",
    "sitio_web",
    "certificado_csd",
    "llave_privada_csd",
    "password_csd",
    "codigo_postal",
    "regimen_fiscal",
    "activo",
  ];

  const sets: string[] = [];
  const values: any[] = [];

  camposPermitidos.forEach((campo) => {
    if (data[campo] !== undefined) {
      values.push((data as any)[campo]);
      sets.push(`${campo} = $${values.length}`);
    }
  });

  if (sets.length === 0) {
    return existente;
  }

  values.push(id);

  const { rows } = await pool.query<Empresa>(
    `UPDATE core.empresas
        SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING *`,
    values
  );

  return rows[0] ?? null;
}

export async function empresaTieneRegistrosRelacionados(id: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM core.usuarios_empresas ue WHERE ue.empresa_id = $1) AS usuarios_empresas,
       (SELECT COUNT(*) FROM core.usuarios_roles ur WHERE ur.empresa_id = $1) AS usuarios_roles,
       (SELECT COUNT(*) FROM public.contactos c WHERE c.empresa_id = $1) AS contactos,
       (SELECT COUNT(*) FROM public.productos p WHERE p.empresa_id = $1) AS productos,
       (SELECT COUNT(*) FROM public.documentos d WHERE d.empresa_id = $1) AS documentos`,
    [id]
  );

  const counters = rows[0] || {};
  const total = Object.values(counters).reduce<number>((acc, value) => acc + Number(value ?? 0), 0);
  return total > 0;
}

export async function desactivarEmpresa(id: number): Promise<Empresa | null> {
  const existe = await obtenerEmpresaPorId(id);
  if (!existe) return null;

  const relacionada = await empresaTieneRegistrosRelacionados(id);
  if (relacionada) {
    const error = new Error("EMPRESA_CON_RELACIONES");
    throw error;
  }

  const { rows } = await pool.query<Empresa>(
    `UPDATE core.empresas
        SET activo = false
      WHERE id = $1
      RETURNING *`,
    [id]
  );

  return rows[0] ?? null;
}
