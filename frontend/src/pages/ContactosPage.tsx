import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
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
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 0, py: 0 }}>
      <Box sx={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">Contactos</Typography>
            <Typography variant="body2" color="#4b5563">Gestiona y consulta tus contactos registrados.</Typography>
          </Box>
          <Button variant="contained" color="primary">Nuevo contacto</Button>
        </Box>

        <TableContainer>
          <Table size="medium" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f1f3f6' }}>
                <TableCell sx={{ fontWeight: 700, color: '#1d2f68', borderBottom: '1px solid #e5e7eb' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#1d2f68', borderBottom: '1px solid #e5e7eb' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#1d2f68', borderBottom: '1px solid #e5e7eb' }}>Teléfono</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contactos.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{
                    '&:hover': { backgroundColor: '#e8f3f1' },
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, py: 1.5, px: 2 }}>{c.nombre}</TableCell>
                  <TableCell sx={{ color: '#4b5563', py: 1.5, px: 2 }}>{c.email}</TableCell>
                  <TableCell sx={{ py: 1.5, px: 2 }}>{c.telefono}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
