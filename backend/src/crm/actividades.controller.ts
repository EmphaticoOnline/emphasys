import type { Request, Response } from 'express';
import pool from '../config/database';
import { formatearFolioDocumento } from '../utils/documentos';

type CrearActividadBody = {
  usuario_asignado_id?: unknown;
  contacto_id?: unknown;
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
  contacto_id?: unknown;
  oportunidad_id?: unknown;
  recordatorio?: unknown;
  recordatorio_minutos?: unknown;
  estatus?: unknown;
  resultado?: unknown;
};

type ActividadRow = {
  id: number;
  empresa_id: number;
  usuario_asignado_id: number;
  usuario_creador_id: number;
  contacto_id: number | null;
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
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  oportunidad_nombre: string | null;
  cotizacion_principal_id: number | null;
  serie: string | null;
  numero: number | null;
  monto_oportunidad: number | string | null;
  oportunidad_fecha: Date | string | null;
  grupo: 'vencidas' | 'hoy' | 'futuras' | 'completadas';
};

type ActividadListadoItem = {
  id: number;
  tipo_actividad: string;
  fecha_programada: Date | string;
  estatus: string;
  notas: string | null;
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  oportunidad_nombre: string | null;
  oportunidad_folio: string | null;
  monto_oportunidad: number | string | null;
  oportunidad_fecha: Date | string | null;
};

type ActividadesAgrupadasResponse = {
  vencidas: ActividadListadoItem[];
  hoy: ActividadListadoItem[];
  futuras: ActividadListadoItem[];
  completadas: ActividadListadoItem[];
};

type ActividadOportunidadRow = {
  id: number;
  tipo_actividad: string;
  fecha_programada: Date | string;
  estatus: string;
  notas: string | null;
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  resultado: string | null;
  fecha_realizacion: Date | string | null;
};

type ActividadRecordatorioRow = {
  id: number;
  tipo_actividad: string;
  notas: string | null;
  fecha_programada: Date | string;
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
};

type ActividadExistenteRow = {
  id: number;
  contacto_id: number | null;
};

type OportunidadContactoRow = {
  contacto_id: number | null;
};

type ContactoRow = {
  id: number;
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
    contacto_id: row.contacto_id,
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
  const oportunidadFolio = row.cotizacion_principal_id
    ? formatearFolioDocumento(row.serie ?? '', Number(row.numero ?? row.cotizacion_principal_id ?? row.id))
    : `Op. #${row.id}`;

  return {
    id: row.id,
    tipo_actividad: row.tipo_actividad,
    fecha_programada: row.fecha_programada,
    estatus: row.estatus,
    notas: row.notas,
    contacto_id: row.contacto_id,
    oportunidad_id: row.oportunidad_id,
    cliente_nombre: row.cliente_nombre,
    oportunidad_nombre: row.oportunidad_nombre,
    oportunidad_folio: oportunidadFolio,
    monto_oportunidad: row.monto_oportunidad,
    oportunidad_fecha: row.oportunidad_fecha,
  };
}

function serializeActividadOportunidad(row: ActividadOportunidadRow) {
  return {
    id: row.id,
    tipo_actividad: row.tipo_actividad,
    fecha_programada: row.fecha_programada,
    estatus: row.estatus,
    notas: row.notas,
    contacto_id: row.contacto_id,
    oportunidad_id: row.oportunidad_id,
    cliente_nombre: row.cliente_nombre,
    resultado: row.resultado,
    fecha_realizacion: row.fecha_realizacion,
  };
}

function serializeActividadRecordatorio(row: ActividadRecordatorioRow) {
  return {
    id: row.id,
    tipo_actividad: row.tipo_actividad,
    notas: row.notas,
    fecha_programada: row.fecha_programada,
    contacto_id: row.contacto_id,
    oportunidad_id: row.oportunidad_id,
    cliente_nombre: row.cliente_nombre,
  };
}

async function obtenerContactoDesdeOportunidad(empresaId: number, oportunidadId: number) {
  const { rows } = await pool.query<OportunidadContactoRow>(
    `SELECT contacto_id
     FROM crm.oportunidades_venta
     WHERE id = $1
       AND empresa_id = $2
     LIMIT 1`,
    [oportunidadId, empresaId]
  );

  return rows[0] ?? null;
}

