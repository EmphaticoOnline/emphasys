import { Request, Response } from 'express';
import {
  actualizarContactoAdicional,
  cambiarActivoContactoAdicional,
  crearContactoAdicional,
  eliminarContactoAdicional,
  listarContactosAdicionales,
  validarContactoAdicional,
} from './contactos-adicionales.repository';

const EMAIL_DUPLICADO = 'Ya existe un contacto adicional activo con ese correo';

function ids(req: Request) {
  return { contactoId: Number(req.params.id), adicionalId: Number(req.params.adicionalId), empresaId: Number(req.context?.empresaId) };
}

function errorEscritura(res: Response, error: any, fallback: string) {
  if (error?.code === '23505') return res.status(409).json({ error: EMAIL_DUPLICADO });
  if (error?.code === '23503') return res.status(404).json({ error: 'Contacto no encontrado' });
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export async function getContactosAdicionales(req: Request, res: Response) {
  const { contactoId, empresaId } = ids(req);
  try {
    const result = await listarContactosAdicionales(contactoId, empresaId);
    return result === null ? res.status(404).json({ error: 'Contacto no encontrado' }) : res.json(result);
  } catch (error) {
    console.error('Error al listar contactos adicionales', error);
    return res.status(500).json({ error: 'No se pudieron obtener los contactos adicionales' });
  }
}

export async function postContactoAdicional(req: Request, res: Response) {
  const { contactoId, empresaId } = ids(req);
  const validation = validarContactoAdicional(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  try {
    const result = await crearContactoAdicional(contactoId, empresaId, validation.payload!);
    return result === null ? res.status(404).json({ error: 'Contacto no encontrado' }) : res.status(201).json(result);
  } catch (error) {
    return errorEscritura(res, error, 'No se pudo crear el contacto adicional');
  }
}

export async function putContactoAdicional(req: Request, res: Response) {
  const { contactoId, adicionalId, empresaId } = ids(req);
  const validation = validarContactoAdicional(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  try {
    const result = await actualizarContactoAdicional(contactoId, adicionalId, empresaId, validation.payload!);
    return result === null ? res.status(404).json({ error: 'Contacto adicional no encontrado' }) : res.json(result);
  } catch (error) {
    return errorEscritura(res, error, 'No se pudo actualizar el contacto adicional');
  }
}

export async function patchActivoContactoAdicional(req: Request, res: Response) {
  const { contactoId, adicionalId, empresaId } = ids(req);
  if (typeof req.body?.activo !== 'boolean') return res.status(400).json({ error: 'El campo activo debe ser booleano' });
  try {
    const result = await cambiarActivoContactoAdicional(contactoId, adicionalId, empresaId, req.body.activo);
    return result === null ? res.status(404).json({ error: 'Contacto adicional no encontrado' }) : res.json(result);
  } catch (error) {
    return errorEscritura(res, error, 'No se pudo cambiar el estado del contacto adicional');
  }
}

export async function deleteContactoAdicional(req: Request, res: Response) {
  const { contactoId, adicionalId, empresaId } = ids(req);
  try {
    const result = await eliminarContactoAdicional(contactoId, adicionalId, empresaId);
    return result === null ? res.status(404).json({ error: 'Contacto adicional no encontrado' }) : res.status(204).send();
  } catch (error) {
    return errorEscritura(res, error, 'No se pudo eliminar el contacto adicional');
  }
}
