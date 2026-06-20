---
name: project-informes-reportes
description: Arquitectura del módulo de Informes/Reportes formales en Emphasys
metadata:
  type: project
---

El módulo de Informes fue refactorizado para soportar reportes formales por categoría (Ventas, Compras, Inventario, Finanzas, CRM) además de Consultas con IA.

**Estructura de rutas:**
- `/informes` → `InformesPage.tsx` (hub de categorías)
- `/informes/ia` → `AIReportesPage.tsx` (consultas con IA — sin cambios)
- `/informes/compras/estado-cuenta-proveedor` → `EstadoCuentaProveedorPage.tsx`

**Backend — nuevo módulo `backend/src/modules/reportes/`:**
- `reportes.repository.ts` — SQL con window function para saldo acumulado
- `reportes.controller.ts` — soporta `?formato=json|excel|csv`
- `reportes.routes.ts` — `GET /compras/estado-cuenta-proveedor`
- Registrado en `app.ts` como `/api/reportes`

**Estado de Cuenta de Proveedor:**
- Tipos de documento: `factura_compra` (cargo), `nota_credito_compra` / `pago_proveedor` (abono)
- Saldo inicial calculado con documentos anteriores a `fecha_inicial`
- Saldo acumulado con `SUM() OVER (ORDER BY fecha, created_at, id)`
- Usa `formatearFolioDocumento` del backend para folios
- Exportación Excel/CSV usando `generarExcelBuffer` de `utils/exportar.ts`

**Frontend — nuevo servicio `frontend/src/services/reportesService.ts`**

**Why:** Diseño pensado para reutilizar en Estado de Cuenta de Cliente — solo cambiar `TIPOS_COMPRA_PROVEEDOR` y la función exportada.

**How to apply:** Al agregar nuevos reportes, crear entrada en `CATEGORIAS` de `InformesPage.tsx`, ruta en `App.tsx` y función en `reportes.repository.ts`.
