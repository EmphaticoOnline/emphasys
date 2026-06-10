import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import {
	getProductos,
	updateProducto,
	deleteProducto,
	crearProducto,
	getProducto,
	listarCatalogosConfigurablesDeProducto,
	guardarCatalogosConfigurablesProducto,
	listarProductoArchivos,
	crearProductoArchivo,
	eliminarProductoArchivo,
	marcarProductoArchivoPrincipal,
	exportarProductos,
} from './productos.controller';
import { createDiskUploader, resolveUploadsDir } from '../uploads/uploads.multer';
import path from 'path';

const router = Router();

const productoArchivosUpload = createDiskUploader({
	allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
	maxFileSizeBytes: 5 * 1024 * 1024,
	destinationDir: path.join(resolveUploadsDir(), 'productos'),
});

const manejarUploadProductoArchivo = (req: any, res: any, next: any) => {
	const handler = productoArchivosUpload.single('file');

	handler(req, res, (err: any) => {
		if (err instanceof multer.MulterError) {
			if (err.code === 'LIMIT_FILE_SIZE') {
				return res.status(400).json({ message: 'El archivo excede el límite de 5MB' });
			}

			return res.status(400).json({ message: err.message });
		}

		if (err?.code === 'INVALID_FILE_TYPE') {
			return res.status(400).json({ message: 'Tipo de archivo no permitido' });
		}

		if (err) {
			console.error('Error al guardar archivo de producto:', err);
			return res.status(500).json({ message: 'Error al guardar archivo del producto' });
		}

		return next();
	});
};

// GET /api/productos
router.get('/', requireAuth, requireEmpresaActiva, getProductos);

router.get('/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeProducto);
router.get('/:productoId/archivos', requireAuth, requireEmpresaActiva, listarProductoArchivos);

// GET /api/productos/:id
router.get('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeProducto);
router.get('/:id', requireAuth, requireEmpresaActiva, getProducto);


// POST /api/productos
router.post('/exportar', requireAuth, requireEmpresaActiva, exportarProductos);
router.post('/', requireAuth, requireEmpresaActiva, crearProducto);
router.post('/:productoId/archivos', requireAuth, requireEmpresaActiva, manejarUploadProductoArchivo, crearProductoArchivo);

// PUT /api/productos/:id
router.put('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, guardarCatalogosConfigurablesProducto);
router.put('/:id', requireAuth, requireEmpresaActiva, updateProducto);

router.patch('/archivos/:archivoId/principal', requireAuth, requireEmpresaActiva, marcarProductoArchivoPrincipal);

// DELETE /api/productos/:id
router.delete('/:id', requireAuth, requireEmpresaActiva, deleteProducto);
router.delete('/archivos/:archivoId', requireAuth, requireEmpresaActiva, eliminarProductoArchivo);

export default router;
