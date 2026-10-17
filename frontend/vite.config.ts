import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { activeBrand } from './src/theme/brand/active.ts';
import { renderBrandHtml, renderWebManifest } from './src/theme/brand/webIdentity.ts';

/** Inyecta la identidad de la marca activa en index.html y genera el manifest. */
function brandIdentity(): Plugin {
	const manifestUrl = activeBrand.assets.manifest;
	return {
		name: 'emphasys:brand-identity',
		transformIndexHtml: {
			order: 'pre',
			handler: (html) => renderBrandHtml(html, activeBrand),
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (req.url?.split('?')[0] !== manifestUrl) return next();
				res.setHeader('Content-Type', 'application/manifest+json');
				res.setHeader('Cache-Control', 'no-cache');
				res.end(renderWebManifest(activeBrand));
			});
		},
		generateBundle() {
			this.emitFile({
				type: 'asset',
				fileName: manifestUrl.replace(/^\//, ''),
				source: renderWebManifest(activeBrand),
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), brandIdentity()],
	resolve: {
		alias: { '@': path.resolve(__dirname, 'src/compass') }
	},
	server: {
		proxy: {
			'/api': 'http://localhost:7001',
			'/auth': 'http://localhost:7001',
			'/uploads': 'http://localhost:7001'
		}
	},
	build: {
		chunkSizeWarningLimit: 1200
	}
});
