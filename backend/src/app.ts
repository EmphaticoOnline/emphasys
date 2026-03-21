
import dotenv from "dotenv";
import path from "path";

// Carga .env explícitamente y loguea valores para diagnosticar
dotenv.config({ path: ".env" });
console.log("SMTP_HOST runtime:", process.env.SMTP_HOST);
console.log("CWD runtime:", process.cwd());

import express from "express";
import fs from "fs";
import contactosRouter from "./modules/contactos/contactos.routes";
import leadsRouter from "./modules/leads/leads.routes";
import productosRouter from "./modules/productos/productos.routes";
import unidadesRouter from "./modules/unidades/unidades.routes";
import documentosRouter from "./modules/documentos/documentos.routes";
import facturasRouter from "./modules/documentos/facturas.routes";
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
import empresasRoutes from "./routes/empresasRoutes";
import rolesRouter from "./modules/roles/roles.routes";
import usuariosRouter from "./modules/usuarios/usuarios.routes";
import documentosEmpresaRouter from "./modules/configuracion/documentos-empresa/documentos-empresa.routes";
import finanzasRouter from "./modules/finanzas/finanzas.routes";
import conceptosRouter from "./modules/conceptos/conceptos.routes";
import inventarioRouter from "./modules/inventario/inventario.routes";
import almacenesRouter from "./modules/almacenes/almacenes.routes";

const app = express();

app.use(express.json());
console.log("=== BUILD VERSION 2 ===");

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
// esquema de campos dinámicos (documentos)
app.use("/api/documentos", documentosEsquemaRouter);

// valores dinámicos capturados
app.use("/api/documentos-campos", documentosCamposRouter);
app.use("/api/documentos-partidas-campos", documentosPartidasCamposRouter);
app.use("/api/documentos-partidas", documentosPartidasCamposRouter);

// empresas
app.use("/api/empresas", empresasRoutes);
app.use("/api", rolesRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api", documentosEmpresaRouter);
app.use("/api/finanzas", finanzasRouter);
app.use("/api/conceptos", conceptosRouter);
app.use("/api/inventario", inventarioRouter);
app.use("/api/almacenes", almacenesRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "emphasys-api" });
});


app.use("/api/whatsapp", whatsappRoutes);

// 404 explícito para rutas /api no manejadas (evita caer al fallback del frontend)
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Ruta de API no encontrada" });
});

// Servir frontend estático
app.use(express.static(frontendDistPath));

// Fallback para SPA
app.use((_req, res) => {
  const indexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  console.error("[static-fallback] index.html no encontrado en", indexPath);
  return res.status(500).json({ message: "frontend-dist no encontrado (index.html)" });
});

export default app;
