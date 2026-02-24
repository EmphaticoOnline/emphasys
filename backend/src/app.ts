
import express from "express";
import path from "path";
import fs from "fs";
import contactosRouter from "./modules/contactos/contactos.routes";
import productosRouter from "./modules/productos/productos.routes";
import whatsappRoutes from "./whatsapp/whatsapp.routes";

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

// monta el módulo productos
app.use("/api/productos", productosRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "emphasys-api" });
});


app.use("/api/whatsapp", whatsappRoutes);

// Servir frontend estático
app.use(express.static(frontendDistPath));

// Fallback para SPA
app.use((_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

export default app;
