
import fs from "fs";
import path from "path";
import { logRuntimeConfig } from "./config/runtime";
import runtimeRouter from "./routes/runtime.routes";

logRuntimeConfig();
console.log("CWD runtime:", process.cwd());

import express from "express";
import contactosRouter from "./modules/contactos/contactos.routes";
import empresaDomiciliosRouter from "./modules/contactos/empresa-domicilios.routes";
import leadsRouter from "./modules/leads/leads.routes";
import productosRouter from "./modules/productos/productos.routes";
import unidadesRouter from "./modules/unidades/unidades.routes";
import documentosRouter from "./modules/documentos/documentos.routes";
import facturasRouter from "./modules/documentos/facturas.routes";
import facturasPublicRouter from "./modules/documentos/facturas-public.routes";
import documentosGeneracionRouter from "./modules/documentos/document-generation.routes";
import tiposDocumentoRouter from "./modules/documentos/tipos-documento.routes";
import whatsappRoutes from "./whatsapp/whatsapp.routes";
import satCatalogosRouter from "./modules/catalogos/sat/sat.routes";
import catalogosRouter from "./modules/catalogos/catalogos.routes";
import impuestosRouter from "./modules/impuestos/impuestos.routes";
import authRoutes from "./modules/auth/auth.routes";
import configuracionCatalogosRouter from "./modules/configuracion/catalogos/catalogos-configurables.routes";
import camposConfiguracionRouter from "./modules/campos-configuracion/campos-configuracion.routes";
import entidadesTiposRouter from "./modules/entidades/entidades-tipos.routes";
import documentosCamposRouter from "./modules/documentos/documentos-campos.routes";
import documentosPartidasCamposRouter from "./modules/documentos/documentos-partidas-campos.routes";
import documentosEsquemaRouter from "./modules/documentos/documentos-esquema.routes";
import parametrosSistemaRouter from "./modules/configuracion/parametros/parametros.routes";
import camposObligatoriosRouter from "./modules/configuracion/campos-obligatorios/campos-obligatorios.routes";
import empresasRoutes from "./routes/empresasRoutes";
import aiReportesRoutes from "./routes/aiReportesRoutes";
import rolesRouter from "./modules/roles/roles.routes";
import usuariosRouter from "./modules/usuarios/usuarios.routes";
import documentosEmpresaRouter from "./modules/configuracion/documentos-empresa/documentos-empresa.routes";
import formatosImpresionRouter from "./modules/configuracion/formatos-impresion/formatos-impresion.routes";
import seriesDocumentoRouter from "./modules/configuracion/series-documento/series-documento.routes";
import cfdiPacConfigRouter from "./modules/configuracion/cfdi-pac-config/cfdi-pac-config.routes";
import configuracionEmailRouter from "./modules/configuracion/email/email.routes";
import finanzasRouter from "./modules/finanzas/finanzas.routes";
import conceptosRouter from "./modules/conceptos/conceptos.routes";
import inventarioRouter from "./modules/inventario/inventario.routes";
import almacenesRouter from "./modules/almacenes/almacenes.routes";
import preciosListasRouter from "./modules/precios-listas/precios-listas.routes";
import preciosRouter from "./modules/precios/precios.routes";
import uploadsRouter from "./modules/uploads/uploads.routes";
import crmOportunidadesRouter from "./crm/oportunidades.routes";
import produccionRouter from "./modules/produccion/produccion.routes";
import contabilidadRouter from "./modules/contabilidad/contabilidad.routes";
import gridPreferencesRouter from "./modules/grid-preferences/grid-preferences.routes";
import versionRouter from "./routes/version.routes";
import cfdiCsdRouter from "./modules/cfdi/cfdi-csd.routes";
import cfdiSatRouter from "./modules/configuracion/cfdi-sat/cfdi-sat.routes";
import facturaGlobalRouter from "./modules/documentos/factura-global.routes";
import autorizacionesRouter from "./modules/autorizaciones/autorizaciones.routes";
import reportesRouter from "./modules/reportes/reportes.routes";
import auditLogRouter from "./modules/audit-log/audit-log.routes";
import documentosEmpresaArchivosRouter from "./modules/documentacion/documentos-empresa.routes";
import notificacionesRouter from "./modules/notificaciones/notificaciones.routes";
import compassRouter from "./modules/compass/compass.routes";
import transporteRouter from "./modules/transporte/transporte.routes";
import vehiculosRouter from "./modules/transporte/vehiculos.routes";
import remolquesRouter from "./modules/transporte/remolques.routes";
import operadoresRouter from "./modules/transporte/operadores.routes";
import operacionesFullRouter from "./modules/operaciones-full/operaciones-full.routes";
import entregasRouter from "./modules/entregas/entregas.routes";
import preciosBaseComercialesRouter from "./modules/precios-base-comerciales/precios-base-comerciales.routes";
import { FRONTEND_BUILD_VERSION } from "./config/version";

const app = express();

app.disable("x-powered-by");
app.use(express.json());
console.log(`[version] Emphasys Web build: ${FRONTEND_BUILD_VERSION}`);

// Static uploads (logos, etc.)
const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
console.log("[uploads-static] uploadsDir:", uploadsDir, "exists?:", fs.existsSync(uploadsDir));
app.use("/uploads", express.static(uploadsDir));

