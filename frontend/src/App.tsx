import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContactosPage from './pages/ContactosPage.js';
import ProductosPage from './pages/ProductosPage.js';
import Layout from './components/Layout.js';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/contactos" element={<ContactosPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="*" element={<Navigate to="/contactos" />} />
        </Routes>
      </Layout>
    </Router>
  );
}
