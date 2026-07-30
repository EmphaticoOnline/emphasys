import { CfdiEmailService } from './cfdi-email.service';

export class ComplementoPagoEmailService {
  static async enviar(input: {
    documentoId: number;
    empresaId: number;
    usuarioId?: number | null;
    emailDestino?: string;
  }): Promise<void> {
    await CfdiEmailService.enviar({
      tipo: 'complemento_pago',
      documentoId: input.documentoId,
      empresaId: input.empresaId,
      usuarioId: input.usuarioId,
      emailDestino: input.emailDestino,
    });
  }
}
