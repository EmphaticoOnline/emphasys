import React from 'react';
import { Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EmpresaImpuestosDefault from '../../modules/configuracion/EmpresaImpuestosDefault';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';

export default function EmpresaImpuestosDefaultPage() {
  const tokens = useTheme().emphasys;

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Impuestos por default"
        description="Administra los impuestos predeterminados que se aplican cuando un producto no tiene impuestos configurados."
      />

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2.5,
          bgcolor: tokens.content.elevated,
          border: `1px solid ${tokens.content.border}`,
        }}
      >
        <EmpresaImpuestosDefault />
      </Paper>
    </ConfigPageFrame>
  );
}
