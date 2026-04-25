import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useSession } from '../session/useSession';
import type { Empresa } from '../session/sessionTypes';

interface EmpresaSelectorProps {
  variant?: 'header' | 'panel';
  fullWidth?: boolean;
}

export default function EmpresaSelector({ variant = 'header', fullWidth = false }: EmpresaSelectorProps) {
  const { session, setSession } = useSession();
  const empresas: Empresa[] = session.empresas ?? [];
  const empresaActivaId = session.empresaActivaId ?? '';
  const isPanel = variant === 'panel';

  if (!empresas || empresas.length <= 1) return null;

  const handleChange = (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value;
    const parsedId = nextId ? Number(nextId) : null;
    // Solo recargar si realmente cambió
    if (parsedId !== session.empresaActivaId) {
      setSession({ ...session, empresaActivaId: parsedId });
      window.location.reload();
    }
  };

  return (
    <FormControl
      size="small"
      sx={{
        minWidth: fullWidth ? '100%' : 220,
        width: fullWidth ? '100%' : 'auto',
        '& .MuiInputLabel-root': { color: isPanel ? '#475569' : '#e8f1ff' },
        '& .MuiInputLabel-root.Mui-focused': { color: isPanel ? '#1d2f68' : '#ffffff' },
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
      <InputLabel id="empresa-selector-label">Empresa</InputLabel>
      <Select
        labelId="empresa-selector-label"
        value={empresaActivaId ? String(empresaActivaId) : ''}
        label="Empresa"
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
}
