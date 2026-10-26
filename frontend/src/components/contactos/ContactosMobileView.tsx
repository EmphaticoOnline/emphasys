import * as React from 'react';
import { Box } from '@mui/material';
import type { ContactosMobileViewProps } from './ContactosView.types';
import ContactosAdvancedFilters from './ContactosAdvancedFilters';
import ContactosListaCompacta from './ContactosListaCompacta';
import ContactoWorkspace from './ContactoWorkspace';

/** Móvil: misma lista y workspace de escritorio; el detalle reemplaza a la lista, como en Cotizaciones. */
export default function ContactosMobileView({
  contactos,
  rowCount,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEditContacto,
  onViewActividades,
  onDeleteContacto,
  onExport,
  exportLoading,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  vendedores,
  origenOptions,
  tiposOpciones,
  advancedFilters,
  advancedFiltersCount,
  onToggleFilters,
  onSelectedTiposChange,
  onOrigenContactoIdChange,
  onVendedorIdChange,
  onActivoChange,
  onFechaAltaDesdeChange,
  onFechaAltaHastaChange,
  onInteresInicialChange,
  onObservacionesChange,
  onClearAdvancedFilters,
  onCreateContacto,
  vendedorNombre,
}: ContactosMobileViewProps) {
  const [detalleContactoId, setDetalleContactoId] = React.useState<number | null>(null);

  return (
    <Box sx={{ flex: 1, minHeight: 'calc(100dvh - 112px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {detalleContactoId == null ? (
        <ContactosListaCompacta
          contactos={contactos}
          rowCount={rowCount}
          loading={loading}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            if (model.pageSize !== pageSize) onPageSizeChange(model.pageSize);
            else onPageChange(model.page);
          }}
          selectedContactoId={null}
          onSelectContacto={setDetalleContactoId}
          onEditContacto={onEditContacto}
          onDeleteContacto={onDeleteContacto}
          onViewActividades={onViewActividades}
          vendedorNombre={vendedorNombre}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          onClearSearch={onClearSearch}
          onCreate={onCreateContacto}
          onExport={onExport}
          exportLoading={Boolean(exportLoading)}
          filtrosActivos={advancedFiltersCount}
          panelFiltros={(
            <ContactosAdvancedFilters
              rowCount={rowCount}
              vendedores={vendedores}
              origenOptions={origenOptions}
              tiposOpciones={tiposOpciones}
              filters={advancedFilters}
              activeFiltersCount={advancedFiltersCount}
              onToggleFilters={onToggleFilters}
              onSelectedTiposChange={onSelectedTiposChange}
              onOrigenContactoIdChange={onOrigenContactoIdChange}
              onVendedorIdChange={onVendedorIdChange}
              onActivoChange={onActivoChange}
              onFechaAltaDesdeChange={onFechaAltaDesdeChange}
              onFechaAltaHastaChange={onFechaAltaHastaChange}
              onInteresInicialChange={onInteresInicialChange}
              onObservacionesChange={onObservacionesChange}
              onClearAdvancedFilters={onClearAdvancedFilters}
              soloPanel
            />
          )}
          helpHref="/docs/guia-contactos.html"
        />
      ) : (
        <ContactoWorkspace
          contactoId={detalleContactoId}
          vendedorNombre={vendedorNombre}
          onVolver={() => setDetalleContactoId(null)}
          onEditar={onEditContacto}
          onEliminar={(contactoId) => {
            setDetalleContactoId(null);
            onDeleteContacto(contactoId);
          }}
          onVerActividades={onViewActividades}
        />
      )}
    </Box>
  );
}
