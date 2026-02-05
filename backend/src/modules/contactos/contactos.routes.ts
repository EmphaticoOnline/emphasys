import { Router, Request, Response } from 'express';
import { getContactos } from "./contactos.controller";
import { crearContacto } from './contactos.controller';

const router = Router();

// Endpoint base: /api/contactos
// GET /
router.get("/", getContactos);
router.post('/', crearContacto);

export default router;
