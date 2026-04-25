export type DocumentLayout = {
  mostrarHeader: boolean;
  mostrarCliente: boolean;
  mostrarPartidas: boolean;
  mostrarTotales: boolean;
  mostrarObservacionesPartida?: boolean;
  mostrarImagenPartida?: boolean;
  altoImagenPartida?: number;
  titulo?: string | null;
  colorPrimario?: string | null;
  colorTablaHeader?: string | null;
  mostrarLogo?: boolean;
};

export const DOCUMENT_LAYOUTS: Record<string, DocumentLayout> = {
  factura: {
    mostrarHeader: true,
    mostrarCliente: true,
    mostrarPartidas: true,
    mostrarTotales: true,
    mostrarObservacionesPartida: false,
    titulo: null,
    colorPrimario: null,
    colorTablaHeader: '#1d2f68',
    mostrarLogo: true,
  },
  cotizacion: {
    mostrarHeader: true,
    mostrarCliente: true,
    mostrarPartidas: true,
    mostrarTotales: true,
    mostrarObservacionesPartida: true,
    mostrarImagenPartida: true,
    altoImagenPartida: 60,
    titulo: null,
    colorPrimario: null,
    colorTablaHeader: '#1d2f68',
    mostrarLogo: true,
  },
};
