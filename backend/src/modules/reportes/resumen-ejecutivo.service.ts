import OpenAI from 'openai';
import { obtenerCarteraVencida, obtenerPedidosPendientesFacturar, obtenerPosicionTesoreria, obtenerVentasPorPeriodo } from './reportes.repository';

export type ResumenEjecutivoDataset = { schema_version: 'pe-44.v1'; periodo: { inicio: string; fin: string; comparativo: { inicio: string; fin: string; etiqueta: string } }; indicadores: Record<string, Record<string, unknown>> };
export type InterpretacionResumen = { resumen: string[]; focos_atencion: Array<{ texto: string; indicadores: string[] }> };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseDate(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field} debe tener formato YYYY-MM-DD`);
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(`${field} no es una fecha válida`);
  return text;
}
function previousPeriod(inicio: string, _fin: string) {
  const start = new Date(`${inicio}T00:00:00Z`);
  const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const previousEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return { inicio: previousStart.toISOString().slice(0, 10), fin: previousEnd.toISOString().slice(0, 10), etiqueta: `${meses[previousStart.getUTCMonth()]} ${previousStart.getUTCFullYear()}` };
}
function moneyAvailability(values: Array<{ moneda: string; valor: number }>, extra: Record<string, unknown> = {}) {
  const currencies = [...new Set(values.map((v) => v.moneda))];
  if (currencies.length !== 1) return { available: false, reason: currencies.length ? 'Hay varias monedas y no se realiza conversión.' : 'Sin información monetaria.', ...extra };
  return { available: true, valor: values[0]?.valor ?? 0, moneda: currencies[0], ...extra };
}

export async function construirResumenEjecutivo(empresaId: number, fechaInicioInput: unknown, fechaFinInput: unknown): Promise<ResumenEjecutivoDataset> {
  const inicio = parseDate(fechaInicioInput, 'fecha_inicio'), fin = parseDate(fechaFinInput, 'fecha_fin');
  if (inicio > fin) throw new Error('fecha_inicio no puede ser posterior a fecha_fin');
  const comparable = previousPeriod(inicio, fin);
  const [ventas, anteriores, cartera, pendientes, tesoreria] = await Promise.all([
    obtenerVentasPorPeriodo({ empresaId, fechaInicio: inicio, fechaFin: fin, agrupacion: 'mes' }),
    obtenerVentasPorPeriodo({ empresaId, fechaInicio: comparable.inicio, fechaFin: comparable.fin, agrupacion: 'mes' }),
    obtenerCarteraVencida({ empresaId, fechaBase: fin, tipoDocumento: 'factura' }),
    obtenerPedidosPendientesFacturar({ empresaId, fechaInicio: inicio, fechaFin: fin }),
    obtenerPosicionTesoreria(empresaId),
  ]);
  const venta = ventas.periodos.reduce((sum, row) => sum + Number(row.subtotal ?? 0), 0);
  const anterior = anteriores.periodos.reduce((sum, row) => sum + Number(row.subtotal ?? 0), 0);
  const variacion = anterior === 0 ? null : ((venta - anterior) / Math.abs(anterior)) * 100;
  const carteraMoneda = cartera.totales.map((t) => ({ moneda: t.moneda, valor: Number(t.total ?? 0) }));
  const pendiente = pendientes.documentos.reduce((sum, d) => sum + Number(d.total_pendiente ?? 0), 0);
  const tesoreriaMoneda = tesoreria.totales_por_moneda.map((t) => ({ moneda: t.moneda, valor: Number(t.saldo ?? 0) }));
  return { schema_version: 'pe-44.v1', periodo: { inicio, fin, comparativo: comparable }, indicadores: {
    ventas: { available: true, valor: venta, valor_anterior: anterior, variacion_porcentual: variacion, documentos: Number(ventas.kpis.cantidad_documentos ?? 0), ticket_promedio: Number(ventas.kpis.cantidad_documentos ?? 0) > 0 ? venta / Number(ventas.kpis.cantidad_documentos) : 0, moneda: 'MXN' },
    cartera_vencida: moneyAvailability(carteraMoneda, { fecha_corte: fin, antiguedad: carteraMoneda.length === 1 ? { '0_30': Number(cartera.totales[0]?.bucket_0_30 ?? 0), '31_60': Number(cartera.totales[0]?.bucket_31_60 ?? 0), '61_90': Number(cartera.totales[0]?.bucket_61_90 ?? 0), '90_plus': Number(cartera.totales[0]?.bucket_90_plus ?? 0) } : null }),
    pedidos_pendientes_facturar: { available: true, valor: pendiente, documentos: pendientes.documentos.length, moneda: 'MXN' },
    posicion_tesoreria: moneyAvailability(tesoreriaMoneda, { fecha_corte: fin }),
  } };
}

export async function interpretarResumenEjecutivo(dataset: ResumenEjecutivoDataset): Promise<InterpretacionResumen> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');
  const completion = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, max_tokens: 450, messages: [
    { role: 'system', content: 'Eres un analista ejecutivo de negocios. Describe únicamente hechos sustentados por el dataset y utiliza exclusivamente indicadores available=true. Puedes relacionar dos indicadores disponibles, pero no atribuyas causas. No calcules cifras nuevas, no hagas predicciones, no especules sobre sostenibilidad futura, no inventes riesgos y no recomiendes acciones automáticas. No conviertas ausencia de registros en evidencia de eficiencia. No conviertas un indicador parcial en una conclusión sobre toda la empresa. No conviertas un valor cero en una alerta por sí mismo. No uses frases como "requiere atención", "podría limitar" o "indica que el proceso está al día" salvo que exista evidencia explícita en el dataset. Los focos sólo deben existir cuando haya una señal objetivamente sustentada; es válido devolver focos_atencion como []. El dataset incluye periodo.comparativo.etiqueta; si mencionas el comparativo, usa exactamente esa etiqueta. Devuelve únicamente JSON válido con la forma {"resumen":[string],"focos_atencion":[{"texto":string,"indicadores":string[]}]}. Máximo 5 frases y 3 focos. Español claro, ejecutivo y conciso.' },
    { role: 'user', content: JSON.stringify(dataset) },
  ] });
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Respuesta vacía de OpenAI');
  const parsed = JSON.parse(raw) as Partial<InterpretacionResumen>;
  if (!Array.isArray(parsed.resumen) || !Array.isArray(parsed.focos_atencion)) throw new Error('Respuesta inválida de OpenAI');
  const available = new Set(Object.entries(dataset.indicadores).filter(([, value]) => value.available === true).map(([key]) => key));
  return {
    resumen: parsed.resumen.filter((x): x is string => typeof x === 'string').slice(0, 5),
    focos_atencion: parsed.focos_atencion
      .filter((x) => x && typeof x.texto === 'string' && Array.isArray(x.indicadores))
      .filter((x) => x.indicadores.length > 0 && x.indicadores.every((indicator) => available.has(indicator)))
      .slice(0, 3),
  };
}
