import { CfdiEmailService } from './cfdi-email.service';

type EnviarFacturaEmailInput = {
  documentoId: number;
  empresaId: number;
  usuarioId?: number | null;
  emailDestino?: string;
};

// Servicio para enviar facturas por correo con PDF y XML adjuntos
export class FacturaEmailService {
  /**
   * Envía una factura por correo. Usa emailDestino si se proporciona; de lo contrario, toma el email del contacto.
   */
  public static async enviarFactura(input: EnviarFacturaEmailInput): Promise<void> {
    await CfdiEmailService.enviar({
      tipo: 'factura',
      documentoId: input.documentoId,
      empresaId: input.empresaId,
      usuarioId: input.usuarioId,
      emailDestino: input.emailDestino,
    });
  }
}
