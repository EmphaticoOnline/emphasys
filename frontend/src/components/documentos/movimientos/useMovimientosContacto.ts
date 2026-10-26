import * as React from 'react';
import { getDocumentosPaginados } from '../../../services/documentosService';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import { MOVIMIENTOS_CONTACTO } from './movimientosContacto.config';

const PAGE_SIZE = 8;

export type MovimientosTipoEstado = {
  rows: CotizacionListado[];
  /** null mientras no se conoce el total. */
  total: number | null;
  page: number;
  loading: boolean;
};

const ESTADO_INICIAL: MovimientosTipoEstado = { rows: [], total: null, page: 0, loading: false };

/**
 * Carga la primera página de cada tipo de MOVIMIENTOS_CONTACTO para el contacto
 * (sin importar si es cliente o proveedor). El total permite mostrar la
 * pestaña sólo cuando existen movimientos de ese tipo.
 */
export function useMovimientosContacto(contactoId: number | null) {
  const [estado, setEstado] = React.useState<Partial<Record<TipoDocumento, MovimientosTipoEstado>>>({});
  const contactoRef = React.useRef(contactoId);

  const cargar = React.useCallback((tipo: TipoDocumento, page: number) => {
    if (!contactoId) return;
    setEstado((prev) => ({ ...prev, [tipo]: { ...(prev[tipo] ?? ESTADO_INICIAL), loading: true } }));
    getDocumentosPaginados(tipo, { page: page + 1, limit: PAGE_SIZE, clienteId: contactoId })
      .then((response) => {
        if (contactoRef.current !== contactoId) return;
        const nuevos = response.data as unknown as CotizacionListado[];
        setEstado((prev) => ({
          ...prev,
          [tipo]: {
            rows: page === 0 ? nuevos : [...(prev[tipo]?.rows ?? []), ...nuevos],
            total: response.total,
            page,
            loading: false,
          },
        }));
      })
      .catch(() => {
        if (contactoRef.current !== contactoId) return;
        setEstado((prev) => ({ ...prev, [tipo]: { ...(prev[tipo] ?? ESTADO_INICIAL), total: prev[tipo]?.total ?? 0, loading: false } }));
      });
  }, [contactoId]);

  React.useEffect(() => {
    contactoRef.current = contactoId;
    setEstado({});
    if (!contactoId) return;
    MOVIMIENTOS_CONTACTO.forEach((config) => cargar(config.tipoDocumento, 0));
  }, [contactoId, cargar]);

  const cargarMas = React.useCallback((tipo: TipoDocumento) => {
    const actual = estado[tipo];
    if (!actual || actual.loading) return;
    cargar(tipo, actual.page + 1);
  }, [cargar, estado]);

  return { estado, cargarMas };
}
