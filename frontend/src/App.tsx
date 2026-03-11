import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContactosPage from './pages/ContactosPage.js';
import ContactoFormPage from './pages/ContactoFormPage.js';
import ProductosPage from './pages/ProductosPage.js';
import ProductoFormPage from './pages/ProductoFormPage.js';
import DocumentosPage from './pages/DocumentosPage.js';
import DocumentosFormPage from './pages/DocumentosFormPage.js';
import Layout from './components/Layout.js';
import LoginPage from './pages/LoginPage.js';
import SeleccionEmpresaPage from './pages/SeleccionEmpresaPage.js';
import RequireAuth from './auth/RequireAuth.js';
import RequireEmpresa from './auth/RequireEmpresa.js';
import ConfiguracionPage from './pages/ConfiguracionPage.js';
import CatalogosConfigurablesPage from './pages/CatalogosConfigurablesPage.js';
import CatalogoTipoDetallePage from './pages/CatalogoTipoDetallePage.js';
import CamposConfiguracionPage from './pages/CamposConfiguracionPage.js';
import EmpresasPage from './pages/configuracion/EmpresasPage.js';
import RolesPage from './pages/configuracion/RolesPage.js';
import UsuariosPage from './pages/configuracion/UsuariosPage.js';
import { Outlet } from 'react-router-dom';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<LayoutWrapper />}>
            <Route path="/seleccionar-empresa" element={<SeleccionEmpresaPage />} />

            <Route element={<RequireEmpresa />}>
              <Route path="/contactos" element={<ContactosPage />} />
              <Route path="/contactos/nuevo" element={<ContactoFormPage />} />
              <Route path="/contactos/:id" element={<ContactoFormPage />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/productos/nuevo" element={<ProductoFormPage />} />
              <Route path="/productos/:id" element={<ProductoFormPage />} />
              <Route path="/documentos" element={<DocumentosPage tipoDocumento="cotizacion" />} />
              <Route path="/documentos/nuevo" element={<DocumentosFormPage tipoDocumento="cotizacion" />} />
              <Route path="/documentos/:id" element={<DocumentosFormPage tipoDocumento="cotizacion" />} />
              <Route path="/facturas" element={<DocumentosPage tipoDocumento="factura" />} />
              <Route path="/facturas/nuevo" element={<DocumentosFormPage tipoDocumento="factura" />} />
              <Route path="/facturas/:id" element={<DocumentosFormPage tipoDocumento="factura" />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/configuracion/empresas" element={<EmpresasPage />} />
              <Route path="/configuracion/usuarios" element={<UsuariosPage />} />
              <Route path="/configuracion/roles" element={<RolesPage />} />
              <Route path="/configuracion/catalogos" element={<CatalogosConfigurablesPage />} />
              <Route path="/configuracion/catalogos/:tipo_catalogo_id" element={<CatalogoTipoDetallePage />} />
              <Route path="/configuracion/campos" element={<CamposConfiguracionPage />} />
              <Route path="/" element={<Navigate to="/contactos" replace />} />
              <Route path="*" element={<Navigate to="/contactos" replace />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
