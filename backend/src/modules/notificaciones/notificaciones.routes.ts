import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { deleteSuscripcion, getPublicKey, getSuscripciones, postSuscripcion } from './notificaciones.controller';

const router = Router();

// Módulo general de notificaciones del ERP (no exclusivo de WhatsApp).
// Todos los endpoints de escritura y de lectura de datos propios del
// usuario requieren sesión — no hay ninguno público. Ninguno acepta ni
// necesita X-Empresa-Id: una suscripción push no pertenece a una empresa
// (ver migración de core.push_subscriptions).
router.get('/push/public-key', requireAuth, getPublicKey);
router.get('/push/subscriptions', requireAuth, getSuscripciones);
router.post('/push/subscriptions', requireAuth, postSuscripcion);
router.delete('/push/subscriptions/:id', requireAuth, deleteSuscripcion);

export default router;
