import { useMemo } from 'react';
import type { TipoDocumento } from '../../types/documentos.types';
import { getDocumentoTypeConfig, resolveDocumentoTextos } from './documentoTypeConfig';
import type { ContactCaptureMode, ContactoTipoPermitido, DocumentoAccion, DocumentoTextos, EntidadCreationMode, ProductoCaptureMode, ProductoTipoPermitido, VendedorCaptureMode, VendedorTipoPermitido } from './documentoTypes';

export type UseDocumentoConfigResult = {
  config: ReturnType<typeof getDocumentoTypeConfig>;
  textos: DocumentoTextos;
  filtroAgente: boolean;
  mostrarSaldo: boolean;
  contactoLabel: string;
  tiposContactoPermitidos: string[] | undefined;
  accionesDisponibles: DocumentoAccion[];
  estatusPermitidos: string[];
  esDocumentoMonetario: boolean;
  requiereCuentaFinanciera: boolean;
  usaPartidas: boolean;
  partidasMostrarImagenes: boolean;
  partidasMostrarEsParteOportunidad: boolean;
  partidasMostrarMontoOportunidad: boolean;
  widgetPagosDrawer: boolean;
  widgetOrigenDocumento: boolean;
  widgetTratamientoFiscal: boolean;
  widgetFiscalTab: boolean;
  defaultSerie: string | null;
  defaultEstadoSeguimiento: string | null;
  contactoCreationMode: EntidadCreationMode;
  contactoCaptureMode: ContactCaptureMode;
  contactoDefaultTipoContacto: ContactoTipoPermitido;
  contactoTiposPermitidos: ContactoTipoPermitido[];
  vendedorVisible: boolean;
  vendedorCreationMode: EntidadCreationMode;
  vendedorCaptureMode: VendedorCaptureMode;
  vendedorDefaultTipoVendedor: VendedorTipoPermitido;
  vendedorTiposPermitidos: VendedorTipoPermitido[];
  productoCreationMode: EntidadCreationMode;
  productoCaptureMode: ProductoCaptureMode;
  productoDefaultTipoProducto: ProductoTipoPermitido;
  productoTiposPermitidos: ProductoTipoPermitido[];
};

export function useDocumentoConfig(tipo: TipoDocumento): UseDocumentoConfigResult {
  return useMemo(() => {
    const config = getDocumentoTypeConfig(tipo);
    const isDocumentoCompra = String(tipo ?? '').trim().toLowerCase().endsWith('_compra');

    return {
      config,
      textos: resolveDocumentoTextos(tipo, config),
      filtroAgente: config?.features?.filtroAgente ?? false,
      mostrarSaldo: config?.features?.mostrarSaldo ?? false,
      contactoLabel: config?.relatedEntities?.contacto?.label ?? (isDocumentoCompra ? 'Proveedor' : 'Cliente'),
      tiposContactoPermitidos: config?.features?.tiposContactoPermitidos,
      accionesDisponibles: config?.features?.accionesDisponibles ?? [],
      estatusPermitidos: config?.estatusPermitidos ?? ['borrador', 'emitido', 'cancelado'],
      esDocumentoMonetario: config?.esDocumentoMonetario ?? false,
      requiereCuentaFinanciera: config?.requiereCuentaFinanciera ?? false,
      usaPartidas: config?.usaPartidas ?? true,
      partidasMostrarImagenes: config?.partidas?.mostrarImagenes ?? false,
      partidasMostrarEsParteOportunidad: config?.partidas?.mostrarEsParteOportunidad ?? false,
      partidasMostrarMontoOportunidad: config?.partidas?.mostrarMontoOportunidad ?? false,
      widgetPagosDrawer: config?.widgets?.pagosDrawer ?? false,
      widgetOrigenDocumento: config?.widgets?.origenDocumento ?? false,
      widgetTratamientoFiscal: config?.widgets?.tratamientoFiscal ?? false,
      widgetFiscalTab: config?.widgets?.fiscalTab ?? false,
      defaultSerie: config?.defaults?.serie ?? null,
      defaultEstadoSeguimiento: config?.defaults?.estadoSeguimiento ?? null,
      contactoCreationMode: config?.relatedEntities?.contacto?.creationMode ?? 'disabled',
      contactoCaptureMode: config?.relatedEntities?.contacto?.captureMode ?? 'simple',
      contactoDefaultTipoContacto: config?.relatedEntities?.contacto?.defaultTipoContacto ?? 'Lead',
      contactoTiposPermitidos: config?.relatedEntities?.contacto?.tiposPermitidos ?? ['Lead', 'Cliente'],
      vendedorVisible: config?.relatedEntities?.vendedor?.visible ?? !isDocumentoCompra,
      vendedorCreationMode: config?.relatedEntities?.vendedor?.creationMode ?? 'disabled',
      vendedorCaptureMode: config?.relatedEntities?.vendedor?.captureMode ?? 'simple',
      vendedorDefaultTipoVendedor: config?.relatedEntities?.vendedor?.defaultTipoVendedor ?? 'Vendedor',
      vendedorTiposPermitidos: config?.relatedEntities?.vendedor?.tiposPermitidos ?? ['Vendedor'],
      productoCreationMode: config?.relatedEntities?.producto?.creationMode ?? 'disabled',
      productoCaptureMode: config?.relatedEntities?.producto?.captureMode ?? 'simple',
      productoDefaultTipoProducto: config?.relatedEntities?.producto?.defaultTipoProducto ?? 'Inventariable',
      productoTiposPermitidos: config?.relatedEntities?.producto?.tiposPermitidos ?? ['Inventariable', 'No inventariable', 'Kit'],
    };
  }, [tipo]);
}