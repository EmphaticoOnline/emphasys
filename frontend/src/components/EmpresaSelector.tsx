import { useNavigate } from 'react-router-dom';
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material';
import { useSession } from '../session/useSession';
import type { Empresa } from '../session/sessionTypes';
import { resolveRutaInicio } from '../utils/rutaInicio';

interface EmpresaSelectorProps {
  variant?: 'header' | 'panel';
  fullWidth?: boolean;
  /** Solo la barra móvil: sin etiqueta y con menos ancho. */
  compact?: boolean;
}

export default function EmpresaSelector({ variant = 'header', fullWidth = false, compact = false }: EmpresaSelectorProps) {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const empresas: Empresa[] = session.empresas ?? [];
  const empresaActivaId = session.empresaActivaId ?? '';
  const isPanel = variant === 'panel';
  const theme = useTheme();
  const frame = theme.emphasys.frame;
  const primary = theme.palette.primary.main;

  if (!empresas || empresas.length <= 1) return null;

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value;
    const parsedId = nextId ? Number(nextId) : null;
    // Solo recargar si realmente cambió
    if (parsedId !== session.empresaActivaId) {
      const nextSession = { ...session, empresaActivaId: parsedId };
      setSession(nextSession);
      navigate(await resolveRutaInicio(nextSession), { replace: true });
    }
  };

  const formControl = (
    <FormControl
      size="small"
      sx={{
        minWidth: fullWidth ? '100%' : compact ? 0 : 220,
        maxWidth: compact ? 148 : 'none',
        width: fullWidth ? '100%' : 'auto',
        '& .MuiInputLabel-root': { color: '#475569' },
        '& .MuiInputLabel-root.Mui-focused': { color: primary },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: isPanel ? '#cbd5e1' : frame.controlBorder,
        },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isPanel ? '#94a3b8' : frame.foreground },
        '& .MuiOutlinedInput-root': {
          color: isPanel ? '#0f172a' : frame.controlForeground,
          backgroundColor: isPanel ? '#fff' : frame.control,
          ...(compact ? { height: 30, fontSize: 13 } : {}),
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: isPanel ? primary : frame.foreground,
          },
          '& .MuiSelect-icon': { color: isPanel ? primary : frame.foreground },
          '& .MuiSelect-select': compact ? { py: '4px', fontSize: 13 } : {},
        },
      }}
    >
      {isPanel && <InputLabel id="empresa-selector-label">Empresa</InputLabel>}
      <Select
        labelId="empresa-selector-label"
        value={empresaActivaId ? String(empresaActivaId) : ''}
        label={isPanel ? 'Empresa' : undefined}
        onChange={handleChange}
      >
        {empresas.map((empresa) => (
          <MenuItem key={empresa.id} value={String(empresa.id)}>
            {empresa.nombre}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  if (isPanel) return formControl;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.5 : 1, minWidth: 0 }}>
      {compact ? null : (
        <Typography sx={{ fontSize: 14, color: frame.muted, whiteSpace: 'nowrap' }}>
          Empresa
        </Typography>
      )}
      {formControl}
    </Box>
  );
}
