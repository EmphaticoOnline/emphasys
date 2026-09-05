import {Request,Response} from 'express';import * as repo from './vehiculos.repository';
const empresa=(r:Request)=>Number(r.context?.empresaId); const body=(r:Request)=>r.body as repo.VehiculoInput;
export const listar=async(r:Request,s:Response)=>{try{s.json(await repo.listVehiculos(empresa(r),typeof r.query.q==='string'?r.query.q:null,typeof r.query.activo==='string'?r.query.activo:null));}catch(e){s.status(500).json({message:'Error interno'});}};
export const obtener=async(r:Request,s:Response)=>{const v=await repo.getVehiculo(empresa(r),Number(r.params.id));v?s.json(v):s.status(404).json({message:'Vehículo no encontrado'});};
export const crear=async(r:Request,s:Response)=>{try{s.status(201).json(await repo.saveVehiculo(empresa(r),null,body(r)));}catch(e){s.status(400).json({message:e instanceof Error?e.message:'Datos inválidos'});}};
export const actualizar=async(r:Request,s:Response)=>{try{s.json(await repo.saveVehiculo(empresa(r),Number(r.params.id),body(r)));}catch(e){s.status(400).json({message:e instanceof Error?e.message:'Datos inválidos'});}};
export const desactivar=async(r:Request,s:Response)=>{try{s.json(await repo.deactivate(empresa(r),Number(r.params.id)));}catch(e){s.status(400).json({message:'No se pudo desactivar'});}};
