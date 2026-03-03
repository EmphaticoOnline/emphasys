import pool from '../../config/database';
import { getEmpresaActivaId } from '../../shared/context/empresa';

const CAMPOS = [
  'clave','descripcion','activo','clasificacion','tipo_producto','familia','linea','presentacion','unidad_venta','unidad_compra','unidad_inventario','factor_conversion','existencia_actual','minimo_inventario','costo_estandar','costo_promedio','ultimo_costo','precio_publico','precio_mayoreo','precio_menudeo','precio_distribuidor','iva_porcentaje','ieps_porcentaje','retiene_iva','retiene_isr','clave_producto_sat','unidad_sat','fraccion_arancelaria','largo','ancho','alto','espesor','diametro','peso_unitario','equivalente_m2','piezas_por_empaque','peso_por_empaque','unidad_peso_empaque','ubicacion_almacen','proveedor_principal_id','proveedor_alternativo_1_id','proveedor_alternativo_2_id','archivo_fotografia_1','archivo_fotografia_2','archivo_ficha_tecnica','archivo_certificado','es_estacional','demanda_mensual_estimado','factor_demanda','observaciones','observaciones_compras','observaciones_diseno','fecha_creacion'
];

// Inserta un nuevo producto usando empresa_id
export async function insertarProductoRepository(data: any) {
  const empresaId = getEmpresaActivaId();
  const camposPresentes = CAMPOS.filter((campo) => campo in data);
  const values = [empresaId, ...camposPresentes.map((campo) => data[campo])];
  const params = values.map((_, idx) => `$${idx + 1}`).join(', ');
  const cols = ['empresa_id', ...camposPresentes];
  const query = `INSERT INTO productos (${cols.join(', ')}) VALUES (${params}) RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Obtiene los productos de la empresa activa
export async function getProductosRepository() {
  const empresaId = getEmpresaActivaId();
  const query = 'SELECT * FROM productos WHERE empresa_id = $1 ORDER BY id';
  const { rows } = await pool.query(query, [empresaId]);
  return rows;
}

// Actualiza un producto por id
export async function updateProductoRepository(id: number, data: any) {
  const empresaId = getEmpresaActivaId();
  const camposPresentes = CAMPOS.filter((campo) => campo in data);
  const set = camposPresentes.map((campo, idx) => `${campo} = $${idx + 1}`).join(', ');
  const values = camposPresentes.map((campo) => data[campo]);
  if (!set) throw new Error('No hay campos para actualizar');
  const query = `UPDATE productos SET ${set} WHERE id = $${values.length + 1} AND empresa_id = $${values.length + 2} RETURNING *`;
  const result = await pool.query(query, [...values, id, empresaId]);
  return result.rows[0];
}

// Elimina un producto por id
export async function deleteProductoRepository(id: number) {
  const empresaId = getEmpresaActivaId();
  const query = 'DELETE FROM productos WHERE id = $1 AND empresa_id = $2 RETURNING *';
  const result = await pool.query(query, [id, empresaId]);
  return result.rows[0];
}
