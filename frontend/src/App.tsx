import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from './components/layout/SidebarLayout';
import ContactosPage from './pages/ContactosPage';
import ContactoFormPage from './pages/ContactoFormPage';
import ProductosPage from './pages/ProductosPage';
import ProductoFormPage from './pages/ProductoFormPage';
import DocumentosPage from './pages/DocumentosPage';
import DocumentosFormPage from './pages/DocumentosFormPage';
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
import SeriesDocumentosPage from './pages/configuracion/SeriesDocumentosPage';
import ConfiguracionCorreoPage from './pages/configuracion/ConfiguracionCorreoPage';
import CfdiPacConfigPage from './pages/configuracion/CfdiPacConfigPage';
import CfdiSatPage from './pages/configuracion/CfdiSatPage';
import WhatsappEtiquetasPage from './pages/configuracion/WhatsappEtiquetasPage';
import WhatsappPlantillasPage from './pages/configuracion/WhatsappPlantillasPage';
import FinanzasPage from './pages/FinanzasPage';
import ContabilidadPage from './pages/ContabilidadPage';
import { Outlet } from 'react-router-dom';
import InventarioMovimientosPage from './pages/InventarioMovimientosPage';
import InventarioMovimientoFormPage from './pages/InventarioMovimientoFormPage';
import CRMPage from './pages/CRMPage';
import ActividadFormPage from './pages/ActividadFormPage';
import OportunidadDetallePage from './pages/OportunidadDetallePage';
import CotizacionesGridPage from './pages/CotizacionesGridPage';
import AIReportesPage from './pages/AIReportesPage';
import InformesPage from './pages/informes/InformesPage';
import EstadoCuentaProveedorPage from './pages/informes/compras/EstadoCuentaProveedorPage';
import EstadoCuentaClientePage from './pages/informes/ventas/EstadoCuentaClientePage';
import ComprasPorProveedorPage from './pages/informes/compras/ComprasPorProveedorPage';
import ComprasPorProductoPage from './pages/informes/compras/ComprasPorProductoPage';
import OCPendientesRecibirPage from './pages/informes/compras/OCPendientesRecibirPage';
import VentasPorClientePage from './pages/informes/ventas/VentasPorClientePage';
import VentasPorProductoPage from './pages/informes/ventas/VentasPorProductoPage';
import VencimientosProveedoresPage from './pages/informes/finanzas/VencimientosProveedoresPage';
import VencimientosClientesPage    from './pages/informes/finanzas/VencimientosClientesPage';
import PagosClientesPage           from './pages/informes/finanzas/PagosClientesPage';
import PagosProveedoresPage        from './pages/informes/finanzas/PagosProveedoresPage';
import PosicionTesoreriaPage       from './pages/informes/finanzas/PosicionTesoreriaPage';
import CarteraVencidaPage               from './pages/informes/finanzas/CarteraVencidaPage';
import MovimientosNoConciliadosPage    from './pages/informes/finanzas/MovimientosNoConciliadosPage';
import ProgramacionPagosPage           from './pages/finanzas/ProgramacionPagosPage';
import ConciliacionBancariaPage        from './pages/finanzas/ConciliacionBancariaPage';
import HistorialPreciosCompraPage from './pages/informes/compras/HistorialPreciosCompraPage';
import ComprasPorPeriodoPage from './pages/informes/compras/ComprasPorPeriodoPage';
import HistorialPreciosVentaPage from './pages/informes/ventas/HistorialPreciosVentaPage';
import VentasPorPeriodoPage from './pages/informes/ventas/VentasPorPeriodoPage';
import PedidosPendientesFacturarPage from './pages/informes/ventas/PedidosPendientesFacturarPage';
import RemisionesPendientesFacturarPage from './pages/informes/ventas/RemisionesPendientesFacturarPage';
import ProduccionPage from './pages/ProduccionPage';
import ConfiguracionEtapasProduccionPage from './pages/ConfiguracionEtapasProduccionPage';
import ListasPreciosPage from './pages/configuracion/ListasPreciosPage';
import PreciosPage from './pages/configuracion/PreciosPage';
import CamposObligatoriosPage from './pages/configuracion/CamposObligatoriosPage';
import AutorizacionesBandejaPage from './pages/AutorizacionesBandejaPage';
import AutorizacionesReglasPage from './pages/configuracion/AutorizacionesReglasPage';
import MetodosPagoPage from './pages/configuracion/MetodosPagoPage';
import ExistenciasPorAlmacenPage from './pages/informes/inventario/ExistenciasPorAlmacenPage';
import KardexProductoPage from './pages/informes/inventario/KardexProductoPage';
import MovimientosInventarioPage from './pages/informes/inventario/MovimientosInventarioPage';
import ProductosBajoMinimoPage from './pages/informes/inventario/ProductosBajoMinimoPage';
import InventarioValorizadoPage from './pages/informes/inventario/InventarioValorizadoPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<SidebarLayout />}>
            {/* Selección de empresa: no requiere empresa activa */}
            <Route path="/seleccionar-empresa" element={<SeleccionEmpresaPage />} />

            <Route element={<RequireEmpresa />}>
              {/* Catálogos */}
              <Route path="/contactos" element={<ContactosPage />} />
              <Route path="/contactos/nuevo" element={<ContactoFormPage />} />
              <Route path="/contactos/:id" element={<ContactoFormPage />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/productos/nuevo" element={<ProductoFormPage />} />
              <Route path="/productos/:id" element={<ProductoFormPage />} />

              {/* Ventas */}
              <Route path="/ventas/produccion" element={<ProduccionPage />} />
              <Route path="/ventas/cotizaciones-grid" element={<CotizacionesGridPage />} />
              <Route path="/ventas/:codigo" element={<DocumentosPage />} />
              <Route path="/ventas/:codigo/nuevo" element={<DocumentosFormPage />} />
              <Route path="/ventas/:codigo/:id" element={<DocumentosFormPage />} />

              {/* Compras */}
              <Route path="/compras/:codigo" element={<DocumentosPage />} />
              <Route path="/compras/:codigo/nuevo" element={<DocumentosFormPage />} />
              <Route path="/compras/:codigo/:id" element={<DocumentosFormPage />} />

              {/* CRM */}
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/crm/actividades" element={<CRMPage />} />
              <Route path="/crm/actividades/nueva" element={<ActividadFormPage />} />
              <Route path="/crm/actividades/:id" element={<ActividadFormPage />} />
              <Route path="/crm/oportunidades" element={<CRMPage />} />
              <Route path="/crm/oportunidades/:id" element={<OportunidadDetallePage />} />
              <Route path="/crm/conversaciones" element={<CRMPage />} />
              <Route path="/leads" element={<Navigate to="/crm/conversaciones" replace />} />
              <Route path="/oportunidades" element={<Navigate to="/crm/oportunidades" replace />} />

              {/* Finanzas / Inventario / Informes */}
              <Route path="/finanzas" element={<FinanzasPage />} />
              <Route path="/contabilidad" element={<ContabilidadPage />} />
              <Route path="/contabilidad/polizas" element={<ContabilidadPage />} />
              <Route path="/contabilidad/tipos-poliza" element={<ContabilidadPage />} />
              <Route path="/contabilidad/rangos" element={<ContabilidadPage />} />
              <Route path="/contabilidad/configuracion" element={<ContabilidadPage />} />
              <Route path="/finanzas/programacion-pagos" element={<ProgramacionPagosPage />} />
              <Route path="/finanzas/conciliacion-bancaria" element={<ConciliacionBancariaPage />} />
              <Route path="/inventario/movimientos" element={<InventarioMovimientosPage />} />
              <Route path="/inventario/movimientos/nuevo" element={<InventarioMovimientoFormPage />} />
              <Route path="/informes" element={<InformesPage />} />
              <Route path="/informes/ia" element={<AIReportesPage />} />
              <Route path="/informes/compras/compras-por-proveedor"    element={<ComprasPorProveedorPage />} />
              <Route path="/informes/compras/compras-por-producto"    element={<ComprasPorProductoPage />} />
              <Route path="/informes/compras/oc-pendientes-recibir"   element={<OCPendientesRecibirPage />} />
              <Route path="/informes/compras/estado-cuenta-proveedor" element={<EstadoCuentaProveedorPage />} />
              <Route path="/informes/ventas/ventas-por-cliente"       element={<VentasPorClientePage />} />
              <Route path="/informes/ventas/ventas-por-producto"      element={<VentasPorProductoPage />} />
              <Route path="/informes/ventas/estado-cuenta-cliente"    element={<EstadoCuentaClientePage />} />
              <Route path="/informes/compras/historial-precios"                    element={<HistorialPreciosCompraPage />} />
              <Route path="/informes/compras/compras-por-periodo"               element={<ComprasPorPeriodoPage />} />
              <Route path="/informes/ventas/historial-precios"                  element={<HistorialPreciosVentaPage />} />
              <Route path="/informes/ventas/ventas-por-periodo"                 element={<VentasPorPeriodoPage />} />
              <Route path="/informes/ventas/pedidos-pendientes-facturar"        element={<PedidosPendientesFacturarPage />} />
              <Route path="/informes/ventas/remisiones-pendientes-facturar"     element={<RemisionesPendientesFacturarPage />} />
              <Route path="/informes/finanzas/vencimientos-proveedores"        element={<VencimientosProveedoresPage />} />
              <Route path="/informes/finanzas/vencimientos-clientes"           element={<VencimientosClientesPage />} />
              <Route path="/informes/finanzas/pagos-clientes"                  element={<PagosClientesPage />} />
              <Route path="/informes/finanzas/pagos-proveedores"               element={<PagosProveedoresPage />} />
              <Route path="/informes/finanzas/posicion-tesoreria"              element={<PosicionTesoreriaPage />} />
              <Route path="/informes/finanzas/cartera-vencida"                 element={<CarteraVencidaPage />} />
              <Route path="/informes/finanzas/movimientos-no-conciliados"     element={<MovimientosNoConciliadosPage />} />
              <Route path="/informes/inventario/existencias-por-almacen"    element={<ExistenciasPorAlmacenPage />} />
              <Route path="/informes/inventario/kardex"                     element={<KardexProductoPage />} />
              <Route path="/informes/inventario/movimientos"                element={<MovimientosInventarioPage />} />
              <Route path="/informes/inventario/bajo-minimo"                element={<ProductosBajoMinimoPage />} />
              <Route path="/informes/inventario/valorizado"                 element={<InventarioValorizadoPage />} />

              {/* Configuración */}
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
              <Route path="/configuracion/series-documento" element={<SeriesDocumentosPage />} />
              <Route path="/configuracion/correo" element={<ConfiguracionCorreoPage />} />
              <Route path="/configuracion/cfdi-pac" element={<CfdiPacConfigPage />} />
              <Route path="/configuracion/cfdi-sat" element={<CfdiSatPage />} />
              <Route path="/configuracion/whatsapp-etiquetas" element={<WhatsappEtiquetasPage />} />
              <Route path="/configuracion/whatsapp-plantillas" element={<WhatsappPlantillasPage />} />
              <Route path="/configuracion/produccion-etapas" element={<ConfiguracionEtapasProduccionPage />} />
              <Route path="/configuracion/listas-precios" element={<ListasPreciosPage />} />
              <Route path="/configuracion/precios" element={<PreciosPage />} />
              <Route path="/configuracion/campos-obligatorios" element={<CamposObligatoriosPage />} />
              <Route path="/configuracion/catalogos" element={<CatalogosConfigurablesPage />} />
              <Route path="/configuracion/catalogos/:tipo_catalogo_id" element={<CatalogoTipoDetallePage />} />
              <Route path="/configuracion/campos" element={<CamposConfiguracionPage />} />
              <Route path="/configuracion/autorizaciones-reglas" element={<AutorizacionesReglasPage />} />
              <Route path="/configuracion/metodos-pago" element={<MetodosPagoPage />} />

              {/* Autorizaciones */}
              <Route path="/autorizaciones" element={<AutorizacionesBandejaPage />} />

              {/* Redirects legacy */}
              <Route path="/documentos" element={<Navigate to="/ventas/cotizacion" replace />} />
              <Route path="/facturas" element={<Navigate to="/ventas/factura" replace />} />

              {/* Default / catch-all */}
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
