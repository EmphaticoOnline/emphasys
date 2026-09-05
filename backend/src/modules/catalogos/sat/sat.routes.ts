import { Router } from "express";
import { requireAuth, requireEmpresaActiva } from "../../auth/auth.middleware";
import {
  getCodigoPostal,
  getColonias,
  getRegimenesFiscales,
  getUsosCfdi,
  getFormasPago,
  getMetodosPago,
  getProductosServicios,
  getPaises,
  buscarCodigosPostalesHandler,
  getBienesTransportados, getMaterialesPeligrosos, getTiposEmbalaje, getUnidadesSat,
  getConfiguracionesAutotransporte, getTiposPermiso, getSubtiposRemolque,
} from "./sat.controller";

const router = Router();

router.get("/codigos-postales/:cp", requireAuth, requireEmpresaActiva, getCodigoPostal);
router.get("/codigos-postales", requireAuth, requireEmpresaActiva, buscarCodigosPostalesHandler);
router.get("/colonias", requireAuth, requireEmpresaActiva, getColonias);
router.get("/colonias/:cp", requireAuth, requireEmpresaActiva, getColonias);
router.get("/regimenes-fiscales", requireAuth, requireEmpresaActiva, getRegimenesFiscales);
router.get("/usos-cfdi", requireAuth, requireEmpresaActiva, getUsosCfdi);
router.get("/formas-pago", requireAuth, requireEmpresaActiva, getFormasPago);
router.get("/metodos-pago", requireAuth, requireEmpresaActiva, getMetodosPago);
router.get('/productos-servicios', requireAuth, requireEmpresaActiva, getProductosServicios);
router.get('/paises', requireAuth, requireEmpresaActiva, getPaises);
router.get('/bienes-transportados', requireAuth, requireEmpresaActiva, getBienesTransportados);
router.get('/materiales-peligrosos', requireAuth, requireEmpresaActiva, getMaterialesPeligrosos);
router.get('/tipos-embalaje', requireAuth, requireEmpresaActiva, getTiposEmbalaje);
router.get('/unidades', requireAuth, requireEmpresaActiva, getUnidadesSat);
router.get('/configuraciones-autotransporte', requireAuth, requireEmpresaActiva, getConfiguracionesAutotransporte);
router.get('/tipos-permiso', requireAuth, requireEmpresaActiva, getTiposPermiso);
router.get('/subtipos-remolque', requireAuth, requireEmpresaActiva, getSubtiposRemolque);

export default router;
