import type { Request, Response } from 'express';
import { actualizarActivoDomicilioEmpresa, actualizarDomicilioEmpresa, crearDomicilioEmpresa, listarDomiciliosEmpresa } from './empresa-domicilios.repository';

const contextEmpresa = (req: Request) => Number(req.context?.empresaId);
const id = (req: Request) => Number(req.params.domicilioId);

export async function getDomiciliosEmpresa(req: Request, res: Response) { return res.json(await listarDomiciliosEmpresa(contextEmpresa(req))); }
export async function postDomicilioEmpresa(req: Request, res: Response) { try { return res.status(201).json(await crearDomicilioEmpresa(contextEmpresa(req), req.body)); } catch (e: any) { return res.status(e?.code === '23505' ? 409 : 400).json({ message: e?.code === '23505' ? 'Ya existe un domicilio con ese identificador o principal' : e.message }); } }
export async function putDomicilioEmpresa(req: Request, res: Response) { try { const result = await actualizarDomicilioEmpresa(contextEmpresa(req), id(req), req.body); return result ? res.json(result) : res.status(404).json({ message: 'Domicilio propio no encontrado' }); } catch (e: any) { return res.status(e?.code === '23505' ? 409 : 400).json({ message: e?.code === '23505' ? 'Ya existe un domicilio con ese identificador o principal' : e.message }); } }
export async function patchActivoDomicilioEmpresa(req: Request, res: Response) { const result = await actualizarActivoDomicilioEmpresa(contextEmpresa(req), id(req), req.body?.activo === true); return result ? res.json(result) : res.status(404).json({ message: 'Domicilio propio no encontrado' }); }
