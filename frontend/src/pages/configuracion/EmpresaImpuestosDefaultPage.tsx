import React from 'react';
import EmpresaImpuestosDefault from '../../modules/configuracion/EmpresaImpuestosDefault';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';

export default function EmpresaImpuestosDefaultPage() {
  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Impuestos por default"
        description="Administra los impuestos predeterminados que se aplican cuando un producto no tiene impuestos configurados."
      />

      <EmpresaImpuestosDefault />
    </ConfigPageFrame>
  );
}
