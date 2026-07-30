import { CfdiValidationError } from './cfdi.service';

export type PagoComplementErrorCode =
  | 'PAYMENT_WITHOUT_APPLICATIONS'
  | 'RELATED_INVOICE_NOT_FOUND'
  | 'RELATED_INVOICE_NOT_STAMPED'
  | 'RELATED_INVOICE_WITHOUT_UUID'
  | 'RELATED_INVOICE_WITHOUT_XML'
  | 'RELATED_INVOICE_NOT_PPD'
  | 'RELATED_INVOICE_CANCELLED'
  | 'RELATED_RECEIVER_MISMATCH'
  | 'RELATED_XML_INVALID'
  | 'PAYMENT_APPLICATION_INVALID'
  | 'PAYMENT_BALANCE_INVALID';

export class PagoComplementValidationError extends CfdiValidationError {
  constructor(
    readonly code: PagoComplementErrorCode,
    message: string,
    readonly statusCode: 404 | 409 | 422,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PagoComplementValidationError';
  }
}

