import type { Request, Response } from 'express';
import { actualizarFrente, crearFrente, listarFrentes, obtenerFrente, upsertIntencion } from './compass.repository';
import { CompassValidationError, parseEstados, parseFrenteCreate, parseFrentePatch, parseIntencionSemanal, parsePositiveId } from './compass.validation';
import { actualizarActividad, actualizarTarea, cerrarActividad, CompassBusinessError, CompassNotFoundError, continuarActividad, crearActividad, crearTarea, eliminarActividad, listarActividades, listarTareas, obtenerActividad, obtenerTarea, reprogramarActividad } from './compass-work.repository';
import { parseActividadCreate, parseActividadFilters, parseActividadPatch, parseCierreActividad, parseDerivadaActividad, parseTareaCreate, parseTareaFilters, parseTareaPatch } from './compass.validation';
import { actualizarEstadoCaptura, crearCaptura, listarCapturas, procesarCaptura } from './compass-capture.repository';
import { parseCapturaCreate, parseCapturaEstado, parseCapturaPatch, parseProcesarCaptura } from './compass.validation';
import { actualizarDecision, actualizarIdea, convertirIdea, crearDecision, crearIdea, listarDecisiones, listarIdeas, obtenerDecision, obtenerIdea } from './compass-knowledge.repository';
import { parseConvertirIdea, parseDecisionCreate, parseDecisionPatch, parseIdeaCreate, parseIdeaPatch } from './compass.validation';
import { guardarRevision, obtenerRevision } from './compass-review.repository';
import { parseRevisionSemanal, parseSemanaInicio } from './compass.validation';

function ownerScope(req: Request) {
  return { empresaId: req.context?.empresaId ?? null, usuarioId: Number(req.auth?.userId ?? 0) };
}

function handleError(res: Response, error: unknown, operation: string) {
  if (error instanceof CompassValidationError) return res.status(400).json({ message: error.message });
  if (error instanceof CompassNotFoundError) return res.status(404).json({ message: error.message });
  if (error instanceof CompassBusinessError) return res.status(409).json({ message: error.message });
  console.error(`Error al ${operation} en Compass:`, error);
  return res.status(500).json({ message: `Error al ${operation}` });
}

