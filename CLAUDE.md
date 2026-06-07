# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Preferencias de colaboración

Responde siempre en español.

## Comandos comunes

### Desarrollo
```bash
npm run dev          # Inicia backend y frontend concurrentemente
```

### Backend (Node.js/Express)
```bash
cd backend
npm run dev          # ts-node-dev con hot reload en puerto 7001
npm run build        # Compila TypeScript → dist/
npm start            # Ejecuta dist/server.js en producción
```

### Frontend (React/Vite)
```bash
cd frontend
npm run dev          # Vite dev server (proxy → localhost:7001)
npm run build        # Vite build → dist/
npm run preview      # Preview del build de producción
```

### Deploy
```bash
npm run deploy       # Script bash con rsync (Linux/WSL)
npm run deploy:win   # Script PowerShell para Windows
```

## Arquitectura

Monorepo con tres directorios principales:

```
backend/    Node.js + Express + TypeScript
frontend/   React 19 + Vite + TypeScript
database/   Migraciones SQL (PostgreSQL)
```

### Backend (`backend/src/`)

- **`app.ts`** — configuración de Express, middlewares globales, registro de rutas
- **`server.ts`** — punto de entrada, bind de puerto
- **`db.ts`** — pool de conexión a PostgreSQL (sin ORM, queries SQL directas con `pg`)
- **`modules/`** — módulos de negocio principales (ver abajo)
- **`crm/`** — oportunidades, actividades, conversaciones
- **`whatsapp/`** — integración de mensajería WhatsApp

Cada módulo sigue la estructura: `routes.ts` → `controller.ts` → queries SQL directas.

**Módulos principales:**
- `auth`, `usuarios`, `roles` — autenticación JWT y RBAC
- `contactos`, `leads` — gestión de clientes y prospectos
- `productos`, `inventario`, `almacenes`, `precios` — catálogo e inventario
- `documentos` — generación de facturas/cotizaciones (PDF + CFDI con Facturama)
- `finanzas`, `conceptos` — gestión financiera
- `configuracion`, `campos-configuracion` — parámetros del sistema y campos dinámicos
- `plantillas` — plantillas de documentos, email y WhatsApp
- `produccion` — seguimiento de producción
- `grid-preferences` — preferencias de vista de grillas por usuario

### Frontend (`frontend/src/`)

- **`App.tsx`** — configuración de rutas (React Router 7)
- **`pages/`** — una carpeta por módulo, espeja la estructura del backend
- **`components/`** — componentes reutilizables
- **`context/`** — estado global con React Context
- **`theme.ts`** — tema MUI personalizado (color primario: `#1d2f68`)

Toda comunicación con el backend va a través del proxy Vite (`/api`, `/auth`, `/uploads` → `localhost:7001`).

### Base de datos

PostgreSQL sin ORM. Las migraciones están en `database/migrations/` con timestamp como prefijo. No hay seed scripts; la base de datos se inicializa con las migraciones en orden.

### Integraciones externas clave

- **Facturama** — generación de CFDI (facturación electrónica mexicana)
- **OpenAI** — reportes con IA
- **WhatsApp Business API** — mensajería y plantillas
- **Nodemailer** — envío de correos con configuración SMTP dinámica

### Convenciones

- El backend usa `require`/`module.exports` en la salida compilada (CommonJS), pero el código fuente es TypeScript con `import/export`.
- Los errores del backend siempre se retornan como `{ error: string }` con el HTTP status correspondiente.
- Los campos dinámicos (`campos-configuracion`) permiten agregar atributos personalizados a entidades sin cambiar el esquema; se almacenan como JSONB.
- La autenticación usa JWT en cabecera `Authorization: Bearer <token>`.
- Las preferencias de grillas se persisten por usuario en la tabla `grid_preferences`.
