import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContactosPage from './pages/ContactosPage';
import ContactoFormPage from './pages/ContactoFormPage';
import ProductosPage from './pages/ProductosPage';
import ProductoFormPage from './pages/ProductoFormPage';
import DocumentosPage from './pages/DocumentosPage';
import DocumentosFormPage from './pages/DocumentosFormPage';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SeleccionEmpresaPage from './pages/SeleccionEmpresaPage';
import RequireAuth from './auth/RequireAuth';
import RequireEmpresa from './auth/RequireEmpresa';
import ConfiguracionPage from './pages/ConfiguracionPage';
import CatalogosConfigurablesPage from './pages/CatalogosConfigurablesPage';
import CatalogoTipoDetallePage from './pages/CatalogoTipoDetallePage';
import CamposConfiguracionPage from './pages/CamposConfiguracionPage';
import EmpresasPage from './pages/configuracion/EmpresasPage';
import RolesPage from './pages/configuracion/RolesPage';
import UsuariosPage from './pages/configuracion/UsuariosPage';
import ParametrosPage from './pages/configuracion/ParametrosPage';
import OpcionesParametrosPage from './pages/configuracion/OpcionesParametrosPage';
import DocumentosConfiguracionPage from './pages/configuracion/DocumentosConfiguracionPage';
import ConceptosConfigPage from './pages/configuracion/ConceptosPage';
import EmpresaImpuestosDefaultPage from './pages/configuracion/EmpresaImpuestosDefaultPage';
import FormatosImpresionPage from './pages/configuracion/FormatosImpresionPage';
import ConfiguracionCorreoPage from './pages/configuracion/ConfiguracionCorreoPage';
import WhatsappEtiquetasPage from './pages/configuracion/WhatsappEtiquetasPage';
import FinanzasPage from './pages/FinanzasPage';
import { Outlet } from 'react-router-dom';
import InventarioMovimientosPage from './pages/InventarioMovimientosPage';
import InventarioMovimientoFormPage from './pages/InventarioMovimientoFormPage';
import LeadsPage from './pages/LeadsPage';
import OportunidadesPage from './pages/OportunidadesPage';
import CotizacionesGridPage from './pages/CotizacionesGridPage';
import AIReportesPage from './pages/AIReportesPage';

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
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/oportunidades" element={<OportunidadesPage />} />
              <Route path="/ventas/:codigo" element={<DocumentosPage />} />
              <Route path="/ventas/:codigo/nuevo" element={<DocumentosFormPage />} />
              <Route path="/ventas/:codigo/:id" element={<DocumentosFormPage />} />
              <Route path="/ventas/cotizaciones-grid" element={<CotizacionesGridPage />} />
              <Route path="/compras/:codigo" element={<DocumentosPage />} />
              <Route path="/compras/:codigo/nuevo" element={<DocumentosFormPage />} />
              <Route path="/compras/:codigo/:id" element={<DocumentosFormPage />} />
              <Route path="/documentos" element={<Navigate to="/ventas/cotizacion" replace />} />
              <Route path="/facturas" element={<Navigate to="/ventas/factura" replace />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/configuracion/empresas" element={<EmpresasPage />} />
              <Route path="/configuracion/usuarios" element={<UsuariosPage />} />
              <Route path="/configuracion/roles" element={<RolesPage />} />
              <Route path="/configuracion/parametros" element={<ParametrosPage />} />
              <Route path="/configuracion/parametros-opciones" element={<OpcionesParametrosPage />} />
              <Route path="/configuracion/documentos" element={<DocumentosConfiguracionPage />} />
              <Route path="/configuracion/conceptos" element={<ConceptosConfigPage />} />
              <Route path="/configuracion/empresa/impuestos-default" element={<EmpresaImpuestosDefaultPage />} />
              <Route path="/configuracion/formatos-impresion" element={<FormatosImpresionPage />} />
              <Route path="/configuracion/correo" element={<ConfiguracionCorreoPage />} />
              <Route path="/configuracion/whatsapp-etiquetas" element={<WhatsappEtiquetasPage />} />
              <Route path="/configuracion/catalogos" element={<CatalogosConfigurablesPage />} />
              <Route path="/configuracion/catalogos/:tipo_catalogo_id" element={<CatalogoTipoDetallePage />} />
              <Route path="/configuracion/campos" element={<CamposConfiguracionPage />} />
              <Route path="/finanzas" element={<FinanzasPage />} />
              <Route path="/inventario/movimientos" element={<InventarioMovimientosPage />} />
              <Route path="/inventario/movimientos/nuevo" element={<InventarioMovimientoFormPage />} />
              <Route path="/informes/ia" element={<AIReportesPage />} />
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
