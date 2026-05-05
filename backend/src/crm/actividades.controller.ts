import type { Request, Response } from 'express';
import pool from '../config/database';

type CrearActividadBody = {
  usuario_asignado_id?: unknown;
  oportunidad_id?: unknown;
  tipo_actividad?: unknown;
  fecha_programada?: unknown;
  notas?: unknown;
  recordatorio?: unknown;
  recordatorio_minutos?: unknown;
  estatus?: unknown;
  resultado?: unknown;
  fecha_realizacion?: unknown;
};

type ActualizarActividadBody = {
  tipo_actividad?: unknown;
  fecha_programada?: unknown;
  notas?: unknown;
  oportunidad_id?: unknown;
  estatus?: unknown;
  resultado?: unknown;
};

type ActividadRow = {
  id: number;
  empresa_id: number;
  usuario_asignado_id: number;
  usuario_creador_id: number;
  oportunidad_id: number | null;
  tipo_actividad: string;
  fecha_programada: Date | string;
  notas: string | null;
  estatus: string;
  fecha_realizacion: Date | string | null;
  resultado: string | null;
  recordatorio: boolean | null;
  recordatorio_minutos: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  cliente_nombre?: string | null;
};

type ActividadListadoRow = {
  id: number;
  tipo_actividad: string;
  fecha_programada: Date | string;
  estatus: string;
  notas: string | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  oportunidad_nombre: string | null;
  grupo: 'vencidas' | 'hoy' | 'futuras';
};

type ActividadListadoItem = {
  id: number;
  tipo_actividad: string;
  fecha_programada: Date | string;
  estatus: string;
  notas: string | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  oportunidad_nombre: string | null;
};

type ActividadesAgrupadasResponse = {
  vencidas: ActividadListadoItem[];
  hoy: ActividadListadoItem[];
  futuras: ActividadListadoItem[];
};

type ActividadOportunidadRow = {
  id: number;
  tipo_actividad: string;
  fecha_programada: Date | string;
  estatus: string;
  notas: string | null;
  oportunidad_id: number | null;
  resultado: string | null;
  fecha_realizacion: Date | string | null;
};

const TIPOS_ACTIVIDAD_VALIDOS = new Set(['llamada', 'whatsapp', 'visita', 'tarea']);
const CAMPOS_PROHIBIDOS_EN_CREACION = ['estatus', 'resultado', 'fecha_realizacion'] as const;
const ESTATUS_ACTUALIZABLES = new Set(['realizada', 'cancelada']);

function parseRequiredPositiveInt(value: unknown, fieldName: string): number | null {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return null;
}

function serializeActividad(row: ActividadRow) {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    usuario_asignado_id: row.usuario_asignado_id,
    usuario_creador_id: row.usuario_creador_id,
    oportunidad_id: row.oportunidad_id,
    tipo_actividad: row.tipo_actividad,
    fecha_programada: row.fecha_programada,
    notas: row.notas,
    estatus: row.estatus,
    fecha_realizacion: row.fecha_realizacion,
    resultado: row.resultado,
    recordatorio: row.recordatorio,
    recordatorio_minutos: row.recordatorio_minutos,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cliente_nombre: row.cliente_nombre ?? null,
  };
}

function serializeActividadListado(row: ActividadListadoRow): ActividadListadoItem {
  return {
    id: row.id,
    tipo_actividad: row.tipo_actividad,
    fecha_programada: row.fecha_programada,
    estatus: row.estatus,
    notas: row.notas,
    oportunidad_id: row.oportunidad_id,
    cliente_nombre: row.cliente_nombre,
    oportunidad_nombre: row.oportunidad_nombre,
  };
}

function serializeActividadOportunidad(row: ActividadOportunidadRow) {
  return {
    id: row.id,
    tipo_actividad: row.tipo_actividad,
    fecha_programada: row.fecha_programada,
    estatus: row.estatus,
    notas: row.notas,
    oportunidad_id: row.oportunidad_id,
    resultado: row.resultado,
    fecha_realizacion: row.fecha_realizacion,
  };
}

