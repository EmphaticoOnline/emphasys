import CartaPorteViajeEditor from './CartaPorteViajeEditor';

type Props = {
  open: boolean;
  documentoId: number | null;
  folio: string;
  tipoDocumento?: 'factura' | 'traslado';
  onClose: () => void;
  onFirstSave?: () => void;
};

/** Presentación lateral histórica. Facturas y Traslados usan el modal. */
export default function CartaPorteViajeDrawer(props: Props) {
  return <CartaPorteViajeEditor {...props} layout="drawer" />;
}
