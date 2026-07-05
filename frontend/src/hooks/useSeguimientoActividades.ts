import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/apiFetch';

type TipoActividad = 'llamada' | 'whatsapp' | 'visita' | 'tarea';

type Actividad = {
  id: number;
  tipo_actividad: TipoActividad;
  fecha_programada: string;
  estatus: 'pendiente' | 'realizada' | 'cancelada' | string;
  notas: string | null;
  oportunidad_id: number | null;
  descripcion?: string | null;
  observaciones?: string | null;
  resultado?: string | null;
  fecha_realizacion?: string | null;
};

type ActividadesPendientesAgrupadas = {
  vencidas: Actividad[];
  hoy: Actividad[];
  futuras: Actividad[];
};

export type SeguimientoResumen = {
  pendingCount: number;
  overdueCount: number;
  todayCount: number;
};

export type SeguimientoChipPresentation = {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

async function fetchActividadesPendientesUsuario() {
  return apiFetch<ActividadesPendientesAgrupadas>('/api/crm/actividades');
}

/**
 * Carga y agrega el resumen de actividades pendientes del usuario por oportunidad,
 * y calcula la presentación del chip de seguimiento (Sin actividad / Vencida / Pendiente hoy / Al día).
 * Compartido entre OportunidadesPage y DocumentosPage (grilla de cotizaciones) para
 * no duplicar el cálculo del estado de seguimiento — el mismo oportunidad_id siempre
 * produce el mismo chip en ambas vistas.
 */
export function useSeguimientoActividades(enabled = true) {
  const [seguimientoResumenByOportunidad, setSeguimientoResumenByOportunidad] = useState<Record<number, SeguimientoResumen>>({});
  const [loadingSeguimientoResumen, setLoadingSeguimientoResumen] = useState(false);
  const [seguimientoError, setSeguimientoError] = useState<string | null>(null);

  const loadSeguimientoResumen = useCallback(async () => {
    setLoadingSeguimientoResumen(true);

    try {
      const data = await fetchActividadesPendientesUsuario();
      const nextSummary: Record<number, SeguimientoResumen> = {};

      const register = (items: Actividad[], kind: 'vencidas' | 'hoy' | 'futuras') => {
        for (const actividad of items) {
          const oportunidadId = actividad.oportunidad_id;

          if (!oportunidadId || actividad.estatus !== 'pendiente') {
            continue;
          }

          const current = nextSummary[oportunidadId] ?? {
            pendingCount: 0,
            overdueCount: 0,
            todayCount: 0,
          };

          current.pendingCount += 1;

          if (kind === 'vencidas') {
            current.overdueCount += 1;
          }

          if (kind === 'hoy') {
            current.todayCount += 1;
          }

          nextSummary[oportunidadId] = current;
        }
      };

      register(Array.isArray(data?.vencidas) ? data.vencidas : [], 'vencidas');
      register(Array.isArray(data?.hoy) ? data.hoy : [], 'hoy');
      register(Array.isArray(data?.futuras) ? data.futuras : [], 'futuras');

      setSeguimientoResumenByOportunidad(nextSummary);
      setSeguimientoError(null);
    } catch (err) {
      setSeguimientoError(err instanceof Error ? err.message : 'No se pudo cargar el resumen de seguimiento.');
    } finally {
      setLoadingSeguimientoResumen(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadSeguimientoResumen();
  }, [enabled, loadSeguimientoResumen]);

  const getSeguimientoChipPresentation = useCallback((oportunidadId: number): SeguimientoChipPresentation => {
    if (loadingSeguimientoResumen) {
      return {
        label: '...',
        backgroundColor: '#f8fafc',
        textColor: '#64748b',
        borderColor: '#cbd5e1',
      };
    }

    const summary = seguimientoResumenByOportunidad[oportunidadId];

    // Sin actividad pendiente/futura registrada: no hay siguiente paso definido.
    // No es "Al día" — es una alerta suave, no una confirmación de que todo está bien.
    if (!summary || summary.pendingCount === 0) {
      return {
        label: 'Sin actividad',
        backgroundColor: '#fffbeb',
        textColor: '#b45309',
        borderColor: '#fde68a',
      };
    }

    // Vencida tiene prioridad sobre cualquier otro estado.
    if (summary.overdueCount > 0) {
      return {
        label: `Vencida (${summary.overdueCount})`,
        backgroundColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
      };
    }

    if (summary.todayCount > 0) {
      return {
        label: 'Pendiente hoy',
        backgroundColor: '#fff7ed',
        textColor: '#b45309',
        borderColor: '#fdba74',
      };
    }

    // Sin vencidas ni pendientes de hoy, pero hay una actividad futura programada: al día.
    return {
      label: 'Al dia',
      backgroundColor: '#ecfdf5',
      textColor: '#047857',
      borderColor: '#a7f3d0',
    };
  }, [loadingSeguimientoResumen, seguimientoResumenByOportunidad]);

  return {
    seguimientoResumenByOportunidad,
    loadingSeguimientoResumen,
    seguimientoError,
    loadSeguimientoResumen,
    getSeguimientoChipPresentation,
  };
}