export async function listarActividadesUsuario(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const usuarioId = req.auth?.userId;
    const oportunidadIdRaw = req.query.oportunidad_id;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (oportunidadIdRaw !== undefined) {
      const oportunidadId = Number(oportunidadIdRaw);

      if (!Number.isInteger(oportunidadId) || oportunidadId <= 0) {
        return res.status(400).json({ message: 'oportunidad_id inválido' });
      }

      const { rows } = await pool.query<ActividadOportunidadRow>(
        `SELECT
           id,
           tipo_actividad,
           fecha_programada,
           estatus,
           notas,
           oportunidad_id,
           resultado,
           fecha_realizacion
         FROM crm.actividades
         WHERE empresa_id = $1
           AND oportunidad_id = $2
         ORDER BY fecha_programada DESC, id DESC`,
        [Number(empresaId), oportunidadId]
      );

      return res.json(rows.map(serializeActividadOportunidad));
    }

    const { rows } = await pool.query<ActividadListadoRow>(
      `SELECT
         a.id,
         a.tipo_actividad,
         a.fecha_programada,
         a.estatus,
         a.notas,
         a.oportunidad_id,
         c.nombre AS cliente_nombre,
         NULL::text AS oportunidad_nombre,
         CASE
           WHEN a.fecha_programada < NOW() THEN 'vencidas'
           WHEN DATE(a.fecha_programada) = CURRENT_DATE THEN 'hoy'
           ELSE 'futuras'
         END AS grupo
       FROM crm.actividades a
       LEFT JOIN crm.oportunidades_venta o
         ON o.id = a.oportunidad_id
        AND o.empresa_id = a.empresa_id
       LEFT JOIN contactos c
         ON c.id = o.contacto_id
        AND c.empresa_id = a.empresa_id
       WHERE a.empresa_id = $1
         AND a.usuario_asignado_id = $2
         AND a.estatus = 'pendiente'
       ORDER BY a.fecha_programada ASC`,
      [Number(empresaId), Number(usuarioId)]
    );

    const response: ActividadesAgrupadasResponse = {
      vencidas: [],
      hoy: [],
      futuras: [],
    };

    for (const row of rows) {
      response[row.grupo].push(serializeActividadListado(row));
    }

    return res.json(response);
  } catch (error) {
    console.error('Error al listar actividades del usuario:', {
      empresaId: req.context?.empresaId,
      usuarioId: req.auth?.userId,
      oportunidadId: req.query.oportunidad_id,
      error,
    });
    return res.status(500).json({ message: 'Error al listar actividades' });
  }
}

