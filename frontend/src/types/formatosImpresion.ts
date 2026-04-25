export type LayoutConfig = {
  mostrarHeader: boolean;
  mostrarCliente: boolean;
  mostrarPartidas: boolean;
  mostrarTotales: boolean;
  mostrarObservacionesPartida?: boolean;
  mostrarImagenPartida?: boolean;
  altoImagenPartida?: number | null;
  maxAnchoImagenPartida?: number | null;
  titulo?: string | null;
  colorPrimario?: string | null;
  colorTablaHeader?: string | null;
  mostrarLogo?: boolean;
};

export type LayoutSerie = {
  id: number;
  serie: string;
  tipo_documento: string;
  layout_id: number | null;
};

export type LayoutConfigResponse = {
  tipo_documento: string;
  serie: string | null;
  source: 'serie' | 'empresa' | 'default';
  layout: LayoutConfig;
  series?: LayoutSerie[];
};
