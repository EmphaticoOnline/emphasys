import pool from "../../config/database";
import type { TipoDocumento } from "../../types/documentos";
import type {
  GenerarDocumentoPayload,
  GenerarDocumentoResultado,
  OpcionGeneracion,
  PrepararGeneracionResponse,
  GenerarDocumentoPartidaInput,
} from "./document-generation.types.js";
import { calcularImpuestosPartida } from "../impuestos/impuestos.service";
import { actualizarTotales } from "./documentos.service";
import { sanitizarCamposCotizacion } from "./cotizacion-status";

class ServiceError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(code: string, message: string, status = 400, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const buildFolio = (serie?: string | null, numero?: number | null) => {
  if (!numero) return null;
  return serie ? `${serie}-${numero}` : `${numero}`;
};

const SERIE_DEFAULTS: Record<TipoDocumento, string> = {
  cotizacion: "COT",
  factura: "FAC",
  pedido: "PED",
  remision: "REM",
  orden_entrega: "ODE",
  requisicion: "REQ",
  orden_compra: "OC",
  recepcion: "REC",
  factura_compra: "FCO",
};

export class DocumentGenerationService {
  static async getOpcionesGeneracion(documentoId: number, empresaId: number): Promise<OpcionGeneracion[]> {
    const client = await pool.connect();
    try {
      const { rows: docRows } = await client.query(
        `SELECT id, tipo_documento
           FROM documentos
          WHERE id = $1 AND empresa_id = $2
          LIMIT 1`,
        [documentoId, empresaId]
      );

      const documento = docRows[0];
      if (!documento) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      console.log("[GenDoc] getOpcionesGeneracion", {
        documentoId,
        empresaId,
        tipo_documento_origen: documento.tipo_documento,
      });

      const { rows } = await client.query(
        `SELECT td_dest.codigo AS tipo_documento_destino, td_dest.nombre, etd.orden
           FROM core.empresas_tipos_documento_transiciones etd
           JOIN core.tipos_documento td_origen ON td_origen.id = etd.tipo_documento_origen_id
           JOIN core.tipos_documento td_dest   ON td_dest.id   = etd.tipo_documento_destino_id
          WHERE etd.empresa_id = $1
            AND etd.activo = true
            AND td_dest.activo = true
            AND LOWER(td_origen.codigo) = LOWER($2)
          ORDER BY etd.orden, td_dest.orden, td_dest.nombre`,
        [empresaId, documento.tipo_documento]
      );

      console.log("[GenDoc] opciones result", {
        documentoId,
        empresaId,
        tipo_documento_origen: documento.tipo_documento,
        rows_count: rows.length,
        rows,
      });

      return rows.map((row) => ({
        tipo_documento_destino: row.tipo_documento_destino as TipoDocumento,
        nombre: row.nombre ?? row.tipo_documento_destino,
        orden: row.orden !== null && row.orden !== undefined ? Number(row.orden) : undefined,
      }));
    } finally {
      client.release();
    }
  }

  static async prepararGeneracion(
    documentoId: number,
    tipoDestino: TipoDocumento,
    empresaId: number
  ): Promise<PrepararGeneracionResponse> {
    const client = await pool.connect();
    try {
      const { rows: docRows } = await client.query(
        `SELECT id, tipo_documento, serie, numero, contacto_principal_id, fecha_documento
           FROM documentos
          WHERE id = $1 AND empresa_id = $2
          LIMIT 1`,
        [documentoId, empresaId]
      );
      const documento = docRows[0];
      if (!documento) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      // Validar flujo permitido
      const { rowCount: flujoValido } = await client.query(
        `SELECT 1
           FROM core.empresas_tipos_documento_transiciones etd
           JOIN core.tipos_documento td_origen ON td_origen.id = etd.tipo_documento_origen_id
           JOIN core.tipos_documento td_dest   ON td_dest.id   = etd.tipo_documento_destino_id
          WHERE etd.empresa_id = $1
            AND etd.activo = true
            AND LOWER(td_origen.codigo) = LOWER($2)
            AND LOWER(td_dest.codigo) = LOWER($3)
          LIMIT 1`,
        [empresaId, documento.tipo_documento, tipoDestino]
      );
      if (!flujoValido) {
        throw new ServiceError("FLUJO_NO_PERMITIDO", "Tipo de documento destino no permitido para este origen", 400);
      }

      const { rows: partidas } = await client.query(
        `SELECT
            dp.id AS partida_id,
            dp.producto_id,
            COALESCE(dp.descripcion_alterna, p.descripcion) AS descripcion,
            dp.unidad,
            dp.cantidad AS cantidad_origen,
            dp.precio_unitario
         FROM documentos_partidas dp
         LEFT JOIN productos p ON p.id = dp.producto_id
        WHERE dp.documento_id = $1
        ORDER BY dp.numero_partida`,
        [documentoId]
      );

      const { rows: vinculos } = await client.query(
        `SELECT partida_origen_id, COALESCE(SUM(cantidad), 0) AS cantidad_generada
           FROM documentos_partidas_vinculos
          WHERE documento_origen_id = $1
          GROUP BY partida_origen_id`,
        [documentoId]
      );
      const cantidadesGeneradas = new Map<number, number>(
        vinculos.map((v) => [Number(v.partida_origen_id), Number(v.cantidad_generada)])
      );

      const partidasRespuesta = partidas.map((p) => {
        const yaGenerada = cantidadesGeneradas.get(Number(p.partida_id)) || 0;
        const pendiente = Math.max(Number(p.cantidad_origen) - yaGenerada, 0);
        return {
          partida_id: Number(p.partida_id),
          producto_id: p.producto_id ? Number(p.producto_id) : null,
          descripcion: p.descripcion ?? null,
          unidad: p.unidad ?? null,
          cantidad_origen: Number(p.cantidad_origen),
          cantidad_ya_generada: yaGenerada,
          cantidad_pendiente_sugerida: pendiente,
          cantidad_default: pendiente,
          precio_unitario: Number(p.precio_unitario ?? 0),
        };
      });

      return {
        documento_origen: {
          documento_id: Number(documento.id),
          tipo_documento: documento.tipo_documento as TipoDocumento,
          folio: buildFolio(documento.serie, documento.numero),
        },
        tipo_documento_destino: tipoDestino,
        partidas: partidasRespuesta,
      };
    } finally {
      client.release();
    }
  }

  static async generarDocumentoDesdeOrigen(
    payload: GenerarDocumentoPayload,
    empresaId: number,
    usuarioId?: number | null
  ): Promise<GenerarDocumentoResultado> {
    const client = await pool.connect();
    try {
      const { documento_origen_id, tipo_documento_destino, datos_encabezado, partidas } = payload;
      if (!partidas || partidas.length === 0) {
        throw new ServiceError("PARTIDAS_REQUERIDAS", "Se requiere al menos una partida para generar el documento destino");
      }

      await client.query("BEGIN");

      const { rows: docRows } = await client.query(
        `SELECT *
           FROM documentos
          WHERE id = $1 AND empresa_id = $2
          FOR SHARE`,
        [documento_origen_id, empresaId]
      );
      const documentoOrigen = docRows[0];
      if (!documentoOrigen) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      const { rowCount: flujoValido } = await client.query(
        `SELECT 1
           FROM core.empresas_tipos_documento_transiciones etd
           JOIN core.tipos_documento td_origen ON td_origen.id = etd.tipo_documento_origen_id
           JOIN core.tipos_documento td_dest   ON td_dest.id   = etd.tipo_documento_destino_id
          WHERE etd.empresa_id = $1
            AND etd.activo = true
            AND LOWER(td_origen.codigo) = LOWER($2)
            AND LOWER(td_dest.codigo) = LOWER($3)
          LIMIT 1`,
        [empresaId, documentoOrigen.tipo_documento, tipo_documento_destino]
      );
      if (!flujoValido) {
        throw new ServiceError("FLUJO_NO_PERMITIDO", "Tipo de documento destino no permitido para este origen", 400);
      }

  const partidaIds = partidas.map((p: GenerarDocumentoPartidaInput) => Number(p.partida_origen_id));
      const { rows: partidasOrigen } = await client.query(
        `SELECT dp.id AS partida_id, dp.*
           FROM documentos_partidas dp
          WHERE dp.documento_id = $1
            AND dp.id = ANY($2::int[])
          ORDER BY dp.numero_partida`,
        [documento_origen_id, partidaIds]
      );

      if (partidasOrigen.length !== partidaIds.length) {
        throw new ServiceError("PARTIDAS_INVALIDAS", "Algunas partidas no pertenecen al documento origen", 400);
      }

      // Determinar serie y número secuencial del documento destino usando la misma lógica que creación estándar
      const serieDestino = datos_encabezado?.serie ?? SERIE_DEFAULTS[tipo_documento_destino] ?? "DOC";
      const camposCotizacion: { estado_seguimiento: string } | null = tipo_documento_destino === "cotizacion"
        ? sanitizarCamposCotizacion({ estado_seguimiento: undefined as string | undefined }, { applyDefaults: true }) as { estado_seguimiento: string }
        : null;
      const { rows: numeroRows } = await client.query(
        `SELECT COALESCE(MAX(numero), 0) + 1 AS next_numero
           FROM documentos
          WHERE empresa_id = $1
            AND LOWER(tipo_documento) = LOWER($2)
            AND COALESCE(serie, '') = COALESCE($3, '')`,
        [empresaId, tipo_documento_destino, serieDestino]
      );
      const nextNumero = numeroRows[0]?.next_numero ?? 1;
      const fechaDocumento = datos_encabezado?.fecha ?? new Date();
      const columnasCotizacion = camposCotizacion ? ",\n            estado_seguimiento" : "";
      const valoresCotizacion = camposCotizacion ? ",\n            $15" : "";

      const { rows: insertDocRows } = await client.query(
        `INSERT INTO documentos (
            empresa_id,
            tipo_documento,
            estatus_documento,
            serie,
            numero,
            fecha_documento,
            contacto_principal_id,
            contacto_facturacion_id,
            contacto_entrega_id,
            agente_id,
            moneda,
            tipo_cambio,
            subtotal,
            iva,
            total,
            observaciones,
            documento_origen_id,
            usuario_creacion_id${columnasCotizacion}
          ) VALUES (
            $1, $2, 'Borrador', $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11,
            0, 0, 0,
            $12,
            $13,
            $14${valoresCotizacion}
          )
          RETURNING *`,
        [
          empresaId,
          tipo_documento_destino,
          serieDestino,
          nextNumero,
          fechaDocumento,
          datos_encabezado?.contacto_principal_id ?? documentoOrigen.contacto_principal_id ?? null,
          documentoOrigen.contacto_facturacion_id ?? null,
          documentoOrigen.contacto_entrega_id ?? null,
          documentoOrigen.agente_id ?? null,
          documentoOrigen.moneda,
          documentoOrigen.tipo_cambio ?? null,
          datos_encabezado?.comentarios ?? documentoOrigen.observaciones ?? null,
          documento_origen_id,
          usuarioId ?? null,
          ...(camposCotizacion ? [camposCotizacion.estado_seguimiento] : []),
        ]
      );

      const documentoDestino = insertDocRows[0];

  const partidasGeneradas: { partida_destino_id: number; partida_origen_id: number; cantidad: number }[] = [];

      for (const [idx, partidaPayload] of partidas.entries()) {
        const partidaOrigen = partidasOrigen.find((p) => Number(p.partida_id) === Number(partidaPayload.partida_origen_id));
        if (!partidaOrigen) {
          throw new ServiceError("PARTIDA_NO_ENCONTRADA", `Partida origen ${partidaPayload.partida_origen_id} no encontrada`, 400);
        }

        const cantidad = Number(partidaPayload.cantidad ?? 0);
        if (cantidad <= 0) {
          throw new ServiceError("CANTIDAD_INVALIDA", "Las cantidades deben ser mayores a cero", 400);
        }

        const precioUnitario = Number(partidaOrigen.precio_unitario ?? 0);
        const subtotalPartida = Number((cantidad * precioUnitario).toFixed(2));

        console.log("[GenDoc] partida base", {
          documento_origen_id,
          documento_destino_id: documentoDestino.id,
          partida_origen_id: partidaOrigen.partida_id,
          cantidad,
          precioUnitario,
          subtotalPartida,
        });

        const { rows: partidaInsertRows } = await client.query(
          `INSERT INTO documentos_partidas (
              documento_id,
              numero_partida,
              producto_id,
              cantidad,
              precio_unitario,
              subtotal_partida,
              total_partida
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
          [
            documentoDestino.id,
            idx + 1,
            partidaOrigen.producto_id ?? null,
            cantidad,
            precioUnitario,
            subtotalPartida,
            0, // total_partida lo calculará calcularImpuestosPartida
          ]
        );

        const partidaDestinoId = partidaInsertRows[0].id as number;
        partidasGeneradas.push({
          partida_destino_id: partidaDestinoId,
          partida_origen_id: Number(partidaOrigen.partida_id),
          cantidad,
        });

        await client.query(
          `INSERT INTO documentos_partidas_vinculos (
              empresa_id,
              documento_origen_id,
              documento_destino_id,
              partida_origen_id,
              partida_destino_id,
              cantidad,
              usuario_creacion_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            empresaId,
            documento_origen_id,
            documentoDestino.id,
            partidaOrigen.partida_id,
            partidaDestinoId,
            cantidad,
            usuarioId ?? null,
          ]
        );

        // Calcular impuestos con el motor nuevo (misma transacción)
        await calcularImpuestosPartida(partidaDestinoId, client);
      }

      // Recalcular totales del documento destino usando los valores actualizados por el motor
      await actualizarTotales(documentoDestino.id, client);

      // Obtener totales ya recalculados para la respuesta
      const { rows: totalesRows } = await client.query(
        `SELECT subtotal, iva, total
           FROM documentos
          WHERE id = $1
          LIMIT 1`,
        [documentoDestino.id]
      );

      const totales = totalesRows[0] || { subtotal: 0, iva: 0, total: 0 };

      console.log("[GenDoc] totales recalculados", {
        documento_destino_id: documentoDestino.id,
        subtotal: Number(totales.subtotal),
        iva: Number(totales.iva),
        total: Number(totales.total),
      });

      if (tipo_documento_destino === "factura") {
        const { rows: oportunidadRows } = await client.query(
          `SELECT id
             FROM crm.oportunidades_venta
            WHERE cotizacion_principal_id = $1
            LIMIT 1`,
          [documento_origen_id]
        );

        const oportunidadId = oportunidadRows[0]?.id;
        if (oportunidadId) {
          await client.query(
            `UPDATE crm.oportunidades_venta
                SET estatus = 'ganada',
                    updated_at = NOW()
              WHERE id = $1`,
            [oportunidadId]
          );
        }
      }

      await client.query("COMMIT");

      return {
        documento_destino_id: Number(documentoDestino.id),
        tipo_documento_destino,
        folio: buildFolio(documentoDestino.serie, documentoDestino.numero),
        subtotal: Number(totales.subtotal ?? 0),
        iva: Number(totales.iva ?? 0),
        total: Number(totales.total ?? 0),
        partidas: partidasGeneradas,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ServiceError) throw error;
      throw new ServiceError("ERROR_GENERICO", (error as Error)?.message ?? "Error al generar documento", 500);
    } finally {
      client.release();
    }
  }
}

export { ServiceError };
