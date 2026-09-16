import pool from '../../config/database';

export type MensajeMetrica = { id: number; empresa_id: number; conversacion_id: number; contacto_id: number; contacto_id_inconsistente: boolean; tipo_mensaje: 'entrante'|'saliente'; canal: string|null; fecha: string; creado_en: string; status: string|null; origen_envio: string|null; autor_usuario_id: number|null; autor_vendedor_contacto_id: number|null; responsabilidad_contacto_id: number|null; responsabilidad_inicio_id: number|null; responsable_inicio_contacto_id: number|null; previo_al_corte: boolean };
export type HorarioLaboral = { empresa_id: number; dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean };
export type ExcepcionLaboral = { empresa_id: number; fecha: string; tipo: 'inhabil'|'horario_especial'; hora_inicio: string|null; hora_fin: string|null };
export type ResponsabilidadMetrica = { id: number; empresa_id: number; contacto_id: number; vendedor_contacto_id: number; vigente_desde: string; vigente_hasta: string|null };

export async function cargarDatosMetrica(corte = '2026-09-15T21:55:41.716Z', empresaId?: number) {
  const mensajes = await pool.query<MensajeMetrica>(`SELECT m.id,m.empresa_id,m.conversacion_id,COALESCE(m.contacto_id,c.contacto_id) AS contacto_id,(m.contacto_id IS NOT NULL AND m.contacto_id IS DISTINCT FROM c.contacto_id) AS contacto_id_inconsistente,m.tipo_mensaje,m.canal,COALESCE(m.fecha_envio,m.creado_en) AS fecha,m.creado_en,m.status,m.origen_envio,m.autor_usuario_id,m.autor_vendedor_contacto_id,m.responsabilidad_contacto_id,ri.id AS responsabilidad_inicio_id,ri.vendedor_contacto_id AS responsable_inicio_contacto_id,EXISTS (SELECT 1 FROM crm.mensajes anterior WHERE anterior.empresa_id=m.empresa_id AND anterior.conversacion_id=m.conversacion_id AND anterior.tipo_mensaje IN ('entrante','saliente') AND COALESCE(anterior.fecha_envio,anterior.creado_en) < $1) AS previo_al_corte FROM crm.mensajes m JOIN crm.conversaciones c ON c.id=m.conversacion_id AND c.empresa_id=m.empresa_id LEFT JOIN LATERAL (SELECT r.id,r.vendedor_contacto_id FROM crm.contacto_responsabilidades r WHERE r.empresa_id=m.empresa_id AND r.contacto_id=COALESCE(m.contacto_id,c.contacto_id) AND r.vigente_desde <= COALESCE(m.fecha_envio,m.creado_en) AND (r.vigente_hasta IS NULL OR COALESCE(m.fecha_envio,m.creado_en) < r.vigente_hasta) ORDER BY r.vigente_desde DESC LIMIT 1) ri ON true WHERE m.tipo_mensaje IN ('entrante','saliente') AND m.canal='whatsapp' AND COALESCE(m.fecha_envio,m.creado_en) >= $1 AND ($2::int IS NULL OR m.empresa_id = $2) ORDER BY m.empresa_id,m.conversacion_id,COALESCE(m.fecha_envio,m.creado_en),m.id`, [corte, empresaId ?? null]);
  const empresa = await pool.query<{ id: number; zona_horaria: string|null }>('SELECT id,zona_horaria FROM core.empresas WHERE id IN (SELECT DISTINCT empresa_id FROM crm.mensajes WHERE tipo_mensaje IN (\'entrante\',\'saliente\') AND canal=\'whatsapp\') AND ($1::int IS NULL OR id = $1)', [empresaId ?? null]);
  const ids = empresa.rows.map((e) => e.id);
  const [horarios, excepciones, responsabilidades] = await Promise.all([
    pool.query<HorarioLaboral>('SELECT empresa_id,dia_semana,hora_inicio,hora_fin,activo FROM core.empresa_horarios_laborales WHERE empresa_id = ANY($1::int[]) ORDER BY empresa_id,dia_semana', [ids]),
    pool.query<ExcepcionLaboral>('SELECT empresa_id,fecha,tipo,hora_inicio,hora_fin FROM core.empresa_excepciones_laborales WHERE empresa_id = ANY($1::int[]) ORDER BY empresa_id,fecha', [ids]),
    pool.query<ResponsabilidadMetrica>('SELECT id,empresa_id,contacto_id,vendedor_contacto_id,vigente_desde,vigente_hasta FROM crm.contacto_responsabilidades WHERE empresa_id = ANY($1::int[]) ORDER BY empresa_id,contacto_id,vigente_desde', [ids]),
  ]);
  return { mensajes: mensajes.rows, empresas: empresa.rows, horarios: horarios.rows, excepciones: excepciones.rows, responsabilidades: responsabilidades.rows };
}

export async function obtenerNombresVendedores(empresaId: number, ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const { rows } = await pool.query<{ id: number; nombre: string }>('SELECT id,nombre FROM public.contactos WHERE empresa_id=$1 AND id=ANY($2::int[])', [empresaId, ids]);
  return new Map(rows.map((row) => [row.id, row.nombre]));
}
