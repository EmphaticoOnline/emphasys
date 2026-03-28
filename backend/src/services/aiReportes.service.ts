import OpenAI from "openai";
import pool from "../config/database";

export class SqlValidationError extends Error {}

type ResultadoFila = Record<string, unknown>;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DATA_MODEL_CONTEXT = `Tablas disponibles (PostgreSQL, esquema public):
- public.documentos (alias sugerido d): tabla universal de documentos; las ventas usan tipo_documento = 'factura'. Para el cliente/ contacto usa d.contacto_principal_id → contactos.id. La fecha del documento es d.fecha_documento (usa esta columna en filtros de fechas, no "fecha").
- public.documentos_partidas (alias dp): detalle de productos por documento; llave foránea dp.documento_id → documentos.id.
- public.documentos_partidas_impuestos (alias dpi): impuestos por partida; llave foránea dpi.documento_partida_id → documentos_partidas.id.
- public.contactos (alias c): clientes/proveedores; llave foránea documentos.contacto_principal_id → contactos.id.
- public.productos (alias p): catálogo de productos; llave foránea documentos_partidas.producto_id → productos.id.

Columnas clave disponibles (usa solo estas; evita inventar columnas):
- documentos: id, empresa_id, tipo_documento, estatus_documento, fecha_documento, subtotal, total, contacto_principal_id, estado_seguimiento.
- documentos_partidas: id, documento_id, producto_id, cantidad, subtotal_partida, total_partida.
- documentos_partidas_impuestos: id, documento_partida_id, impuesto_id, tasa, monto, base.
- contactos: id, empresa_id, nombre, rfc.
- productos: id, empresa_id, clave, descripcion, tipo_producto.

Reglas obligatorias:
- SIEMPRE filtra por empresa_id = {{empresa_id}} en todas las consultas.
- Para ventas usa tipo_documento = 'factura'.
- Para montos sin IVA usa la columna subtotal (no total).
- Usa LIMIT 100 siempre.
- Evita SELECT * o table.*; selecciona columnas específicas relevantes.
- Maneja lenguaje de tiempo ambiguo convirtiendo a rangos explícitos con CURRENT_DATE:
  - "este mes": BETWEEN date_trunc('month', CURRENT_DATE) AND CURRENT_DATE
  - "mes pasado": BETWEEN date_trunc('month', CURRENT_DATE - interval '1 month') AND date_trunc('month', CURRENT_DATE) - interval '1 day'
  - "últimos 30 días": BETWEEN CURRENT_DATE - interval '30 days' AND CURRENT_DATE
  - "este año": BETWEEN date_trunc('year', CURRENT_DATE) AND CURRENT_DATE
- SIEMPRE usa BETWEEN para filtros de fecha.
- Prioriza claridad y legibilidad sobre complejidad.
- Devuelve SOLO el SQL listo para ejecutar, sin texto adicional ni markdown.`;

function ensureOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada");
  }
}

