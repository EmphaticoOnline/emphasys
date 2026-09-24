import pool from '../config/database';
import { enviarPushAUsuario } from '../modules/notificaciones/notificaciones.service';

const LOCK_NAMESPACE = 727003;
const LOCK_KEY = 1;
const CYCLE_MS = 30_000;
let timer: NodeJS.Timeout | null = null;
let started = false;

type Candidate = { id: number; empresa_id: number; usuario_asignado_id: number; tipo_actividad: string; notas: string | null; fecha_programada: Date; recordatorio_minutos: number | null; zona_horaria: string | null };

async function enHorarioLaboral(candidate: Candidate, now: Date): Promise<boolean> {
  if (!candidate.zona_horaria) return true;
  const p = new Intl.DateTimeFormat('en-US', { timeZone: candidate.zona_horaria, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
  const day = ({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6} as Record<string,number>)[p.find(x => x.type === 'weekday')?.value ?? 'Sun'];
  const hh = Number(p.find(x => x.type === 'hour')?.value ?? 0); const mm = Number(p.find(x => x.type === 'minute')?.value ?? 0); const current = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
  const { rows } = await pool.query(`SELECT h.hora_inicio,h.hora_fin,h.activo,x.tipo,x.hora_inicio AS ex_inicio,x.hora_fin AS ex_fin
    FROM core.empresa_horarios_laborales h LEFT JOIN core.empresa_excepciones_laborales x ON x.empresa_id=h.empresa_id AND x.fecha=(CURRENT_TIMESTAMP AT TIME ZONE $2)::date
    WHERE h.empresa_id=$1 AND h.dia_semana=$3`, [candidate.empresa_id, candidate.zona_horaria, day]);
  const row = rows[0]; if (!row || row.activo === false || row.tipo === 'inhabil') return false;
  const start = row.tipo === 'horario_especial' ? row.ex_inicio : row.hora_inicio; const end = row.tipo === 'horario_especial' ? row.ex_fin : row.hora_fin;
  return Boolean(start && end && current >= String(start).slice(0,8) && current <= String(end).slice(0,8));
}

async function ciclo() {
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1,$2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
    if (!lock.rows[0]?.locked) return;
    try {
      const { rows } = await client.query<Candidate>(`SELECT a.id,a.empresa_id,a.usuario_asignado_id,a.tipo_actividad,a.notas,a.fecha_programada,a.recordatorio_minutos,e.zona_horaria
        FROM crm.actividades a JOIN core.empresas e ON e.id=a.empresa_id
        WHERE a.estatus='pendiente' AND a.recordatorio=true AND a.recordatorio_push_entregado_at IS NULL
          AND (a.recordatorio_push_claimed_at IS NULL OR a.recordatorio_push_claimed_at < NOW()-INTERVAL '2 minutes')
          AND a.fecha_programada - make_interval(mins=>COALESCE(a.recordatorio_minutos,0)) <= NOW()
          AND (a.recordatorio_push_ultimo_intento_at IS NULL OR a.recordatorio_push_ultimo_intento_at < NOW()-INTERVAL '1 minute')
        ORDER BY a.fecha_programada,a.id LIMIT 100`);
      for (const candidate of rows) {
        if (!(await enHorarioLaboral(candidate, new Date()))) continue;
        const claimed = await client.query(`UPDATE crm.actividades SET recordatorio_push_claimed_at=NOW(),recordatorio_push_ultimo_intento_at=NOW(),recordatorio_push_error=NULL,updated_at=NOW()
          WHERE id=$1 AND recordatorio_push_entregado_at IS NULL AND (recordatorio_push_claimed_at IS NULL OR recordatorio_push_claimed_at < NOW()-INTERVAL '2 minutes') RETURNING id`, [candidate.id]);
        if (!claimed.rows.length) continue;
        try {
          const result = await enviarPushAUsuario(candidate.usuario_asignado_id, { title: 'Recordatorio', body: candidate.notas?.trim() || `Actividad de ${candidate.tipo_actividad}`, url: `/crm/actividades/${candidate.id}`, tag: `actividad-recordatorio-${candidate.id}`, data: { type: 'activity-reminder', activityId: candidate.id } }, { respectPreferences: true });
          if (result.subscriptionsFound > 0 && result.successful > 0) await client.query(`UPDATE crm.actividades SET recordatorio_push_entregado_at=NOW(),recordatorio_push_claimed_at=NULL,recordatorio_push_error=NULL,updated_at=NOW() WHERE id=$1`, [candidate.id]);
          else await client.query(`UPDATE crm.actividades SET recordatorio_push_claimed_at=NULL,recordatorio_push_error=$2,updated_at=NOW() WHERE id=$1`, [candidate.id, 'NO_ACTIVE_PUSH_SUBSCRIPTION']);
        } catch (error) {
          await client.query(`UPDATE crm.actividades SET recordatorio_push_claimed_at=NULL,recordatorio_push_error=$2,updated_at=NOW() WHERE id=$1`, [candidate.id, error instanceof Error ? error.message.slice(0,160) : 'PUSH_SEND_ERROR']);
        }
      }
    } finally { await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]); }
  } finally { client.release(); }
}

export function iniciarRecordatoriosActividadesJob() { if (started) return; started=true; timer=setInterval(() => { void ciclo(); }, CYCLE_MS); timer.unref(); void ciclo(); }
export function detenerRecordatoriosActividadesJob() { if (timer) clearInterval(timer); timer=null; started=false; }