export async function getTareas(req: Request,res: Response){try{return res.json(await listarTareas(ownerScope(req),parseTareaFilters(req.query as Record<string,unknown>)));}catch(error){return handleError(res,error,'listar Tareas');}}
export async function getTarea(req:Request,res:Response){try{const item=await obtenerTarea(ownerScope(req),parsePositiveId(req.params.id));return item?res.json(item):res.status(404).json({message:'Tarea no encontrada'});}catch(error){return handleError(res,error,'consultar la Tarea');}}
export async function postTarea(req:Request,res:Response){try{return res.status(201).json(await crearTarea(ownerScope(req),parseTareaCreate(req.body)));}catch(error){return handleError(res,error,'crear la Tarea');}}
export async function patchTarea(req:Request,res:Response){try{return res.json(await actualizarTarea(ownerScope(req),parsePositiveId(req.params.id),parseTareaPatch(req.body)));}catch(error){return handleError(res,error,'actualizar la Tarea');}}
export async function getActividades(req:Request,res:Response){try{return res.json(await listarActividades(ownerScope(req),parseActividadFilters(req.query as Record<string,unknown>)));}catch(error){return handleError(res,error,'listar Actividades');}}
export async function getActividad(req:Request,res:Response){try{const item=await obtenerActividad(ownerScope(req),parsePositiveId(req.params.id));return item?res.json(item):res.status(404).json({message:'Actividad no encontrada'});}catch(error){return handleError(res,error,'consultar la Actividad');}}
export async function postActividad(req:Request,res:Response){try{return res.status(201).json(await crearActividad(ownerScope(req),parseActividadCreate(req.body)));}catch(error){return handleError(res,error,'crear la Actividad');}}
export async function patchActividad(req:Request,res:Response){try{return res.json(await actualizarActividad(ownerScope(req),parsePositiveId(req.params.id),parseActividadPatch(req.body)));}catch(error){return handleError(res,error,'actualizar la Actividad');}}
export async function deleteActividad(req:Request,res:Response){try{await eliminarActividad(ownerScope(req),parsePositiveId(req.params.id));return res.status(204).send();}catch(error){return handleError(res,error,'eliminar la Actividad');}}
export async function postCerrarActividad(req:Request,res:Response){try{return res.json(await cerrarActividad(ownerScope(req),parsePositiveId(req.params.id),parseCierreActividad(req.body)));}catch(error){return handleError(res,error,'cerrar la Actividad');}}
export async function postReprogramarActividad(req:Request,res:Response){try{return res.status(201).json(await reprogramarActividad(ownerScope(req),parsePositiveId(req.params.id),parseDerivadaActividad(req.body)));}catch(error){return handleError(res,error,'reprogramar la Actividad');}}
export async function postContinuarActividad(req:Request,res:Response){try{return res.status(201).json(await continuarActividad(ownerScope(req),parsePositiveId(req.params.id),parseDerivadaActividad(req.body)));}catch(error){return handleError(res,error,'continuar la Actividad');}}
export async function getCapturas(req:Request,res:Response){try{return res.json(await listarCapturas(ownerScope(req),parseCapturaEstado(req.query.estado)));}catch(error){return handleError(res,error,'listar Capturas');}}
export async function postCaptura(req:Request,res:Response){try{const input=parseCapturaCreate(req.body);return res.status(201).json(await crearCaptura(ownerScope(req),input.texto));}catch(error){return handleError(res,error,'crear la Captura');}}
export async function patchCaptura(req:Request,res:Response){try{const input=parseCapturaPatch(req.body);return res.json(await actualizarEstadoCaptura(ownerScope(req),parsePositiveId(req.params.id),input.estado));}catch(error){return handleError(res,error,'actualizar la Captura');}}
export async function postProcesarCaptura(req:Request,res:Response){try{return res.json(await procesarCaptura(ownerScope(req),parsePositiveId(req.params.id),parseProcesarCaptura(req.body)));}catch(error){return handleError(res,error,'procesar la Captura');}}
export async function getIdeas(req:Request,res:Response){try{const estado=req.query.estado==null||req.query.estado===''?undefined:String(req.query.estado) as 'activa'|'archivada';if(estado&&!['activa','archivada'].includes(estado))throw new CompassValidationError('estado inválido');return res.json(await listarIdeas(ownerScope(req),estado));}catch(error){return handleError(res,error,'listar Ideas');}}
export async function getIdea(req:Request,res:Response){try{const x=await obtenerIdea(ownerScope(req),parsePositiveId(req.params.id));return x?res.json(x):res.status(404).json({message:'Idea no encontrada'});}catch(error){return handleError(res,error,'consultar la Idea');}}
export async function postIdea(req:Request,res:Response){try{return res.status(201).json(await crearIdea(ownerScope(req),parseIdeaCreate(req.body)));}catch(error){return handleError(res,error,'crear la Idea');}}
export async function patchIdea(req:Request,res:Response){try{return res.json(await actualizarIdea(ownerScope(req),parsePositiveId(req.params.id),parseIdeaPatch(req.body)));}catch(error){return handleError(res,error,'actualizar la Idea');}}
export async function postConvertirIdea(req:Request,res:Response){try{return res.json(await convertirIdea(ownerScope(req),parsePositiveId(req.params.id),parseConvertirIdea(req.body)));}catch(error){return handleError(res,error,'convertir la Idea');}}
export async function getDecisiones(req:Request,res:Response){try{return res.json(await listarDecisiones(ownerScope(req)));}catch(error){return handleError(res,error,'listar Decisiones');}}
export async function getDecision(req:Request,res:Response){try{const x=await obtenerDecision(ownerScope(req),parsePositiveId(req.params.id));return x?res.json(x):res.status(404).json({message:'Decisión no encontrada'});}catch(error){return handleError(res,error,'consultar la Decisión');}}
export async function postDecision(req:Request,res:Response){try{return res.status(201).json(await crearDecision(ownerScope(req),parseDecisionCreate(req.body)));}catch(error){return handleError(res,error,'crear la Decisión');}}
export async function patchDecision(req:Request,res:Response){try{return res.json(await actualizarDecision(ownerScope(req),parsePositiveId(req.params.id),parseDecisionPatch(req.body)));}catch(error){return handleError(res,error,'actualizar la Decisión');}}
export async function getRevisionSemanal(req:Request,res:Response){try{return res.json(await obtenerRevision(ownerScope(req),parseSemanaInicio(req.params.semana_inicio)));}catch(error){return handleError(res,error,'consultar la Revisión semanal');}}
export async function putRevisionSemanal(req:Request,res:Response){try{return res.json(await guardarRevision(ownerScope(req),parseRevisionSemanal(req.body)));}catch(error){return handleError(res,error,'guardar la Revisión semanal');}}

export async function getFrentes(req: Request, res: Response) {
  try { return res.json(await listarFrentes(ownerScope(req), parseEstados(req.query.estado))); }
  catch (error) { return handleError(res, error, 'listar Frentes'); }
}

export async function getFrente(req: Request, res: Response) {
  try {
    const frente = await obtenerFrente(ownerScope(req), parsePositiveId(req.params.id));
    return frente ? res.json(frente) : res.status(404).json({ message: 'Frente no encontrado' });
  } catch (error) { return handleError(res, error, 'consultar el Frente'); }
}

export async function postFrente(req: Request, res: Response) {
  try { return res.status(201).json(await crearFrente(ownerScope(req), parseFrenteCreate(req.body))); }
  catch (error) { return handleError(res, error, 'crear el Frente'); }
}

export async function patchFrente(req: Request, res: Response) {
  try {
    const frente = await actualizarFrente(ownerScope(req), parsePositiveId(req.params.id), parseFrentePatch(req.body));
    return frente ? res.json(frente) : res.status(404).json({ message: 'Frente no encontrado' });
  } catch (error) { return handleError(res, error, 'actualizar el Frente'); }
}

export async function putIntencionSemanal(req: Request, res: Response) {
  try {
    const intencion = await upsertIntencion(ownerScope(req), parsePositiveId(req.params.id), parseIntencionSemanal(req.body));
    return intencion ? res.json(intencion) : res.status(404).json({ message: 'Frente no encontrado' });
  } catch (error) { return handleError(res, error, 'guardar la intención semanal'); }
}
