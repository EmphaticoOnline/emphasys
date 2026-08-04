import app from './app';

const PORT = process.env.PORT || 7001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Emphasys API corriendo en puerto ${PORT}`);
  if (typeof process.send === "function") {
    process.send("ready");
  }
});

let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}: dejando de aceptar conexiones nuevas...`);
  server.close((error) => {
    if (error) {
      console.error("[shutdown] Error al cerrar el servidor HTTP:", error);
      process.exit(1);
    }
    console.log("[shutdown] Solicitudes activas finalizadas.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
