export async function fetchProductos() {
  const res = await fetch('/api/productos');
  if (!res.ok) throw new Error('Error al obtener productos');
  return res.json();
}
