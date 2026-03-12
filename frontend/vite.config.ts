import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
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