async function validarContactoEmpresa(empresaId: number, contactoId: number) {
  const { rows } = await pool.query<ContactoRow>(
    `SELECT id
     FROM public.contactos
     WHERE id = $1
       AND empresa_id = $2
     LIMIT 1`,
    [contactoId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerActividadDetallada(empresaId: number, actividadId: number) {
  const { rows } = await pool.query<ActividadRow>(
    `SELECT
       a.id,
       a.empresa_id,
       a.usuario_asignado_id,
       a.usuario_creador_id,
       a.contacto_id,
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
     LEFT JOIN public.contactos c
       ON c.id = a.contacto_id
      AND c.empresa_id = a.empresa_id
     WHERE a.id = $1
       AND a.empresa_id = $2
     LIMIT 1`,
    [actividadId, empresaId]
  );

  return rows[0] ?? null;
}

export async function listarRecordatoriosActividades(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const usuarioId = req.auth?.userId;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { rows } = await pool.query<ActividadRecordatorioRow>(
      `SELECT
         a.id,
         a.tipo_actividad,
         a.notas,
         a.fecha_programada,
         a.contacto_id,
         a.oportunidad_id,
         c.nombre AS cliente_nombre
       FROM crm.actividades a
       LEFT JOIN public.contactos c
         ON c.id = a.contacto_id
        AND c.empresa_id = a.empresa_id
       WHERE a.empresa_id = $1
         AND a.usuario_asignado_id = $2
         AND a.estatus = 'pendiente'
         AND a.recordatorio = TRUE
         AND a.recordatorio_disparado_at IS NULL
         AND (a.fecha_programada - make_interval(mins => COALESCE(a.recordatorio_minutos, 0))) <= NOW()
       ORDER BY a.fecha_programada ASC, a.id ASC`,
      [Number(empresaId), Number(usuarioId)]
    );

    return res.json(rows.map(serializeActividadRecordatorio));
  } catch (error) {
    console.error('Error al listar recordatorios de actividades:', {
      empresaId: req.context?.empresaId,
      usuarioId: req.auth?.userId,
      error,
    });
    return res.status(500).json({ message: 'Error al listar recordatorios de actividades' });
  }
}

export async function marcarRecordatorioActividadDisparado(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const usuarioId = req.auth?.userId;
    const actividadId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!Number.isInteger(actividadId) || actividadId <= 0) {
      return res.status(400).json({ message: 'id de actividad inválido' });
    }

    const { rows } = await pool.query<{ id: number }>(
      `UPDATE crm.actividades
       SET
         recordatorio_disparado_at = NOW(),
         updated_at = NOW()
       WHERE id = $1
         AND empresa_id = $2
         AND usuario_asignado_id = $3
       RETURNING id`,
      [actividadId, Number(empresaId), Number(usuarioId)]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al marcar recordatorio como disparado:', {
      empresaId: req.context?.empresaId,
      usuarioId: req.auth?.userId,
      actividadId: req.params.id,
      error,
    });
    return res.status(500).json({ message: 'Error al marcar recordatorio como disparado' });
  }
}

