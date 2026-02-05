import { Request, Response } from "express";
import { obtenerContactos } from './contactos.repository';
import { insertarContacto } from './contactos.repository';

export async function crearContacto(req: Request, res: Response) {
  const contacto = await insertarContacto(req.body);
  res.status(201).json(contacto);
}

export const getContactos = async (_req: Request, res: Response) => {
  const result = await obtenerContactos();

  res.json(result);
};
