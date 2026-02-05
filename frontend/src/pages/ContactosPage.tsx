import * as React from 'react';
import { useEffect, useState } from 'react';
import { fetchContactos } from '../services/contactosService.js';

export default function ContactosPage() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContactos()
      .then(setContactos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Contactos</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {contactos.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.nombre}</td>
              <td>{c.email}</td>
              <td>{c.telefono}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
