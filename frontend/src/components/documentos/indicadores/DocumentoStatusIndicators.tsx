import { StatusIndicatorGroup } from '../../status';
import DocumentoAccountingIndicator from './DocumentoAccountingIndicator';
import DocumentoCfdiIndicator from './DocumentoCfdiIndicator';
import DocumentoFinancialIndicator from './DocumentoFinancialIndicator';
import type { DocumentoIndicatorModel } from './documentosIndicators.types';

export interface DocumentoStatusIndicatorsProps extends DocumentoIndicatorModel {
  maxVisible?: number;
}

export default function DocumentoStatusIndicators({ financial, cfdi, accounting, maxVisible = 3 }: DocumentoStatusIndicatorsProps) {
  const items = [
    financial ? {
      id: 'financial',
      order: 10,
      detailLabel: 'Estado financiero',
      indicator: <DocumentoFinancialIndicator {...financial} />,
    } : null,
    cfdi && cfdi.status !== 'not_applicable' ? {
      id: 'cfdi',
      order: 20,
      detailLabel: 'CFDI',
      indicator: <DocumentoCfdiIndicator {...cfdi} />,
    } : null,
    accounting ? {
      id: 'accounting',
      order: 30,
      detailLabel: 'Contabilidad',
      indicator: <DocumentoAccountingIndicator {...accounting} />,
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return <StatusIndicatorGroup items={items} maxVisible={maxVisible} ariaLabel="Indicadores de la factura" />;
}
