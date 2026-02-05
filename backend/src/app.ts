
import express from "express";
import contactosRouter from "./modules/contactos/contactos.routes";
import productosRouter from "./modules/productos/productos.routes";

const app = express();

app.use(express.json());


// monta el módulo contactos
app.use("/api/contactos", contactosRouter);

// monta el módulo productos
app.use("/api/productos", productosRouter);

export default app;