export async function crearActividad(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const usuarioCreadorId = req.auth?.userId;
    const body = (req.body ?? {}) as CrearActividadBody;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!usuarioCreadorId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    for (const campo of CAMPOS_PROHIBIDOS_EN_CREACION) {
      if (Object.prototype.hasOwnProperty.call(body, campo)) {
        return res.status(400).json({ message: `No se permite enviar ${campo} al crear una actividad` });
      }
    }

    const usuarioAsignadoId = parseRequiredPositiveInt(body.usuario_asignado_id, 'usuario_asignado_id');

    if (usuarioAsignadoId === null) {
      return res.status(400).json({ message: 'usuario_asignado_id es obligatorio' });
    }

    const tipoActividad = typeof body.tipo_actividad === 'string'
      ? body.tipo_actividad.trim().toLowerCase()
      : '';

    if (!tipoActividad) {
      return res.status(400).json({ message: 'tipo_actividad es obligatorio' });
    }

    if (!TIPOS_ACTIVIDAD_VALIDOS.has(tipoActividad)) {
      return res.status(400).json({ message: 'tipo_actividad inválido' });
    }

    const fechaProgramadaRaw = typeof body.fecha_programada === 'string'
      ? body.fecha_programada.trim()
      : body.fecha_programada;

    if (!fechaProgramadaRaw) {
      return res.status(400).json({ message: 'fecha_programada es obligatoria' });
    }

    const fechaProgramada = new Date(String(fechaProgramadaRaw));

    if (Number.isNaN(fechaProgramada.getTime())) {
      return res.status(400).json({ message: 'fecha_programada inválida' });
    }

    const oportunidadId = parseOptionalPositiveInt(body.oportunidad_id);

    if (oportunidadId === null) {
      return res.status(400).json({ message: 'oportunidad_id debe ser un entero positivo' });
    }

    const recordatorio = parseOptionalBoolean(body.recordatorio);

    if (body.recordatorio !== undefined && recordatorio === null) {
      return res.status(400).json({ message: 'recordatorio debe ser booleano' });
    }

    const recordatorioMinutos = parseOptionalPositiveInt(body.recordatorio_minutos);

    if (recordatorioMinutos === null) {
      return res.status(400).json({ message: 'recordatorio_minutos debe ser un entero positivo' });
    }

    const notas = typeof body.notas === 'string'
      ? body.notas.trim() || null
      : body.notas == null
        ? null
        : String(body.notas);

    const { rows } = await pool.query<ActividadRow>(
      `INSERT INTO crm.actividades (
         empresa_id,
         usuario_asignado_id,
         usuario_creador_id,
         oportunidad_id,
         tipo_actividad,
         fecha_programada,
         notas,
         estatus,
         recordatorio,
         recordatorio_minutos
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', COALESCE($8, FALSE), $9)
       RETURNING
         id,
         empresa_id,
         usuario_asignado_id,
         usuario_creador_id,
         oportunidad_id,
         tipo_actividad,
         fecha_programada,
         notas,
         estatus,
         fecha_realizacion,
         resultado,
         recordatorio,
         recordatorio_minutos,
         created_at,
         updated_at`,
      [
        Number(empresaId),
        usuarioAsignadoId,
        Number(usuarioCreadorId),
        oportunidadId ?? null,
        tipoActividad,
        fechaProgramada,
        notas,
        recordatorio,
        recordatorioMinutos ?? null,
      ]
    );

    return res.status(201).json(serializeActividad(rows[0]));
  } catch (error) {
    console.error('Error al crear actividad:', {
      empresaId: req.context?.empresaId,
      usuarioCreadorId: req.auth?.userId,
      usuarioAsignadoId: req.body?.usuario_asignado_id,
      oportunidadId: req.body?.oportunidad_id,
      tipoActividad: req.body?.tipo_actividad,
      error,
    });
    return res.status(500).json({ message: 'Error al crear actividad' });
  }
}

export async function obtenerActividadPorId(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const actividadId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(actividadId) || actividadId <= 0) {
      return res.status(400).json({ message: 'id de actividad inválido' });
    }

    const { rows } = await pool.query<ActividadRow>(
      `SELECT
         a.id,
         a.empresa_id,
         a.usuario_asignado_id,
         a.usuario_creador_id,
         a.oportunidad_id,
         a.tipo_actividad,
         a.fecha_programada,
         a.notas,
         a.estatus,
         a.fecha_realizacion,
         a.resultado,
         a.recordatorio,
         a.recordatorio_minutos,
         a.created_at,
         a.updated_at,
         c.nombre AS cliente_nombre
       FROM crm.actividades a
       LEFT JOIN crm.oportunidades_venta o
         ON o.id = a.oportunidad_id
        AND o.empresa_id = a.empresa_id
       LEFT JOIN contactos c
         ON c.id = o.contacto_id
        AND c.empresa_id = a.empresa_id
       WHERE a.id = $1
         AND a.empresa_id = $2
       LIMIT 1`,
      [actividadId, Number(empresaId)]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    return res.json(serializeActividad(rows[0]));
  } catch (error) {
    console.error('Error al obtener actividad:', error);
    return res.status(500).json({ message: 'Error al obtener actividad' });
  }
}

