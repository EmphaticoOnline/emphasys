import { Request, Response } from 'express';
import { actualizarDomicilio, crearDomicilio, eliminarDomicilio, listarDomicilios, validarDomicilio } from './contactos-domicilios.repository';

function ids(req: Request) {
  return { contactoId: Number(req.params.id), domicilioId: Number(req.params.domicilioId), empresaId: Number(req.context?.empresaId) };
}

export async function getDomicilios(req: Request, res: Response) {
  const { contactoId, empresaId } = ids(req);
  const result = await listarDomicilios(contactoId, empresaId);
  return result === null ? res.status(404).json({ message: 'Contacto no encontrado' }) : res.json(result);
}

export async function postDomicilio(req: Request, res: Response) {
  const { contactoId, empresaId } = ids(req);
  const validation = validarDomicilio(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const result = await crearDomicilio(contactoId, empresaId, validation.payload!);
    return result === null ? res.status(404).json({ message: 'Contacto no encontrado' }) : res.status(201).json(result);
  } catch (error: any) {
    return res.status(error?.code === '23505' ? 409 : 400).json({ message: error?.code === '23505' ? 'Ya existe un domicilio con ese identificador' : 'No se pudo crear el domicilio' });
  }
}

export async function putDomicilio(req: Request, res: Response) {
  const { contactoId, domicilioId, empresaId } = ids(req);
  const validation = validarDomicilio(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const result = await actualizarDomicilio(contactoId, domicilioId, empresaId, validation.payload!);
    return result === null ? res.status(404).json({ message: 'Domicilio no encontrado para ese contacto' }) : res.json(result);
  } catch (error: any) {
    return res.status(error?.code === '23505' ? 409 : 400).json({ message: error?.code === '23505' ? 'Ya existe un domicilio con ese identificador' : 'No se pudo actualizar el domicilio' });
  }
}

export async function deleteDomicilio(req: Request, res: Response) {
  const { contactoId, domicilioId, empresaId } = ids(req);
  const result = await eliminarDomicilio(contactoId, domicilioId, empresaId);
  return result === null ? res.status(404).json({ message: 'Domicilio no encontrado para ese contacto' }) : res.status(204).send();
}