export async function listarActividadesUsuario(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const usuarioId = req.auth?.userId;
    const oportunidadIdRaw = req.query.oportunidad_id;
    const contactoIdRaw = req.query.contacto_id;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (oportunidadIdRaw !== undefined && contactoIdRaw !== undefined) {
      return res.status(400).json({ message: 'No puedes filtrar simultáneamente por oportunidad_id y contacto_id' });
    }

    if (oportunidadIdRaw !== undefined) {
      const oportunidadId = Number(oportunidadIdRaw);

      if (!Number.isInteger(oportunidadId) || oportunidadId <= 0) {
        return res.status(400).json({ message: 'oportunidad_id inválido' });
      }

      const { rows } = await pool.query<ActividadOportunidadRow>(
        `SELECT
           a.id,
           a.tipo_actividad,
           a.fecha_programada,
           a.estatus,
           a.notas,
           a.contacto_id,
           a.oportunidad_id,
           c.nombre AS cliente_nombre,
           a.resultado,
           a.fecha_realizacion
         FROM crm.actividades a
         LEFT JOIN public.contactos c
           ON c.id = a.contacto_id
          AND c.empresa_id = a.empresa_id
         WHERE a.empresa_id = $1
           AND a.oportunidad_id = $2
         ORDER BY fecha_programada DESC, id DESC`,
        [Number(empresaId), oportunidadId]
      );

      return res.json(rows.map(serializeActividadOportunidad));
    }

    if (contactoIdRaw !== undefined) {
      const contactoId = Number(contactoIdRaw);

      if (!Number.isInteger(contactoId) || contactoId <= 0) {
        return res.status(400).json({ message: 'contacto_id inválido' });
      }

      const { rows } = await pool.query<ActividadOportunidadRow>(
        `SELECT
           a.id,
           a.tipo_actividad,
           a.fecha_programada,
           a.estatus,
           a.notas,
           a.contacto_id,
           a.oportunidad_id,
           c.nombre AS cliente_nombre,
           a.resultado,
           a.fecha_realizacion
         FROM crm.actividades a
         LEFT JOIN public.contactos c
           ON c.id = a.contacto_id
          AND c.empresa_id = a.empresa_id
         WHERE a.empresa_id = $1
           AND a.contacto_id = $2
         ORDER BY a.fecha_programada DESC, a.id DESC`,
        [Number(empresaId), contactoId]
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
         a.contacto_id,
         a.oportunidad_id,
         c.nombre AS cliente_nombre,
         NULL::text AS oportunidad_nombre,
         d.id AS cotizacion_principal_id,
         d.serie,
         d.numero,
         COALESCE(SUM(
           CASE
             WHEN dp.es_parte_oportunidad IS TRUE THEN dp.subtotal_partida
             ELSE 0
           END
         ), 0) AS monto_oportunidad,
         o.created_at AS oportunidad_fecha,
         CASE
           WHEN a.estatus = 'realizada' THEN 'completadas'
           WHEN a.fecha_programada < NOW() THEN 'vencidas'
           WHEN a.fecha_programada >= NOW() AND DATE(a.fecha_programada) = CURRENT_DATE THEN 'hoy'
           ELSE 'futuras'
         END AS grupo
       FROM crm.actividades a
       LEFT JOIN crm.oportunidades_venta o
         ON o.id = a.oportunidad_id
        AND o.empresa_id = a.empresa_id
       LEFT JOIN public.contactos c
         ON c.id = a.contacto_id
        AND c.empresa_id = a.empresa_id
       LEFT JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       LEFT JOIN documentos_partidas dp
         ON dp.documento_id = d.id
       WHERE a.empresa_id = $1
         AND a.usuario_asignado_id = $2
         AND a.estatus IN ('pendiente', 'realizada')
       GROUP BY
         a.id,
         a.tipo_actividad,
         a.fecha_programada,
         a.estatus,
         a.notas,
         a.contacto_id,
         a.oportunidad_id,
         c.nombre,
         d.id,
         d.serie,
         d.numero,
         o.created_at
       ORDER BY a.fecha_programada ASC`,
      [Number(empresaId), Number(usuarioId)]
    );

    const response: ActividadesAgrupadasResponse = {
      vencidas: [],
      hoy: [],
      futuras: [],
      completadas: [],
    };

    for (const row of rows) {
      const serializada = serializeActividadListado(row);

      response[row.grupo].push(serializada);
    }

    return res.json(response);
  } catch (error) {
    console.error('Error al listar actividades del usuario:', {
      empresaId: req.context?.empresaId,
      usuarioId: req.auth?.userId,
      oportunidadId: req.query.oportunidad_id,
      contactoId: req.query.contacto_id,
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

    const contactoId = parseOptionalPositiveInt(body.contacto_id);

    if (contactoId === null) {
      return res.status(400).json({ message: 'contacto_id debe ser un entero positivo' });
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

    let contactoIdFinal: number;

    if (oportunidadId !== undefined) {
      const oportunidad = await obtenerContactoDesdeOportunidad(Number(empresaId), oportunidadId);

      if (!oportunidad?.contacto_id) {
        return res.status(400).json({ message: 'oportunidad_id no corresponde a una oportunidad válida' });
      }

      contactoIdFinal = oportunidad.contacto_id;
    } else {
      if (contactoId === undefined) {
        return res.status(400).json({ message: 'contacto_id es obligatorio cuando la actividad no está vinculada a una oportunidad' });
      }

      const contacto = await validarContactoEmpresa(Number(empresaId), contactoId);

      if (!contacto) {
        return res.status(400).json({ message: 'contacto_id no corresponde a un contacto válido' });
      }

      contactoIdFinal = contactoId;
    }

    const { rows } = await pool.query<Pick<ActividadRow, 'id'>>(
      `INSERT INTO crm.actividades (
         empresa_id,
         usuario_asignado_id,
         usuario_creador_id,
         contacto_id,
         oportunidad_id,
         tipo_actividad,
         fecha_programada,
         notas,
         estatus,
         recordatorio,
         recordatorio_minutos
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', COALESCE($9, FALSE), $10)
       RETURNING id`,
      [
        Number(empresaId),
        usuarioAsignadoId,
        Number(usuarioCreadorId),
        contactoIdFinal,
        oportunidadId ?? null,
        tipoActividad,
        fechaProgramada,
        notas,
        recordatorio,
        recordatorioMinutos ?? null,
      ]
    );

    const actividad = await obtenerActividadDetallada(Number(empresaId), rows[0].id);

    if (!actividad) {
      return res.status(500).json({ message: 'No se pudo recuperar la actividad creada' });
    }

    return res.status(201).json(serializeActividad(actividad));
  } catch (error) {
    console.error('Error al crear actividad:', {
      empresaId: req.context?.empresaId,
      usuarioCreadorId: req.auth?.userId,
      usuarioAsignadoId: req.body?.usuario_asignado_id,
      contactoId: req.body?.contacto_id,
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

    const actividad = await obtenerActividadDetallada(Number(empresaId), actividadId);

    if (!actividad) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    return res.json(serializeActividad(actividad));
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

    const contactoId = parseOptionalPositiveInt(body.contacto_id);

    if (contactoId === null) {
      return res.status(400).json({ message: 'contacto_id debe ser un entero positivo' });
    }

    const recordatorioProvided = Object.prototype.hasOwnProperty.call(body, 'recordatorio');
    const recordatorio = parseOptionalBoolean(body.recordatorio);

    if (recordatorioProvided && recordatorio === null) {
      return res.status(400).json({ message: 'recordatorio debe ser booleano' });
    }

    const recordatorioMinutosProvided = Object.prototype.hasOwnProperty.call(body, 'recordatorio_minutos');
    const recordatorioMinutos = parseOptionalPositiveInt(body.recordatorio_minutos);

    if (recordatorioMinutos === null) {
      return res.status(400).json({ message: 'recordatorio_minutos debe ser un entero positivo' });
    }

    const notas = typeof body.notas === 'string'
      ? body.notas.trim() || null
      : body.notas == null
        ? null
        : String(body.notas);

    const { rows: actividadExistenteRows } = await pool.query<ActividadExistenteRow>(
      `SELECT id, contacto_id
       FROM crm.actividades
       WHERE id = $1
         AND empresa_id = $2
       LIMIT 1`,
      [actividadId, Number(empresaId)]
    );

    if (!actividadExistenteRows.length) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    const actividadExistente = actividadExistenteRows[0];

    let contactoIdFinal: number;

    if (oportunidadId !== undefined) {
      const oportunidad = await obtenerContactoDesdeOportunidad(Number(empresaId), oportunidadId);

      if (!oportunidad?.contacto_id) {
        return res.status(400).json({ message: 'oportunidad_id no corresponde a una oportunidad válida' });
      }

      contactoIdFinal = oportunidad.contacto_id;
    } else if (contactoId !== undefined) {
      const contacto = await validarContactoEmpresa(Number(empresaId), contactoId);

      if (!contacto) {
        return res.status(400).json({ message: 'contacto_id no corresponde a un contacto válido' });
      }

      contactoIdFinal = contactoId;
    } else if (actividadExistente.contacto_id) {
      contactoIdFinal = actividadExistente.contacto_id;
    } else {
      return res.status(400).json({ message: 'contacto_id es obligatorio cuando la actividad no está vinculada a una oportunidad' });
    }

    const { rows } = await pool.query<Pick<ActividadRow, 'id'>>(
      `UPDATE crm.actividades
       SET
         tipo_actividad = $1,
         fecha_programada = $2,
         notas = $3,
         contacto_id = $4,
         oportunidad_id = $5,
         recordatorio = CASE
           WHEN $6::boolean THEN COALESCE($7, FALSE)
           ELSE recordatorio
         END,
         recordatorio_minutos = CASE
           WHEN $6::boolean AND COALESCE($7, FALSE) = FALSE THEN NULL
           WHEN $8::boolean THEN $9
           ELSE recordatorio_minutos
         END,
         updated_at = NOW()
       WHERE id = $10
         AND empresa_id = $11
       RETURNING id`,
      [
        tipoActividad,
        fechaProgramada,
        notas,
        contactoIdFinal,
        oportunidadId ?? null,
        recordatorioProvided,
        recordatorio,
        recordatorioMinutosProvided,
        recordatorioMinutos ?? null,
        actividadId,
        Number(empresaId),
      ]
    );

    const actividad = await obtenerActividadDetallada(Number(empresaId), rows[0].id);

    if (!actividad) {
      return res.status(500).json({ message: 'No se pudo recuperar la actividad actualizada' });
    }

    return res.json(serializeActividad(actividad));
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

    const { rows } = await pool.query<Pick<ActividadRow, 'id'>>(
      `UPDATE crm.actividades
       SET
         estatus = $1::varchar,
         resultado = CASE WHEN $1::text = 'realizada' THEN $2::text ELSE resultado END,
         fecha_realizacion = CASE WHEN $1::text = 'realizada' THEN NOW() ELSE fecha_realizacion END,
         updated_at = NOW()
       WHERE id = $3
         AND empresa_id = $4
       RETURNING id`,
      [nuevoEstatus, resultado || null, actividadId, Number(empresaId)]
    );

    const actividadActualizada = await obtenerActividadDetallada(Number(empresaId), rows[0].id);

    if (!actividadActualizada) {
      return res.status(500).json({ message: 'No se pudo recuperar la actividad actualizada' });
    }

    return res.json(serializeActividad(actividadActualizada));
  } catch (error) {
    console.error('Error al actualizar estatus de actividad:', error);
    return res.status(500).json({ message: 'Error al actualizar actividad' });
  }
}