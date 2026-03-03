import type { Producto, ProductoBasico } from '../types/producto';

const BASE_URL = '/api/productos';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Error en la solicitud de productos');
  }
  return res.json();
}

export async function fetchProductos(): Promise<Producto[]> {
  const res = await fetch(BASE_URL);
  return handleResponse<Producto[]>(res);
}

export async function fetchProducto(id: number): Promise<Producto> {
  const res = await fetch(`${BASE_URL}/${id}`);
  return handleResponse<Producto>(res);
}

export async function createProducto(payload: ProductoBasico): Promise<Producto> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Producto>(res);
}

export async function updateProducto(id: number, payload: ProductoBasico): Promise<Producto> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Producto>(res);
}

export async function deleteProducto(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}