export async function actualizarActividad(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const actividadId = Number(req.params.id);
    const body = (req.body ?? {}) as ActualizarActividadBody;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(actividadId) || actividadId <= 0) {
      return res.status(400).json({ message: 'id de actividad inválido' });
    }

    const tipoActividad = typeof body.tipo_actividad === 'string'
      ? body.tipo_actividad.trim().toLowerCase()
      : '';

    if (!tipoActividad || !TIPOS_ACTIVIDAD_VALIDOS.has(tipoActividad)) {
      return res.status(400).json({ message: 'tipo_actividad inválido' });
    }

    const fechaProgramadaRaw = typeof body.fecha_programada === 'string'
      ? body.fecha_programada.trim()
      : body.fecha_programada;

    if (!fechaProgramadaRaw) {
      return res.status(400).json({ message: 'fecha_programada es obligatoria' });
    }

    const fechaProgramada = new Date(String(fechaProgramadaRaw));

    if (Number.isNaN(fechaProgramada.getTime())) {
      return res.status(400).json({ message: 'fecha_programada inválida' });
    }

    const oportunidadId = parseOptionalPositiveInt(body.oportunidad_id);

    if (oportunidadId === null) {
      return res.status(400).json({ message: 'oportunidad_id debe ser un entero positivo' });
    }

    const notas = typeof body.notas === 'string'
      ? body.notas.trim() || null
      : body.notas == null
        ? null
        : String(body.notas);

    const { rows } = await pool.query<ActividadRow>(
      `UPDATE crm.actividades
       SET
         tipo_actividad = $1,
         fecha_programada = $2,
         notas = $3,
         oportunidad_id = $4,
         updated_at = NOW()
       WHERE id = $5
         AND empresa_id = $6
       RETURNING
         id,
         empresa_id,
         usuario_asignado_id,
         usuario_creador_id,
         oportunidad_id,
         tipo_actividad,
         fecha_programada,
         notas,
         estatus,
         fecha_realizacion,
         resultado,
         recordatorio,
         recordatorio_minutos,
         created_at,
         updated_at`,
      [tipoActividad, fechaProgramada, notas, oportunidadId ?? null, actividadId, Number(empresaId)]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    return res.json(serializeActividad(rows[0]));
  } catch (error) {
    console.error('Error al actualizar actividad:', error);
    return res.status(500).json({ message: 'Error al actualizar actividad' });
  }
}

export async function actualizarEstatusActividad(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const actividadId = Number(req.params.id);
    const body = (req.body ?? {}) as ActualizarActividadBody;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(actividadId) || actividadId <= 0) {
      return res.status(400).json({ message: 'id de actividad inválido' });
    }

    const nuevoEstatus = typeof body.estatus === 'string'
      ? body.estatus.trim().toLowerCase()
      : '';

    if (!ESTATUS_ACTUALIZABLES.has(nuevoEstatus)) {
      return res.status(400).json({ message: 'estatus inválido' });
    }

    const { rows: actividadRows } = await pool.query<Pick<ActividadRow, 'id' | 'estatus'>>(
      `SELECT id, estatus
       FROM crm.actividades
       WHERE id = $1
         AND empresa_id = $2
       LIMIT 1`,
      [actividadId, Number(empresaId)]
    );

    if (!actividadRows.length) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    const actividad = actividadRows[0];

    if (actividad.estatus !== 'pendiente') {
      return res.status(400).json({ message: 'La actividad no está pendiente' });
    }

    const resultado = typeof body.resultado === 'string'
      ? body.resultado.trim()
      : '';

    if (nuevoEstatus === 'realizada' && !resultado) {
      return res.status(400).json({ message: 'resultado es obligatorio cuando la actividad se marca como realizada' });
    }

    const { rows } = await pool.query<ActividadRow>(
      `UPDATE crm.actividades
       SET
         estatus = $1::varchar,
         resultado = CASE WHEN $1::text = 'realizada' THEN $2::text ELSE resultado END,
         fecha_realizacion = CASE WHEN $1::text = 'realizada' THEN NOW() ELSE fecha_realizacion END,
         updated_at = NOW()
       WHERE id = $3
         AND empresa_id = $4
       RETURNING
         id,
         empresa_id,
         usuario_asignado_id,
         usuario_creador_id,
         oportunidad_id,
         tipo_actividad,
         fecha_programada,
         notas,
         estatus,
         fecha_realizacion,
         resultado,
         recordatorio,
         recordatorio_minutos,
         created_at,
         updated_at`,
      [nuevoEstatus, resultado || null, actividadId, Number(empresaId)]
    );

    return res.json(serializeActividad(rows[0]));
  } catch (error) {
    console.error('Error al actualizar estatus de actividad:', error);
    return res.status(500).json({ message: 'Error al actualizar actividad' });
  }
}