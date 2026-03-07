import { Router, Request, Response } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import { getContactos } from "./contactos.controller";
import { crearContacto } from './contactos.controller';
import { actualizarContacto } from './contactos.controller';
import { getContactoPorId } from './contactos.controller';
import { eliminarContacto } from './contactos.controller';
import { listarCatalogosConfigurablesDeContacto, guardarCatalogosConfigurables } from './contactos.controller';

const router = Router();

// Endpoint base: /api/contactos
// GET /
router.get("/", requireAuth, requireEmpresaActiva, getContactos);
router.get('/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeContacto);
router.put('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, guardarCatalogosConfigurables);
router.get('/:id', requireAuth, requireEmpresaActiva, getContactoPorId);
router.post('/', requireAuth, requireEmpresaActiva, crearContacto);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarContacto);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarContacto);

export default router;
