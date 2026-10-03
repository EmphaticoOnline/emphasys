import CartaPorteViajeEditor from './CartaPorteViajeEditor';

type Props = {
  open: boolean;
  documentoId: number | null;
  folio: string;
  tipoDocumento?: 'factura' | 'traslado';
  onClose: () => void;
  onFirstSave?: () => void;
};

/** Presentación centrada de Viaje/Carta Porte. La usan Traslados y Facturas. */
export default function CartaPorteViajeModal({ tipoDocumento = 'traslado', ...props }: Props) {
  return <CartaPorteViajeEditor {...props} tipoDocumento={tipoDocumento} layout="modal" />;
}
