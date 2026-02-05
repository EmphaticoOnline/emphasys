import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Menu from './components/Menu.js';
import ContactosPage from './pages/ContactosPage.js';
import ProductosPage from './pages/ProductosPage.js';
import { SIDEBAR_WIDTH, HEADER_HEIGHT } from './components/Sidebar.js';
import Box from '@mui/material/Box';

export default function App() {
  return (
    <Router>
      <Menu />
      <Box
        sx={{
          marginLeft: SIDEBAR_WIDTH,
          marginTop: HEADER_HEIGHT,
          padding: 3,
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
          background: '#fff',
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Routes>
          <Route path="/contactos" element={<ContactosPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="*" element={<Navigate to="/contactos" />} />
        </Routes>
      </Box>
    </Router>
  );
}
