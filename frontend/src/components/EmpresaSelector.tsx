import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";

export default function EmpresaSelector() {
  const { session, setSession } = useSession();
  const empresas: Empresa[] = session.empresas ?? [];
  const empresaActivaId = session.empresaActivaId ?? "";

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
        minWidth: 220,
        '& .MuiInputLabel-root': { color: '#e8f1ff' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#ffffff' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff' },
        '& .MuiOutlinedInput-root': {
          color: '#fff',
          backgroundColor: 'rgba(255,255,255,0.1)',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff' },
          '& .MuiSelect-icon': { color: '#fff' },
        },
      }}
    >
      <InputLabel id="empresa-selector-label">Empresa</InputLabel>
      <Select
        labelId="empresa-selector-label"
        value={empresaActivaId ? String(empresaActivaId) : ""}
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
