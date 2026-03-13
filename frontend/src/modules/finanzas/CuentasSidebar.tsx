import React from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Typography,
  Tooltip,
  Divider,
  Skeleton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { alpha } from '@mui/material/styles';
import type { FinanzasCuenta } from '../../types/finanzas';

interface CuentasSidebarProps {
  cuentas: FinanzasCuenta[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onEdit: (cuenta: FinanzasCuenta) => void;
  onDelete: (cuenta: FinanzasCuenta) => void;
  loading?: boolean;
}

export function CuentasSidebar({ cuentas, selectedId, onSelect, onNew, onEdit, onDelete, loading }: CuentasSidebarProps) {
  const currency = React.useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  return (
    <Paper elevation={0} sx={{ width: 320, flexShrink: 0, borderRadius: 3, border: '1px solid #e5e7eb', background: '#fff' }}>
      <Box sx={{ p: 2, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
          Cuentas
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={onNew}
          variant="contained"
          sx={{
            textTransform: 'none',
            borderRadius: 999,
            bgcolor: '#1d2f68',
            '&:hover': { bgcolor: '#162551' },
          }}
        >
          Nueva
        </Button>
      </Box>
      <Divider />
      <List sx={{ py: 0 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <ListItem key={`skeleton-${idx}`}>
                <Stack width="100%" spacing={0.5}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton width="40%" height={16} />
                </Stack>
              </ListItem>
            ))
          : cuentas.map((cuenta) => {
              const selected = cuenta.id === selectedId;
              return (
                <ListItemButton
                  key={cuenta.id}
                  selected={selected}
                  onClick={() => onSelect(cuenta.id)}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    my: 0.5,
                    '&.Mui-selected': {
                      backgroundColor: alpha('#1d2f68', 0.08),
                      border: `1px solid ${alpha('#1d2f68', 0.3)}`,
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography fontWeight={700} color={selected ? '#1d2f68' : '#111827'}>
                        {cuenta.identificador}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {currency.format(Number(cuenta.saldo ?? 0))}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => onEdit(cuenta)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => onDelete(cuenta)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItemButton>
              );
            })}

        {!loading && cuentas.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No hay cuentas registradas todavía.
            </Typography>
          </Box>
        )}
      </List>
    </Paper>
  );
}

export default CuentasSidebar;
