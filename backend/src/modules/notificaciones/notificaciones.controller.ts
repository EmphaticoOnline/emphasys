import { Request, Response } from 'express';
import {
  desactivarSuscripcion,
  listarSuscripcionesActivas,
  upsertSuscripcion,
  type PushSubscriptionRow,
} from './notificaciones.repository';
import {
  enmascararEndpoint,
  obtenerVapidPublicKey,
  validarSuscripcionInput,
  VapidNoConfiguradoError,
} from './notificaciones.service';

// Nunca se devuelven p256dh ni auth al frontend (ni en el alta ni en el
// listado): son las claves de cifrado de la suscripción, no datos de
// presentación. endpoint tampoco se expone completo, solo enmascarado.
function serializarSuscripcionPublica(row: PushSubscriptionRow) {
  return {
    id: row.id,
    plataforma: row.plataforma,
    nombre_dispositivo: row.nombre_dispositivo,
    user_agent: row.user_agent,
    endpoint_enmascarado: enmascararEndpoint(row.endpoint),
    creada_en: row.creada_en,
    ultima_actividad_en: row.ultima_actividad_en,
  };
}

export async function getPublicKey(_req: Request, res: Response) {
  try {
    const publicKey = obtenerVapidPublicKey();
    res.json({ publicKey });
  } catch (error) {
    if (error instanceof VapidNoConfiguradoError) {
      return res.status(503).json({ message: 'Las notificaciones push no están configuradas en este servidor todavía.' });
    }
    console.error('Error al obtener VAPID public key:', error);
    res.status(500).json({ message: 'Error al obtener la clave pública de notificaciones' });
  }
}

// Devuelve únicamente las suscripciones activas del usuario autenticado.
// usuarioId sale de req.auth.userId (poblado por requireAuth a partir del
// JWT) — no hay ningún parámetro de ruta ni query que permita pedir las
// suscripciones de otro usuario.
export async function getSuscripciones(req: Request, res: Response) {
  try {
    const usuarioId = req.auth?.userId;
    if (!usuarioId) return res.status(401).json({ message: 'No autenticado' });

    const suscripciones = await listarSuscripcionesActivas(usuarioId);
    res.json(suscripciones.map(serializarSuscripcionPublica));
  } catch (error) {
    console.error('Error al listar suscripciones push:', error);
    res.status(500).json({ message: 'Error al obtener las notificaciones registradas' });
  }
}

export async function postSuscripcion(req: Request, res: Response) {
  try {
    const usuarioId = req.auth?.userId;
    if (!usuarioId) return res.status(401).json({ message: 'No autenticado' });

    const { data, error } = validarSuscripcionInput(req.body);
    if (error || !data) return res.status(400).json({ message: error || 'Datos de suscripción inválidos' });

    const suscripcion = await upsertSuscripcion({ usuarioId, ...data });

    // Log discreto: nunca el endpoint completo ni las claves, solo lo
    // suficiente para correlacionar en soporte/diagnóstico.
    console.info('[Notificaciones] Suscripción push registrada/reactivada', {
      usuarioId,
      suscripcionId: suscripcion.id,
      endpoint: enmascararEndpoint(suscripcion.endpoint),
    });

    res.status(201).json(serializarSuscripcionPublica(suscripcion));
  } catch (error) {
    console.error('Error al registrar suscripción push:', error);
    res.status(500).json({ message: 'No se pudo registrar la suscripción de notificaciones' });
  }
}

// Soft-delete acotado a (id, usuario_id) — ver desactivarSuscripcion en el
// repositorio. Un id que existe pero pertenece a otro usuario responde
// igual que un id inexistente (404): nunca revela si el id es válido para
// otra cuenta.
export async function deleteSuscripcion(req: Request, res: Response) {
  try {
    const usuarioId = req.auth?.userId;
    if (!usuarioId) return res.status(401).json({ message: 'No autenticado' });

    // Se valida como cadena de dígitos y se enlaza tal cual (ver
    // desactivarSuscripcion): id es bigserial, y Number(...) arriesgaría
    // precisión para valores fuera de Number.MAX_SAFE_INTEGER. String(...)
    // normaliza el tipo de Express (string | string[] según su tipado de
    // params); un array nunca pasa la validación de dígitos siguiente.
    const id = String(req.params.id ?? '');
    if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'id inválido' });

    const desactivada = await desactivarSuscripcion(id, usuarioId);
    if (!desactivada) {
      return res.status(404).json({ message: 'Suscripción no encontrada' });
    }

    console.info('[Notificaciones] Suscripción push desactivada', { usuarioId, suscripcionId: id });
    res.status(204).send();
  } catch (error) {
    console.error('Error al desactivar suscripción push:', error);
    res.status(500).json({ message: 'No se pudo desactivar la suscripción' });
  }
}
