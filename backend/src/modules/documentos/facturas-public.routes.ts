import { Router } from 'express';
import { obtenerFacturaPDFPublico, obtenerFacturaXMLPublico } from './documentos.controller';

const router = Router();

router.get('/:id/pdf', obtenerFacturaPDFPublico);
router.get('/:id/xml', obtenerFacturaXMLPublico);

export default router;