export async function generarSQL(pregunta: string, empresa_id: number): Promise<string> {
  ensureOpenAIKey();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    max_tokens: 260,
    messages: [
      {
        role: "system",
        content: DATA_MODEL_CONTEXT.replace("{{empresa_id}}", String(empresa_id)),
      },
      {
        role: "user",
        content: `Pregunta en lenguaje natural: "${pregunta}". Genera una consulta SQL en PostgreSQL que responda la pregunta, solo lectura, respetando todas las reglas y usando empresa_id = ${empresa_id}.` ,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error("No se pudo generar la consulta SQL");
  }

  const sqlSinFences = raw
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim();

  return sqlSinFences.replace(/;\s*$/, "");
}

export function validarSQL(sql: string, empresaId?: number): void {
  const trimmed = sql.trim();
  const normalized = trimmed.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  if (!/^(with\s+[\s\S]+select|select)\b/.test(lower)) {
    throw new SqlValidationError("Solo se permiten consultas SELECT");
  }

  if (/[;](?=.*\S)/.test(trimmed)) {
    throw new SqlValidationError("No se permiten múltiples sentencias en la consulta");
  }

  const forbidden = /(insert|update|delete|drop|alter|truncate|grant|revoke)\b/;
  if (forbidden.test(lower)) {
    throw new SqlValidationError("Operación SQL no permitida");
  }

  if (!/empresa_id\s*=\s*/.test(lower)) {
    throw new SqlValidationError("La consulta debe filtrar por empresa_id");
  }

  if (empresaId !== undefined) {
    const empresaRegex = new RegExp(`empresa_id\\s*=\\s*${empresaId}(?!\\d)`);
    if (!empresaRegex.test(lower)) {
      throw new SqlValidationError("El filtro empresa_id debe usar el valor solicitado");
    }
  }

  const selectStar = /(select\s+distinct\s+\*\b|select\s+\*\b|select\s+distinct\s+[a-z0-9_]+\.\*\b|select\s+[a-z0-9_]+\.\*\b)/;
  if (selectStar.test(lower)) {
    throw new SqlValidationError("No se permite SELECT *; especifica columnas");
  }

  const limitMatch = lower.match(/\blimit\s+(\d+)/);
  if (!limitMatch) {
    throw new SqlValidationError("La consulta debe incluir LIMIT 100");
  }

  const limitValue = Number(limitMatch[1]);
  if (!Number.isFinite(limitValue) || limitValue > 100) {
    throw new SqlValidationError("El límite máximo permitido es 100 filas");
  }
}

export async function ejecutarSQL(sql: string): Promise<ResultadoFila[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 7000");
    await client.query("SET LOCAL transaction_read_only = on");

    const { rows } = await client.query<ResultadoFila>(sql);

    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface Metricas {
  total_general?: number;
  promedio?: number;
  cantidad_registros: number;
  top_cliente?: {
    nombre: string;
    total: number;
    porcentaje: number;
  };
}

export interface InsightEstructurado {
  resumen: string;
  metricas: Metricas;
  hallazgos: string[];
  recomendaciones: string[];
}

function detectarColumnaCliente(resultados: ResultadoFila[]): string | undefined {
  if (!resultados.length) return undefined;
  const keys = Object.keys(resultados[0]);

  const candidatosPrioritarios = [
    "cliente_nombre",
    "nombre_cliente",
    "cliente",
    "cliente_nombre_completo",
  ];

  const matchPrioritario = candidatosPrioritarios.find((k) => keys.includes(k));
  if (matchPrioritario) return matchPrioritario;

  // búsqueda flexible: cualquier columna que contenga "cliente"
  return keys.find((k) => k.toLowerCase().includes("cliente"));
}

function calcularMetricasBasicas(resultados: ResultadoFila[]): Metricas {
  const cantidad_registros = resultados.length;
  const metricas: Metricas = { cantidad_registros };

  if (cantidad_registros === 0) return metricas;

  const hasTotal = resultados.some((r) => typeof r.total === "number");
  const hasSubtotal = resultados.some((r) => typeof r.subtotal === "number");
  const baseKey = hasTotal ? "total" : hasSubtotal ? "subtotal" : undefined;

  if (baseKey) {
    const valoresBase = resultados
      .map((r) => r[baseKey])
      .filter((v): v is number => typeof v === "number");

    if (valoresBase.length) {
      const total_general = valoresBase.reduce((acc, v) => acc + v, 0);
      metricas.total_general = total_general;
      metricas.promedio = total_general / cantidad_registros;

      const colCliente = detectarColumnaCliente(resultados);
      if (colCliente) {
        const acumuladoPorCliente = new Map<string, number>();
        resultados.forEach((r) => {
          const nombre = String(r[colCliente] ?? "").trim();
          const valor = typeof r[baseKey] === "number" ? (r[baseKey] as number) : 0;
          if (!nombre) return;
          acumuladoPorCliente.set(nombre, (acumuladoPorCliente.get(nombre) ?? 0) + valor);
        });

        const top = Array.from(acumuladoPorCliente.entries()).sort((a, b) => b[1] - a[1])[0];
        if (top && metricas.total_general && metricas.total_general > 0) {
          metricas.top_cliente = {
            nombre: top[0],
            total: top[1],
            porcentaje: (top[1] / metricas.total_general) * 100,
          };
        }
      }
    }
  }

  return metricas;
}

function construirResumen(metricas: Metricas): string {
  if (metricas.total_general !== undefined && metricas.total_general !== null) {
    const base = `Se generaron ${metricas.total_general.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en ${metricas.cantidad_registros} operaciones.`;
    if (metricas.top_cliente) {
      const pct = metricas.top_cliente.porcentaje.toFixed(1);
      return `${base} El cliente principal (${metricas.top_cliente.nombre}) representa el ${pct}% del total.`;
    }
    return base;
  }

  return `Se obtuvieron ${metricas.cantidad_registros} registros. No hay montos para calcular totales.`;
}

export async function generarInsightEstructurado(resultados: ResultadoFila[], pregunta: string): Promise<InsightEstructurado> {
  ensureOpenAIKey();

  const muestra = resultados.slice(0, 20);
  const metricas = calcularMetricasBasicas(resultados);
  const resumenBase = construirResumen(metricas);

  const systemPrompt =
    "Actúa como un consultor de negocio.\n" +
    "Analiza los datos y responde en JSON con:\n" +
    "{\n" +
    "  resumen: string,\n" +
    "  hallazgos: string[],\n" +
    "  recomendaciones: string[]\n" +
    "}\n\n" +
    "Reglas:\n" +
    "- Sé claro y directo.\n" +
    "- No repitas datos innecesarios.\n" +
    "- Máximo 3 hallazgos.\n" +
    "- Máximo 3 recomendaciones.\n" +
    "- Enfócate en decisiones, no descripción.\n" +
    "- Español neutro.\n" +
    "- NO incluyas métricas de máximo ni mínimo a menos que se trate de fechas relevantes.\n" +
    "- Usa el resumen base como referencia si ayuda.\n" +
    "- Responde SOLO con JSON válido.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({ pregunta, resultados: muestra, metricas, resumen_base: resumenBase }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Respuesta vacía de OpenAI");
    }

    const parsed = JSON.parse(content) as Partial<InsightEstructurado>;

    return {
      resumen: parsed.resumen || resumenBase,
      metricas,
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos.slice(0, 3) : [],
      recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones.slice(0, 3) : [],
    };
  } catch (_error) {
    // Fallback en caso de error de IA o parseo
    return {
      resumen: resumenBase,
      metricas,
      hallazgos: [],
      recomendaciones: [],
    };
  }
}