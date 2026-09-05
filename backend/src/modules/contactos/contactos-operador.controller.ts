import {Request,Response} from 'express';import * as repo from './contactos-operador.repository';
const ids=(r:Request)=>[Number(r.params.id),Number(r.context?.empresaId)] as const;
export async function getOperador(req:Request,res:Response){try{res.json(await repo.getOperador(...ids(req)));}catch(e){res.status(400).json({message:e instanceof Error?e.message:'Error'});}}
export async function putOperador(req:Request,res:Response){try{res.json(await repo.saveOperador(...ids(req),req.body));}catch(e){res.status(400).json({message:e instanceof Error?e.message:'Datos inválidos'});}}
export async function patchOperador(req:Request,res:Response){try{res.json(await repo.deactivateOperador(...ids(req)));}catch(e){res.status(400).json({message:e instanceof Error?e.message:'Error'});}}
