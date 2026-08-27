module.exports = {
  apps: [
    {
      name: "emphasys-api",
      script: "dist/server.js",
      cwd: "/var/www/emphasys-backend/current",
      env_file: "/var/www/emphasys-backend/.env",
      exec_mode: "cluster",
      instances: 1,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
        APP_ENV: "production",
        DB_TARGET: "production",
        DB_HOST: "127.0.0.1",
        PGHOST: "127.0.0.1",
        APP_BASE_URL: "https://erp.emphasys.cloud",
        UPLOADS_DIR: "/var/www/emphasys-backend/uploads"
      }
    }
  ]
};
