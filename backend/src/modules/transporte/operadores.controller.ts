import type {Request,Response} from 'express';
import * as repo from './operadores.repository';
const empresa=(r:Request)=>Number(r.context?.empresaId);
const id=(r:Request)=>Number(r.params.id);
const fail=(s:Response,e:any)=>s.status(e?.code==='23505'?409:(e?.statusCode||400)).json({message:e?.code==='23505'?'El contacto ya está registrado como operador.':e?.message||'Datos inválidos'});
export async function listar(r:Request,s:Response){try{s.json(await repo.listOperadores(empresa(r),typeof r.query.q==='string'?r.query.q:null,typeof r.query.activo==='string'?r.query.activo:null));}catch(e){fail(s,e);}}
export async function obtener(r:Request,s:Response){try{const x=await repo.getOperador(empresa(r),id(r));x?s.json(x):s.status(404).json({message:'Operador no encontrado'});}catch(e){fail(s,e);}}
export async function crear(r:Request,s:Response){try{s.status(201).json(await repo.createOperadorCompleto(empresa(r),r.body));}catch(e){fail(s,e);}}
export async function actualizar(r:Request,s:Response){try{const x=await repo.updateOperadorCompleto(empresa(r),id(r),r.body);x?s.json(x):s.status(404).json({message:'Operador no encontrado'});}catch(e){fail(s,e);}}
export async function activo(r:Request,s:Response){try{const x=await repo.setOperadorActivo(empresa(r),id(r),Boolean(r.body?.activo));x?s.json(x):s.status(404).json({message:'Operador no encontrado'});}catch(e){fail(s,e);}}
