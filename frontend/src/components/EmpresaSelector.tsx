import { useNavigate } from 'react-router-dom';
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useSession } from '../session/useSession';
import type { Empresa } from '../session/sessionTypes';
import { resolveRutaInicio } from '../utils/rutaInicio';

interface EmpresaSelectorProps {
  variant?: 'header' | 'panel';
  fullWidth?: boolean;
}

export default function EmpresaSelector({ variant = 'header', fullWidth = false }: EmpresaSelectorProps) {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const empresas: Empresa[] = session.empresas ?? [];
  const empresaActivaId = session.empresaActivaId ?? '';
  const isPanel = variant === 'panel';

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
        minWidth: fullWidth ? '100%' : 220,
        width: fullWidth ? '100%' : 'auto',
        '& .MuiInputLabel-root': { color: '#475569' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#1d2f68' },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: isPanel ? '#cbd5e1' : 'rgba(255,255,255,0.5)',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isPanel ? '#94a3b8' : '#ffffff' },
        '& .MuiOutlinedInput-root': {
          color: isPanel ? '#0f172a' : '#fff',
          backgroundColor: isPanel ? '#fff' : 'rgba(255,255,255,0.1)',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: isPanel ? '#1d2f68' : '#ffffff',
          },
          '& .MuiSelect-icon': { color: isPanel ? '#1d2f68' : '#fff' },
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
        Empresa
      </Typography>
      {formControl}
    </Box>
  );
}
