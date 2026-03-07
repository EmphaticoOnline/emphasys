
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import contactosRouter from "./modules/contactos/contactos.routes";
import productosRouter from "./modules/productos/productos.routes";
import unidadesRouter from "./modules/unidades/unidades.routes";
import documentosRouter from "./modules/documentos/documentos.routes";
import facturasRouter from "./modules/documentos/facturas.routes";
import whatsappRoutes from "./whatsapp/whatsapp.routes";
import satCatalogosRouter from "./modules/catalogos/sat/sat.routes";
import catalogosRouter from "./modules/catalogos/catalogos.routes";
import authRoutes from "./modules/auth/auth.routes";
import configuracionCatalogosRouter from "./modules/configuracion/catalogos/catalogos-configurables.routes";

const app = express();

app.use(express.json());
console.log("=== BUILD VERSION 2 ===");

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

// autenticación
app.use("/auth", authRoutes);

// catálogos SAT
app.use("/api/catalogos/sat", satCatalogosRouter);
app.use("/api/sat", satCatalogosRouter);

// catálogos configurables (core.catalogos)
app.use("/api/catalogos", catalogosRouter);

// catálogos configurables (core)
app.use("/api/configuracion/catalogos", configuracionCatalogosRouter);

// monta el módulo productos
app.use("/api/productos", productosRouter);

// monta el catálogo de unidades
app.use("/api/unidades", unidadesRouter);

// monta el módulo de documentos (cotizaciones)
app.use("/api/documentos", documentosRouter);
// módulo de facturas reutilizando la misma lógica de documentos
app.use("/api/facturas", facturasRouter);

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