// Path del frontend (permite override por env).
// En producción __dirname ≈ /var/www/emphasys-backend/backend/dist, y frontend-dist está en /var/www/emphasys-backend/frontend-dist
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.resolve(__dirname, "../frontend-dist")

// Debug estático
console.log("[static-debug] __dirname:", __dirname);
console.log("[static-debug] frontendDistPath:", frontendDistPath);
console.log("[static-debug] dist exists?:", fs.existsSync(frontendDistPath));
console.log(
  "[static-debug] index.html exists?:",
  fs.existsSync(path.join(frontendDistPath, "index.html"))
);


// monta el módulo contactos
app.use("/api/contactos", contactosRouter);
app.use("/api/empresa/domicilios", empresaDomiciliosRouter);
app.use("/api/leads", leadsRouter);

// autenticación
app.use("/auth", authRoutes);

// catálogos SAT
app.use("/api/catalogos/sat", satCatalogosRouter);
app.use("/api/sat", satCatalogosRouter);

// catálogos configurables (core.catalogos)
app.use("/api/catalogos", catalogosRouter);
app.use("/api", impuestosRouter);

// catálogos configurables (core)
app.use("/api/configuracion/catalogos", configuracionCatalogosRouter);
// parámetros del sistema
app.use("/api", parametrosSistemaRouter);
// campos obligatorios configurables
app.use("/api", camposObligatoriosRouter);

// tipos de entidades (core)
app.use("/api/entidades-tipos", entidadesTiposRouter);

// tipos de documento (core/documentos)
app.use("/api/tipos-documento", tiposDocumentoRouter);

// campos dinámicos configurables
app.use("/api/campos-configuracion", camposConfiguracionRouter);

// monta el módulo productos
app.use("/api/productos", productosRouter);

// monta el catálogo de unidades
app.use("/api/unidades", unidadesRouter);

// generación de documentos (flujos origen -> destino)
app.use("/api/documentos", documentosGeneracionRouter);

// monta el módulo de documentos (cotizaciones)
app.use("/api/documentos", documentosRouter);
// módulo de facturas reutilizando la misma lógica de documentos
app.use("/api/facturas", facturasRouter);
app.use("/public/facturas", facturasPublicRouter);
// esquema de campos dinámicos (documentos)
app.use("/api/documentos", documentosEsquemaRouter);

// valores dinámicos capturados
app.use("/api/documentos-campos", documentosCamposRouter);
app.use("/api/documentos-partidas-campos", documentosPartidasCamposRouter);
app.use("/api/documentos-partidas", documentosPartidasCamposRouter);

// empresas
app.use("/api/empresas", empresasRoutes);
app.use("/api/ai", aiReportesRoutes);
app.use("/api", rolesRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api", documentosEmpresaRouter);
app.use("/api", formatosImpresionRouter);
app.use("/api", seriesDocumentoRouter);
app.use("/api", cfdiPacConfigRouter);
app.use("/api", configuracionEmailRouter);
app.use("/api/finanzas", finanzasRouter);
app.use("/api/conceptos", conceptosRouter);
app.use("/api/precios-listas", preciosListasRouter);
app.use("/api/precios", preciosRouter);
app.use("/api/produccion", produccionRouter);
app.use("/api/contabilidad", contabilidadRouter);
app.use("/api/grid-preferences", gridPreferencesRouter);
app.use("/api/inventario", inventarioRouter);
app.use("/api/almacenes", almacenesRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/crm", crmOportunidadesRouter);
app.use("/api/version", versionRouter);
app.use("/api", runtimeRouter);
app.use("/api/cfdi", cfdiCsdRouter);
app.use("/api/configuracion/cfdi-sat", cfdiSatRouter);
app.use("/api/autorizaciones", autorizacionesRouter);
app.use("/api/factura-global", facturaGlobalRouter);
app.use("/api/operaciones-full", operacionesFullRouter);
app.use("/api/entregas", entregasRouter);
app.use("/api/precios-base-comerciales", preciosBaseComercialesRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/audit-log", auditLogRouter);
app.use("/api/documentos-empresa", documentosEmpresaArchivosRouter);
app.use("/api/notificaciones", notificacionesRouter);
app.use("/api/compass", compassRouter);
app.use("/api/transporte", transporteRouter);
app.use("/api/transporte/vehiculos", vehiculosRouter);
app.use("/api/transporte/remolques", remolquesRouter);
app.use("/api/transporte/operadores", operadoresRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "emphasys-api" });
});


app.use("/api/whatsapp", whatsappRoutes);

// 404 explícito para rutas /api no manejadas (evita caer al fallback del frontend)
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Ruta de API no encontrada" });
});

const setFrontendCacheHeaders = (res: express.Response, filePath: string) => {
  const relativePath = path.relative(frontendDistPath, filePath).split(path.sep).join("/");

  if (relativePath === "index.html" || relativePath === "sw.js") {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    return;
  }

  if (relativePath.startsWith("assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
};

// Servir frontend estático. Vite genera nombres con hash dentro de /assets.
app.use(express.static(frontendDistPath, { setHeaders: setFrontendCacheHeaders }));

// Fallback para SPA
app.use((_req, res) => {
  const indexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    return res.sendFile(indexPath);
  }
  console.error("[static-fallback] index.html no encontrado en", indexPath);
  return res.status(500).json({ message: "frontend-dist no encontrado (index.html)" });
});

export default app;
