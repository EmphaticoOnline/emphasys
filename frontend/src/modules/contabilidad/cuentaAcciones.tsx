import * as React from 'react';
import { Box, Button, IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import type { Cuenta } from '../../types/contabilidad';
import type { SubVista } from './CuentasTab';

// Acciones de cuenta (Auxiliares/Editar/Eliminar) y el botón "Nueva cuenta":
// antes vivían solo en la subtab Catálogo (ya eliminada); ahora se reutilizan
// tal cual desde Saldos por mes y Saldos por año, sin duplicar la lógica de
// los handlers (que sigue viviendo en CuentasTab). Orden fijo: Auxiliares (si
// se pasa onVerAuxiliar) | Editar | Eliminar. Activar/Desactivar se movió al
// formulario de cuenta (campo "Activa"), ya no vive en la grilla.

export interface AccionesCuentaHandlers {
  onEditar: (cuenta: Cuenta) => void;
  onPedirEliminar: (cuenta: Cuenta) => void;
}

const ANCHO_SLOT = 28;

// Slot de ancho fijo: Editar y Eliminar deben caer siempre en la misma
// posición horizontal, aunque el slot de Auxiliares (a la izquierda) no
// tenga icono para cuentas no afectables. Un placeholder invisible del mismo
// ancho evita el "corrimiento" que causaba renderizar el icono condicional
// directamente (sin reservar su espacio).
function Slot({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ width: ANCHO_SLOT, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </Box>
  );
}

export function AccionesCuentaCell({
  cuenta,
  onEditar,
  onPedirEliminar,
  onVerAuxiliar,
}: AccionesCuentaHandlers & { cuenta: Cuenta | undefined; onVerAuxiliar?: (cuenta: Cuenta) => void }) {
  if (!cuenta) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, width: '100%' }}>
      {onVerAuxiliar && (
        <Slot>
          {cuenta.afectable ? (
            <Tooltip title="Ver auxiliares">
              <IconButton size="small" onClick={() => onVerAuxiliar(cuenta)} sx={{ color: '#1d2f68' }}>
                <ManageSearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Box sx={{ width: ANCHO_SLOT, visibility: 'hidden' }} />
          )}
        </Slot>
      )}
      <Slot>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => onEditar(cuenta)} sx={{ color: '#1d2f68' }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Slot>
      <Slot>
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => onPedirEliminar(cuenta)} sx={{ color: '#b91c1c' }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Slot>
    </Box>
  );
}

// Toggle compartido entre Saldos por mes y Saldos por año: antes vivía en una
// línea propia dentro de CuentasTab; ahora cada vista lo integra en su franja
// de filtros (alineado a la derecha) para no desperdiciar espacio vertical.
export function SubVistaSaldosToggle({
  subVista,
  onChange,
}: {
  subVista: SubVista;
  onChange: (valor: SubVista) => void;
}) {
  return (
    <ToggleButtonGroup
      value={subVista}
      exclusive
      size="small"
      onChange={(_e, value: SubVista | null) => value && onChange(value)}
      sx={{
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          px: 1.5,
          py: 0.4,
          fontSize: 13,
        },
      }}
    >
      <ToggleButton value="saldos-mes">Saldos por mes</ToggleButton>
      <ToggleButton value="saldos-anio">Saldos por año</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function BotonNuevaCuenta({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={onClick}
      sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
    >
      Nueva cuenta
    </Button>
  );
}
