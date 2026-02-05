export async function fetchContactos() {
  const res = await fetch('/api/contactos');
  if (!res.ok) throw new Error('Error al obtener contactos');
  return res.json();
}
