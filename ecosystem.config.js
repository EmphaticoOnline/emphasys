module.exports = {
  apps: [
    {
      name: "emphasys-api",
      script: "dist/server.js",
      cwd: "/var/www/emphasys-backend",
      env_file: ".env",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};