import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
	plugins: [react(), tailwindcss()],
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
