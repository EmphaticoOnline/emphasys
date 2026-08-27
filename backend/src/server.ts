import app from './app';
import pool from './config/database';

const PORT = process.env.PORT || 7001;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Emphasys API corriendo en puerto ${PORT}`);
  try {
    const result = await pool.query<{ database: string; host: string; port: number }>(
      'SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port',
    );
    const connection = result.rows[0];
    console.log(`[db] conexión OK: ${connection.database} (${connection.host ?? 'local'}:${connection.port ?? 'socket'})`);
  } catch (error) {
    console.error('[db] conexión fallida; cerrando el proceso.');
    console.error(error instanceof Error ? error.message : error);
    server.close(() => process.exit(1));
    return;
  }
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
