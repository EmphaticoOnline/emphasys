import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  closeActividad, continueActividad, createActividad, createTarea, listActividades, listFrentes,
  listTareas, rescheduleActividad, updateTarea,
  createCaptura, listCapturas, processCaptura,
  type Actividad, type ActividadCierre, type ActividadCreate, type ActividadDerivada,
  type ActividadFilters, type Frente, type Tarea, type TareaCreate, type TareaFilters, type TareaPatch,
  type Captura, type ProcesarCaptura,
} from "../../services/compassService"

type RealWorkState = {
  frentes: Frente[]; tareas: Tarea[]; actividades: Actividad[]; loading: boolean; error: string;
  loadFrentes: () => Promise<void>; loadTareas: (filters?: TareaFilters) => Promise<void>;
  loadActividades: (filters?: ActividadFilters) => Promise<void>;
  crearTarea: (payload: TareaCreate) => Promise<Tarea>; actualizarTarea: (id: number, patch: TareaPatch) => Promise<Tarea>;
  crearActividad: (payload: ActividadCreate) => Promise<Actividad>;
  cerrarActividad: (id: number, payload: ActividadCierre) => Promise<Actividad>;
  reprogramarActividad: (id: number, payload: ActividadDerivada) => Promise<Actividad>;
  continuarActividad: (id: number, payload: ActividadDerivada) => Promise<Actividad>;
  capturas: Captura[]; loadCapturas: () => Promise<void>; crearCaptura: (texto:string) => Promise<Captura>;
  procesarCaptura: (id:number,payload:ProcesarCaptura) => Promise<Captura>;
};
const Context = createContext<RealWorkState | null>(null)
const states = ['activo', 'pausado', 'completado', 'archivado'] as const

export function RealWorkProvider({ children }: { children: ReactNode }) {
  const [frentes, setFrentes] = useState<Frente[]>([]); const [tareas, setTareas] = useState<Tarea[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("")
  const [capturas,setCapturas]=useState<Captura[]>([])
  const run = useCallback(async <T,>(work: () => Promise<T>) => { try { setLoading(true); setError(""); return await work() } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar Compass"); throw reason } finally { setLoading(false) } }, [])
  const loadFrentes = useCallback(async () => { await run(async () => setFrentes(await listFrentes([...states]))) }, [run])
  const loadTareas = useCallback(async (filters: TareaFilters = {}) => { await run(async () => setTareas(await listTareas(filters))) }, [run])
  const loadActividades = useCallback(async (filters: ActividadFilters = {}) => { await run(async () => setActividades(await listActividades(filters))) }, [run])
  const loadCapturas = useCallback(async () => { await run(async () => setCapturas(await listCapturas())) }, [run])
  const value = useMemo<RealWorkState>(() => ({ frentes,tareas,actividades,capturas,loading,error,loadFrentes,loadTareas,loadActividades,loadCapturas,
    crearTarea: payload => run(() => createTarea(payload)), actualizarTarea: (id,patch) => run(() => updateTarea(id,patch)),
    crearActividad: payload => run(() => createActividad(payload)), cerrarActividad: (id,payload) => run(() => closeActividad(id,payload)),
    reprogramarActividad: (id,payload) => run(() => rescheduleActividad(id,payload)), continuarActividad: (id,payload) => run(() => continueActividad(id,payload)),
    crearCaptura: texto => run(() => createCaptura(texto)), procesarCaptura: (id,payload) => run(() => processCaptura(id,payload)),
  }),[frentes,tareas,actividades,capturas,loading,error,loadFrentes,loadTareas,loadActividades,loadCapturas,run])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useRealWork(){const value=useContext(Context);if(!value)throw new Error('useRealWork requiere RealWorkProvider');return value}
