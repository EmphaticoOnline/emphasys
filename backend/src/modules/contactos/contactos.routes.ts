import { Router, Request, Response } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import { getContactos, exportarContactos } from "./contactos.controller";
import { crearContacto } from './contactos.controller';
import { actualizarContacto } from './contactos.controller';
import { getContactoPorId } from './contactos.controller';
import { eliminarContacto } from './contactos.controller';
import { listarCatalogosConfigurablesDeContacto, guardarCatalogosConfigurables } from './contactos.controller';
import { getDomicilios, postDomicilio, putDomicilio, deleteDomicilio } from './contactos-domicilios.controller';
import { getOperador, putOperador, patchOperador } from './contactos-operador.controller';

const router = Router();

// Endpoint base: /api/contactos
// GET /
router.get("/", requireAuth, requireEmpresaActiva, getContactos);
router.get('/:id/domicilios', requireAuth, requireEmpresaActiva, getDomicilios);
router.get('/:id/operador', requireAuth, requireEmpresaActiva, getOperador);
router.put('/:id/operador', requireAuth, requireEmpresaActiva, putOperador);
router.patch('/:id/operador/desactivar', requireAuth, requireEmpresaActiva, patchOperador);
router.post('/:id/domicilios', requireAuth, requireEmpresaActiva, postDomicilio);
router.put('/:id/domicilios/:domicilioId', requireAuth, requireEmpresaActiva, putDomicilio);
router.delete('/:id/domicilios/:domicilioId', requireAuth, requireEmpresaActiva, deleteDomicilio);
router.post('/exportar', requireAuth, requireEmpresaActiva, exportarContactos);
router.get('/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeContacto);
router.put('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, guardarCatalogosConfigurables);
router.get('/:id', requireAuth, requireEmpresaActiva, getContactoPorId);
router.post('/', requireAuth, requireEmpresaActiva, crearContacto);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarContacto);
router.patch('/:id', requireAuth, requireEmpresaActiva, actualizarContacto);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarContacto);

export default router;
