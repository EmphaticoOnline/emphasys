import path from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import axios from 'axios';
import pool from '../../config/database';
import { generarImagenQR, DatosQrCfdi } from '../../utils/generarCadenaQR';
import { formatearFolioDocumento } from '../../utils/documentos';
import { DOCUMENT_LAYOUTS, type DocumentLayout } from '../../config/document-layouts';
import { obtenerPlantillaParaDocumento } from '../plantillas/plantillas.service';
import { renderPlantillaHTML, type PlantillaData } from '../plantillas/plantillas.render.service';
import puppeteer from 'puppeteer';

type TimbreCfdi = {
  uuid?: string | null;
  fecha_timbrado?: string | Date | null;
  rfc_emisor?: string | null;
  rfc_receptor?: string | null;
  total?: number | null;
  sello_cfdi?: string | null;
  cadena_original?: string | null;
  sello_sat?: string | null;
  rfc_proveedor_certificacion?: string | null;
  no_certificado_sat?: string | null;
};

type DocumentoCotizacion = {
  id?: number;
  tipo_documento?: string | null;
  serie?: string | null;
  numero?: number | null;
  fecha_documento?: string | null;
  cliente_nombre?: string | null;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  cliente_rfc?: string | null;
  rfc_receptor?: string | null;
  cliente_direccion?: string | null;
  uso_cfdi?: string | null;
  regimen_fiscal_receptor?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  nombre_receptor?: string | null;
  observaciones?: string | null;
  total?: number | null;
  subtotal?: number | null;
  iva?: number | null;
  timbre?: TimbreCfdi | null;
};

type PartidaCotizacion = {
  producto_clave?: string | null;
  descripcion_alterna?: string | null;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  observaciones?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
};

type DataCotizacion = {
  documento?: DocumentoCotizacion;
  partidas: PartidaCotizacion[];
};

type EmpresaPdfInfo = {
  nombre: string | null;
  direccion: string | null;
  direccionLineas: string[];
  telefono: string | null;
  email: string | null;
};

const formatCurrency = (value?: number | null) => {
  const num = Number(value ?? 0);
  return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX');
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (match) return match[1]; // ya viene en formato ISO CFDI
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const getAppBaseUrl = () => {
  const rawBaseUrl = process.env.APP_BASE_URL?.trim();
  if (rawBaseUrl) return rawBaseUrl.replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3001';
  return null;
};

const resolvePublicUrl = (value?: string | null) => {
  const rawValue = (value ?? '').trim();
  if (!rawValue) return null;
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}${rawValue.startsWith('/') ? '' : '/'}${rawValue}`;
};

async function getProductoArchivoUrl(productoArchivoId?: number | null, empresaId?: number) {
  if (!productoArchivoId || !empresaId) return null;

  const { rows } = await pool.query<{ archivo: string | null }>(
    `SELECT pa.archivo
       FROM productos_archivos pa
       INNER JOIN productos p ON p.id = pa.producto_id
      WHERE pa.id = $1
        AND p.empresa_id = $2
      LIMIT 1`,
    [productoArchivoId, empresaId]
  );

  return resolvePublicUrl(rows?.[0]?.archivo ?? null);
};

const mapRegimen = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    '616': 'Sin obligaciones fiscales',
  };
  return code ? map[code] || code : 'N/D';
};

const mapFormaPago = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    '01': 'Efectivo',
  };
  return code ? map[code] || code : 'N/D';
};

const mapMetodoPago = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    PUE: 'Pago en una sola exhibición',
  };
  return code ? map[code] || code : 'N/D';
};

const mapUsoCfdi = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    G01: 'Adquisición de mercancías',
    G03: 'Gastos en general',
    P01: 'Por definir',
    S01: 'Sin efectos fiscales',
  };
  return code ? map[code] || code : 'N/D';
};

const normalizarColorHex = (color?: string | null): string | undefined => {
  if (!color) return undefined;
  const value = color.trim();
  const match = value.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!match) return undefined;
  return `#${match[1]}`;
};

const tituloPorTipo = (tipo: string | null | undefined) => {
  const t = (tipo || '').toString().toLowerCase();
  if (t === 'factura') return 'FACTURA';
  if (t === 'orden_servicio') return 'ORDEN DE SERVICIO';
  if (t === 'pedido') return 'PEDIDO';
  if (t === 'remision') return 'REMISIÓN';
  return 'COTIZACIÓN';
};

// Conversión simple de número a letras (MXN) para mostrar monto en texto.
const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const decenas = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const decenasTys = ['veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const centenas = ['cien', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

const numeroALetras = (num: number): string => {
  if (!Number.isFinite(num)) return '';
  const entero = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - entero) * 100);

  const seccion = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return unidades[n];
    if (n < 20) return decenas[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const r = n % 10;
      return decenasTys[d - 2] + (r ? ' y ' + unidades[r] : '');
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      const pref = c === 1 && r === 0 ? centenas[0] : (c === 1 ? centenas[1] : centenas[c]);
      return pref + (r ? ' ' + seccion(r) : '');
    }
    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const r = n % 1000;
      const milesTxt = miles === 1 ? 'mil' : seccion(miles) + ' mil';
      return milesTxt + (r ? ' ' + seccion(r) : '');
    }
    const millones = Math.floor(n / 1000000);
    const r = n % 1000000;
    const millonesTxt = millones === 1 ? 'un millón' : seccion(millones) + ' millones';
    return millonesTxt + (r ? ' ' + seccion(r) : '');
  };

  const letras = seccion(entero) || 'cero';
  const centavosTxt = centavos.toString().padStart(2, '0');
  return `${letras.toUpperCase()} PESOS ${centavosTxt}/100 MXN`;
};

async function obtenerLogoEmpresaPath(empresaId?: number): Promise<string | null> {
  if (!empresaId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT ruta
         FROM core.empresas_assets
        WHERE empresa_id = $1 AND tipo = 'logo_default' AND activo = true
        ORDER BY created_at DESC
        LIMIT 1`,
      [empresaId]
    );
    const ruta = rows?.[0]?.ruta as string | undefined;
    if (!ruta) {
      try {
        const dbInfo = await pool.query<{ db: string }>('SELECT current_database() AS db');
        console.warn('[pdf] Logo no encontrado en BD', {
          rowCount: rows?.length ?? 0,
          dbEnv: process.env.DB_NAME,
          currentDb: dbInfo.rows?.[0]?.db,
        });
      } catch (err) {
        console.warn('[pdf] No se pudo obtener la BD actual al buscar logo', err);
      }
      return null;
    }

    // La ruta almacenada viene como /uploads/empresas/...; resolvemos a disco
    const normalizedRuta = ruta.replace(/\\/g, '/');
    if (path.isAbsolute(normalizedRuta) && !normalizedRuta.startsWith('/uploads/')) {
      return fs.existsSync(normalizedRuta) ? normalizedRuta : null;
    }

    const backendUploadsRoot = path.resolve(__dirname, '..', '..', '..', 'uploads');
    const uploadsRootCandidates = [
      process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : null,
      path.resolve(process.cwd(), 'uploads'),
      backendUploadsRoot,
      path.resolve(__dirname, '..', '..', '..', '..', 'uploads'),
    ].filter((candidate): candidate is string => Boolean(candidate));

  const relative = normalizedRuta.replace(/^\/?uploads\/?/i, '');
    for (const root of uploadsRootCandidates) {
      const absPath = path.join(root, relative);
      if (fs.existsSync(absPath)) return absPath;
    }

    console.warn('[pdf] Logo no encontrado en rutas esperadas', {
      empresaId,
      ruta,
      uploadsRootCandidates,
    });
    return null;
  } catch (error) {
    console.warn('[pdf] No se pudo obtener logo de empresa', error);
    return null;
  }
}

async function obtenerEmpresaPdfInfo(empresaId?: number): Promise<EmpresaPdfInfo | null> {
  if (!empresaId) return null;

  try {
    const { rows } = await pool.query<{
      nombre: string | null;
      razon_social: string | null;
      calle: string | null;
      numero_exterior: string | null;
      numero_interior: string | null;
      colonia: string | null;
      localidad: string | null;
      estado: string | null;
      codigo_postal: string | null;
      pais: string | null;
      telefono: string | null;
      email: string | null;
    }>(
      `SELECT
         NULLIF(TRIM(COALESCE(e.nombre, '')), '') AS nombre,
         NULLIF(TRIM(COALESCE(e.razon_social, '')), '') AS razon_social,
         NULLIF(TRIM(COALESCE(e.calle, '')), '') AS calle,
         NULLIF(TRIM(COALESCE(e.numero_exterior, '')), '') AS numero_exterior,
         NULLIF(TRIM(COALESCE(e.numero_interior, '')), '') AS numero_interior,
         NULLIF(TRIM(col.texto), '') AS colonia,
         NULLIF(TRIM(loc.texto), '') AS localidad,
         NULLIF(TRIM(est.texto), '') AS estado,
         NULLIF(TRIM(COALESCE(e.codigo_postal, e.codigo_postal_id, '')), '') AS codigo_postal,
         NULLIF(TRIM(COALESCE(e.pais, '')), '') AS pais,
         NULLIF(TRIM(COALESCE(e.telefono, '')), '') AS telefono,
         NULLIF(TRIM(COALESCE(e.email, '')), '') AS email
       FROM core.empresas e
       LEFT JOIN sat.colonias col
         ON col.codigo_postal = e.codigo_postal_id
        AND col.colonia = e.colonia_id
       LEFT JOIN sat.localidades loc
         ON loc.estado = e.estado_id
        AND loc.localidad = e.localidad_id
       LEFT JOIN sat.estados est
         ON est.estado = e.estado_id
      WHERE e.id = $1
      LIMIT 1`,
      [empresaId]
    );

    const row = rows[0];
    if (!row) return null;

    const direccionLineas = [
      [row.calle, row.numero_exterior, row.numero_interior].filter(Boolean).join(' ').trim() || null,
      row.colonia,
      [row.localidad, row.estado].filter(Boolean).join(', ').trim() || null,
      [row.codigo_postal ? `C.P. ${row.codigo_postal}` : null, row.pais].filter(Boolean).join(', ').trim() || null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    const direccion = direccionLineas.join(', ');

    return {
      nombre: row.nombre ?? row.razon_social ?? null,
      direccion: direccion || null,
      direccionLineas,
      telefono: row.telefono ?? null,
      email: row.email ?? null,
    };
  } catch (error) {
    console.warn('[pdf] No se pudo obtener información de empresa para PDF', {
      empresaId,
      error: (error as Error)?.message ?? error,
    });
    return null;
  }
}

const obtenerLayoutFallback = (tipoDocumento?: string | null): DocumentLayout => {
  const tipo = (tipoDocumento ?? '').toString().toLowerCase();
  return (
    DOCUMENT_LAYOUTS[tipo as keyof typeof DOCUMENT_LAYOUTS] ?? {
      mostrarHeader: true,
      mostrarCliente: true,
      mostrarPartidas: true,
      mostrarTotales: true,
    }
  );
};

async function getDocumentLayout(documento?: any, empresaIdFallback?: number): Promise<DocumentLayout> {
  const tipoDocumento = (documento?.tipo_documento ?? '').toString().toLowerCase();
  const baseLayout = obtenerLayoutFallback(tipoDocumento);
  const serieTexto = (documento?.serie ?? null) as string | null;
  const empresaId = (documento?.empresa_id ?? empresaIdFallback ?? null) as number | null;

  try {
    if (empresaId && tipoDocumento && serieTexto) {
      const { rows } = await pool.query(
        `SELECT sd.layout_id, pd.configuracion
           FROM public.series_documento sd
      LEFT JOIN public.plantillas_documento pd ON pd.id = sd.layout_id
          WHERE sd.empresa_id = $1
            AND sd.tipo_documento = $2
            AND sd.serie = $3
          LIMIT 1`,
        [empresaId, tipoDocumento, serieTexto]
      );

      const serieRow = rows?.[0];
      if (serieRow?.layout_id && serieRow?.configuracion && typeof serieRow.configuracion === 'object') {
        return { ...baseLayout, ...serieRow.configuracion };
      }
    }

    if (empresaId) {
      const { rows } = await pool.query(
        `SELECT configuracion
           FROM public.plantillas_documento
          WHERE empresa_id = $1
            AND activo = true
            AND (tipo_documento IS NULL OR tipo_documento = $2)
       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1`,
        [empresaId, tipoDocumento || null]
      );

      const empresaRow = rows?.[0];
      if (empresaRow?.configuracion && typeof empresaRow.configuracion === 'object') {
        return { ...baseLayout, ...empresaRow.configuracion };
      }
    }
  } catch (error) {
    console.warn('[pdf] Error al obtener layout dinámico, usando fallback', {
      documentoId: documento?.id ?? null,
      serieTexto,
      empresaId,
      error: (error as Error)?.message ?? error,
    });
  }

  return baseLayout;
}

async function generarPDFFromHTML(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    await page.close();
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generarDocumentoPDF(data: DataCotizacion, empresaId?: number): Promise<Buffer> {
  const { documento, partidas } = data;
  const timbre = documento?.timbre;
  const usarPlantillas = false;

  try {
    console.log('DOCUMENTO:', documento?.id, (documento as any)?.empresa_id, documento?.tipo_documento);
    console.log('Buscando plantilla con:', {
      empresa_id: (documento as any)?.empresa_id ?? empresaId ?? null,
      tipo_documento: documento?.tipo_documento ?? null,
    });
    const plantilla = await obtenerPlantillaParaDocumento({
      empresa_id: (documento as any)?.empresa_id ?? empresaId ?? null,
      tipo_documento: documento?.tipo_documento ?? null,
    });
    console.log('PLANTILLA ENCONTRADA:', plantilla);

    if (usarPlantillas && plantilla) {
      try {
        const folio = formatearFolioDocumento(documento?.serie ?? '', Number(documento?.numero ?? 0));
        const plantillaData: PlantillaData = {
          empresa: {
            nombre: (documento as any)?.empresa_nombre ?? null,
            rfc: (documento as any)?.empresa_rfc ?? timbre?.rfc_emisor ?? null,
            direccion: (documento as any)?.empresa_direccion ?? null,
          },
          cliente: {
            nombre: documento?.nombre_receptor ?? documento?.cliente_nombre ?? null,
            rfc: documento?.rfc_receptor ?? documento?.cliente_rfc ?? null,
          },
          documento: {
            folio,
            fecha: documento?.fecha_documento ?? null,
            tipo_documento: documento?.tipo_documento ?? null,
            total: documento?.total ?? null,
            subtotal: documento?.subtotal ?? null,
          },
          partidas: (partidas ?? []).map((partida) => ({
            descripcion: partida.descripcion_alterna ?? null,
            cantidad: partida.cantidad ?? null,
            precio: partida.precio_unitario ?? null,
            importe: partida.subtotal_partida ?? null,
          })),
        };

        const html = renderPlantillaHTML(plantilla.contenido_html, plantillaData);
        console.info('[pdf] Plantilla HTML renderizada', {
          documentoId: documento?.id,
          tipoDocumento: documento?.tipo_documento,
          plantillaId: plantilla.id,
        });

        return await generarPDFFromHTML(html);
      } catch (plantillaError) {
        console.warn('[pdf] Error al renderizar plantilla HTML; usando formato clásico.', {
          documentoId: documento?.id,
          tipoDocumento: documento?.tipo_documento,
          plantillaId: plantilla.id,
          error: (plantillaError as Error)?.message,
        });
      }
    }


  let qrBuffer: Buffer | null = null;
  const estaTimbrado = !!timbre?.uuid;
  const tipoDocumentoNormalizado = (documento?.tipo_documento ?? '').toString().toLowerCase();
  const esCotizacion = tipoDocumentoNormalizado === 'cotizacion';
  const esOrdenServicio = tipoDocumentoNormalizado === 'orden_servicio';
  const partidasConMontos = (partidas ?? []).map((partida) => {
    const cantidad = Number(partida.cantidad ?? 0);
    const precioUnitario = Number(partida.precio_unitario ?? 0);
    const subtotalNeto = Number(partida.subtotal_partida ?? 0);
    const subtotalBruto = cantidad * precioUnitario;
    const descuento = Math.max(0, subtotalBruto - subtotalNeto);

    return {
      ...partida,
      subtotalBruto,
      subtotalNeto,
      descuento,
    };
  });
  const subtotalBrutoDocumento = partidasConMontos.reduce((acc, partida) => acc + partida.subtotalBruto, 0);
  const subtotalNetoDocumento = Number(documento?.subtotal ?? partidasConMontos.reduce((acc, partida) => acc + partida.subtotalNeto, 0));
  const descuentoTotalDocumento = Math.max(0, subtotalBrutoDocumento - subtotalNetoDocumento);
  if (estaTimbrado) {
    const qrDatos: DatosQrCfdi = {
      uuid: timbre?.uuid || '',
      rfc_emisor: timbre?.rfc_emisor || documento?.cliente_rfc || '',
      rfc_receptor: timbre?.rfc_receptor || documento?.rfc_receptor || '',
      total: Number(timbre?.total ?? documento?.total ?? 0),
      sello_cfdi: timbre?.sello_cfdi || '',
    };

    try {
      const qrDataUrl = await generarImagenQR(qrDatos);
      const base64 = qrDataUrl.split(',')[1] || '';
      qrBuffer = Buffer.from(base64, 'base64');
    } catch (err) {
      console.error('[pdf] No se pudo generar imagen QR:', err);
    }
  }
  const contentWidth = 595.28 - 2 * 50; // A4 width minus default margins (approx)
  const primaryColor = '#1d2f68';
  const textColor = '#111827';
  const mutedText = '#374151';
  const borderGray = '#e5e7eb';

  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const defaultLogoPath = path.resolve(backendRoot, '..', 'frontend', 'public', 'logos', 'logo-emphasys.jpg');
  console.log('[PDF DEBUG LOGO]', {
    empresaIdContexto: empresaId,
    empresaIdDocumento: (documento as any)?.empresa_id,
    empresaUsada: (documento as any)?.empresa_id ?? empresaId,
  });
  const empresaLogoPath = await obtenerLogoEmpresaPath((documento as any)?.empresa_id ?? empresaId);
  const empresaInfo = await obtenerEmpresaPdfInfo((documento as any)?.empresa_id ?? empresaId);
  const logoPath = empresaLogoPath && fs.existsSync(empresaLogoPath) ? empresaLogoPath : defaultLogoPath;
  const hasLogo = fs.existsSync(logoPath);
  console.info('[pdf] Logo resuelto', {
    empresaId: empresaId ?? (documento as any)?.empresa_id,
    empresaLogoPath,
    logoPath,
    hasLogo,
  });
  const assetsFontsPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts');
  const repoFontsPath = path.resolve(__dirname, '..', '..', '..', '..', 'fonts');

  const fontRegularPath = path.join(assetsFontsPath, 'Trebuchet.ttf');
  const fontBoldPath = path.join(assetsFontsPath, 'Trebuchet-Bold.ttf');
  const fontItalicPath = path.join(assetsFontsPath, 'Trebuchet-Italic.ttf');

  const layout = await getDocumentLayout(documento, empresaId);

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

    let hasTrebuchet = false;
    let hasTrebuchetBold = false;
    let hasTrebuchetItalic = false;

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const registerFontIfExists = (fontName: string, filePath: string) => {
      const exists = fs.existsSync(filePath);
      console.log('[FONT CHECK]', {
        font: fontName,
        path: filePath,
        exists,
      });
      if (!exists) {
        console.warn('[FONT MISSING]', {
          font: fontName,
          path: filePath,
        });
        return false;
      }
      console.log('[FONT REGISTER PATH]', {
        font: fontName,
        path: filePath,
      });
      doc.registerFont(fontName, filePath);
      console.log('[FONT REGISTERED]', fontName);
      return true;
    };

    // Registrar fuentes embebidas (preferidas)
    hasTrebuchet = registerFontIfExists('Trebuchet', fontRegularPath);
    hasTrebuchetBold = registerFontIfExists('Trebuchet-Bold', fontBoldPath);
    hasTrebuchetItalic = registerFontIfExists('Trebuchet-Italic', fontItalicPath);

    // Fallback a fuentes del repo (compatibilidad actual)
    if (!hasTrebuchet || !hasTrebuchetBold || !hasTrebuchetItalic) {
      const fallbackRegular = path.join(repoFontsPath, 'TREBUC.ttf');
      const fallbackBold = path.join(repoFontsPath, 'TREBUCBD.ttf');
      const fallbackItalic = path.join(repoFontsPath, 'TREBUCIT.ttf');
      hasTrebuchet = hasTrebuchet || registerFontIfExists('Trebuchet', fallbackRegular);
      hasTrebuchetBold = hasTrebuchetBold || registerFontIfExists('Trebuchet-Bold', fallbackBold);
      hasTrebuchetItalic = hasTrebuchetItalic || registerFontIfExists('Trebuchet-Italic', fallbackItalic);
    }
    doc.font(hasTrebuchet ? 'Trebuchet' : 'Helvetica');

    const setFont = (bold = false, size = 10, color = '#111827') => {
      const fontName = bold ? (hasTrebuchetBold ? 'Trebuchet-Bold' : 'Helvetica-Bold') : hasTrebuchet ? 'Trebuchet' : 'Helvetica';
      doc.font(fontName);
      doc.fontSize(size).fillColor(color);
    };

    const drawSectionHeader = (title: string) => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, contentWidth, 18).fill('#f2f2f2');
      setFont(true, 10, textColor);
      doc.text(title.toUpperCase(), doc.page.margins.left + 8, y + 4, { width: contentWidth - 16 });
      doc.y = y + 22;
      doc.fillColor(textColor);
    };

    const startX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidths = [
      84, // Producto (se mantiene)
      tableWidth - (84 + 58 + 76 + 68 + 68), // Descripción absorbe espacio extra
      58, // Cantidad
      76, // Precio unitario
      68, // Desc.
      68, // Importe (alineado a margen derecho)
    ];
    const headers = ['Producto', 'Descripción', 'Cantidad', 'Precio unitario', 'Desc.', 'Importe'];

    const renderHeader = () => {
      // Encabezado clásico CFDI
      const headerTop = doc.y;
      const headerHeight = esOrdenServicio ? 82 : 122;
      const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Logo (mismo espacio que antes, escalado con proporción dentro de un cuadro fijo)
      const logoMaxHeight = esOrdenServicio ? 54 : headerHeight * 0.7;
      const logoMaxWidth = 200; // ancho máximo permitido sin cambiar layout
      if (hasLogo && layout.mostrarLogo !== false) {
        doc.image(logoPath, doc.page.margins.left, headerTop, {
          fit: [logoMaxWidth, logoMaxHeight],
        });
      }

      const folio = formatearFolioDocumento(documento?.serie ?? '', Number(documento?.numero ?? 0));
      const fechaTimbrado = documento?.timbre?.fecha_timbrado ? formatDateTime(documento.timbre.fecha_timbrado) : 'N/D';
      const uuid = documento?.timbre?.uuid || 'N/D';
      const fechaEmision = formatDate(documento?.fecha_documento) || 'N/D';
  const tipoComp = tituloPorTipo(documento?.tipo_documento);
  const tituloLayout = layout.titulo ?? tipoComp;
  const colorPrimarioLayout = normalizarColorHex(layout.colorPrimario) ?? primaryColor;
      const titleFontSize = esOrdenServicio ? 10 : 13;
      const titleGapBottom = esOrdenServicio ? 1 : 4;
      const boxRowHeight = esOrdenServicio ? 10 : 12;

      // Caja gris a la derecha
      const boxW = esOrdenServicio ? 272 : 240;
      const boxX = doc.page.width - doc.page.margins.right - boxW;
      const boxY = headerTop;

      // Título centrado en el recuadro gris
      setFont(true, titleFontSize, colorPrimarioLayout);
      const titleHeight = doc.heightOfString(tituloLayout, { width: boxW });
      const titleY = boxY + (esOrdenServicio ? 5 : 8); // encabezado alto, centrado solo horizontalmente

      const boxData: Array<[string, string]> = [
        ['Folio', folio || 'N/D'],
        ['Fecha elaboración', fechaEmision],
      ];
      if (!esCotizacion && estaTimbrado) {
        boxData.push(
          ['Fecha timbrado', fechaTimbrado],
          ['Método Pago', mapMetodoPago(documento?.metodo_pago)],
          ['Forma Pago', mapFormaPago(documento?.forma_pago)],
          ['Uso CFDI', mapUsoCfdi(documento?.uso_cfdi)]
        );
      }

      let cursorY = titleY + titleHeight + titleGapBottom; // datos inmediatamente debajo del encabezado dentro del recuadro (ligeramente más arriba)

      if (estaTimbrado) {
        // UUID centrado, independiente de columnas
        cursorY += boxRowHeight;
      }

      const boxContentBottom = cursorY + boxData.length * boxRowHeight;
      const boxH = esCotizacion
        ? boxContentBottom - boxY + 8
        : esOrdenServicio
          ? 54
          : headerHeight;

      doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#eeeeee');
      doc.fillColor('#111827');

      setFont(true, titleFontSize, colorPrimarioLayout);
      doc.text(tituloLayout, boxX, titleY, { width: boxW, align: 'center' });
      if (estaTimbrado) {
        // UUID centrado, independiente de columnas
        setFont(true, 9, '#111827');
        doc.text(uuid, boxX, cursorY, { width: boxW, align: 'center' });
        cursorY += boxRowHeight;
      }

      // Columnas para etiquetas y valores
      const labelColWidth = esOrdenServicio ? 110 : 88;
      const gapCols = esOrdenServicio ? 4 : 8;
      const valueColWidth = boxW - 24 - labelColWidth - gapCols;
      const labelX = boxX + 12;
      const valueX = labelX + labelColWidth + gapCols;

      boxData.forEach(([label, value]) => {
        setFont(false, esOrdenServicio ? 8 : 9, '#111827');
        doc.text(label + ':', labelX, cursorY, { width: labelColWidth, align: 'right', lineBreak: false });
        doc.text(value, valueX, cursorY, { width: valueColWidth, align: 'left', lineBreak: false });
        cursorY += boxRowHeight;
      });

      const headerBottom = esCotizacion
        ? headerTop + boxH
        : esOrdenServicio
          ? Math.max(headerTop + boxH, headerTop + logoMaxHeight)
          : headerTop + headerHeight;
      doc.y = Math.max(headerBottom, cursorY) + (esOrdenServicio ? 4 : 10);
      if (esCotizacion || esOrdenServicio) {
        const logoBottom = headerTop + logoMaxHeight;
        const lineGapTop = esOrdenServicio ? 4 : 18;
        const lineGapBottom = esOrdenServicio ? 4 : 14;
        const lineY = Math.max(logoBottom, boxY + boxH) + lineGapTop;
        doc
          .moveTo(doc.page.margins.left, lineY)
          .lineTo(doc.page.width - doc.page.margins.right, lineY)
          .strokeColor('#cccccc')
          .stroke();
        doc.y = lineY + lineGapBottom;
      } else {
        // Línea divisoria (ligeramente por encima de Emisor)
        const lineY = doc.y + 2; // bajar ~12 pts respecto al ajuste anterior
        doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor('#cccccc').stroke();
        doc.moveDown(0.6);
      }
    };

    const renderCliente = () => {
      // Bloque Emisor / Receptor
      const colWidth = (contentWidth - 12) / 2;
      const bloqueY = doc.y;
      if (esOrdenServicio) {
        const labelWidth = 62;
        const rowGap = 4;
        const sectionGap = 12;
        const emisorX = doc.page.margins.left;
        const receptorX = doc.page.margins.left + colWidth + sectionGap;
        const valueGap = 6;
        const valueWidth = colWidth - labelWidth - valueGap;
        const emisorDomicilioLineas = empresaInfo?.direccionLineas?.length
          ? empresaInfo.direccionLineas
          : ((documento as any)?.empresa_direccion
              ? String((documento as any).empresa_direccion)
                  .split(',')
                  .map((chunk: string) => chunk.trim())
                  .filter(Boolean)
              : []);
        const receptorRowsBase: Array<[string, string | null]> = [
          ['Nombre', documento?.nombre_receptor || documento?.cliente_nombre || null],
          ['Teléfono', documento?.cliente_telefono ?? null],
          ['Correo', documento?.cliente_email ?? null],
        ];
        const receptorRows = receptorRowsBase.filter(([, value]) => Boolean(value));

        let emisorY = bloqueY;
        if (emisorDomicilioLineas.length > 0) {
          setFont(false, 9.5, textColor);
          emisorDomicilioLineas.forEach((linea) => {
            doc.text(linea, emisorX, emisorY, {
              width: colWidth - 8,
              align: 'left',
              lineBreak: false,
            });
            emisorY += 12;
          });
        }

        const drawCompactRows = (title: string, rows: Array<[string, string | null]>, startX: number) => {
          let currentY = bloqueY;
          setFont(true, 10, primaryColor);
          doc.text(title, startX, currentY, { width: colWidth });
          currentY += 16;

          rows.forEach(([label, value]) => {
            const safeValue = value ?? '';
            setFont(true, 8, textColor);
            doc.text(`${label}:`, startX, currentY, { width: labelWidth, align: 'right', lineBreak: false });
            setFont(false, 8, mutedText);
            const textHeight = doc.heightOfString(safeValue, { width: valueWidth });
            doc.text(safeValue, startX + labelWidth + valueGap, currentY, { width: valueWidth, align: 'left' });
            currentY += Math.max(10, textHeight) + rowGap;
          });

          return currentY;
        };

        const receptorY = drawCompactRows('Datos del cliente', receptorRows, receptorX);
        doc.y = Math.max(emisorY, receptorY) + 4;
        return;
      }

      const drawLabelValue = (label: string, value: string | null | undefined, x: number, y: number) => {
        const textValue = value || 'N/D';
        setFont(false, 9, textColor);
        const h = doc.heightOfString(`${label}: ${textValue}`, { width: colWidth });
        doc.text(`${label}: ${textValue}`, x, y, { width: colWidth });
        return h + 4;
      };

      if (esCotizacion) {
        const clienteNombre = documento?.nombre_receptor || documento?.cliente_nombre || 'Cliente';
        const clienteRfc = documento?.cliente_rfc || documento?.rfc_receptor || null;
        const clienteDireccion = documento?.cliente_direccion || null;
  const indent = 24;
  const lineHeight = 12;
  const labelColWidth = 80;
  const gapCols = 8;
  const labelX = doc.page.margins.left;
  const valueX = labelX + labelColWidth + gapCols;
  const valueWidth = contentWidth - labelColWidth - gapCols;
        const blockHeight = lineHeight * 3;
        const tableGap = 12;
        let currentY = bloqueY;

  setFont(false, 10, '#000000');
  doc.text('Atención:', labelX, currentY, { width: labelColWidth, align: 'right' });
  doc.text(clienteNombre, valueX, currentY, { width: valueWidth, align: 'left' });
        currentY += lineHeight;

        setFont(false, 9, textColor);
        if (clienteRfc) {
          doc.text(`RFC: ${clienteRfc}`, doc.page.margins.left + indent, currentY, { width: contentWidth - indent });
        }
        currentY += lineHeight;

        if (clienteDireccion) {
          setFont(false, 10, '#000000');
          doc.text('Domicilio:', labelX, currentY, { width: labelColWidth, align: 'right' });
          doc.text(clienteDireccion, valueX, currentY, { width: valueWidth, align: 'left' });
        }
        currentY = bloqueY + blockHeight;

        doc.y = currentY + tableGap;
        return;
      }

      setFont(true, 11, primaryColor);
      doc.text('Emisor', doc.page.margins.left, bloqueY, { width: colWidth });
      doc.text('Receptor', doc.page.margins.left + colWidth + 12, bloqueY, { width: colWidth });

      let emisorY = bloqueY + 14;
      emisorY += drawLabelValue('Nombre', 'Emphasys', doc.page.margins.left, emisorY);
      emisorY += drawLabelValue('RFC', documento?.cliente_rfc || documento?.rfc_receptor || 'N/D', doc.page.margins.left, emisorY);
      emisorY += drawLabelValue('Régimen Fiscal', mapRegimen(documento?.regimen_fiscal_receptor), doc.page.margins.left, emisorY);

      let receptorY = bloqueY + 14;
      receptorY += drawLabelValue('Nombre', documento?.nombre_receptor || documento?.cliente_nombre, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('RFC', documento?.rfc_receptor || documento?.cliente_rfc, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('Domicilio Fiscal', documento?.codigo_postal_receptor, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('Régimen Fiscal', mapRegimen(documento?.regimen_fiscal_receptor), doc.page.margins.left + colWidth + 12, receptorY);

      doc.y = Math.max(emisorY, receptorY) + 6;
      doc.moveDown(0.4);
    };

    const renderPartidas = async () => {
      // Tabla de partidas (sin título "Partidas")
      const descripcionIndex = 1;
      const layoutWithImageConfig = layout as DocumentLayout & { maxAnchoImagenPartida?: number | null };
      const showObservaciones = (esCotizacion || esOrdenServicio) && layout.mostrarObservacionesPartida !== false;
      const showImagenPartida = layout.mostrarImagenPartida === true;
      const rawImagenPartidaHeight = Number(layout.altoImagenPartida ?? 60);
      const imagenPartidaHeight = Number.isFinite(rawImagenPartidaHeight) && rawImagenPartidaHeight > 0
        ? rawImagenPartidaHeight
        : 60;
      const rawMaxAnchoImagenPartida = Number(layoutWithImageConfig.maxAnchoImagenPartida);
      const maxAnchoImagenPartida = Number.isFinite(rawMaxAnchoImagenPartida) && rawMaxAnchoImagenPartida > 0
        ? rawMaxAnchoImagenPartida
        : null;
      console.log({
        altoImagenPartida: layout.altoImagenPartida,
        maxAnchoImagenPartida: layoutWithImageConfig.maxAnchoImagenPartida,
      });
      const imagenPartidaGap = 10;
      const observacionesFontSize = 8;
      const observacionesPadding = 3;
      const observacionesFontName = hasTrebuchetItalic
        ? 'Trebuchet-Italic'
        : hasTrebuchet
          ? 'Trebuchet'
          : 'Helvetica-Oblique';
      const imageCache = new Map<string, Buffer | null>();

      const getPartidaImageBuffer = async (imageUrl?: string | null) => {
        const normalizedUrl = resolvePublicUrl(imageUrl);
        if (!showImagenPartida || !normalizedUrl) return null;
        if (imageCache.has(normalizedUrl)) return imageCache.get(normalizedUrl) ?? null;

        try {
          const response = await axios.get(normalizedUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          imageCache.set(normalizedUrl, imageBuffer);
          return imageBuffer;
        } catch (error) {
          console.warn('[pdf] No se pudo descargar imagen de partida', {
            documentoId: documento?.id ?? null,
            imageUrl: normalizedUrl,
            error: (error as Error)?.message ?? error,
          });
          imageCache.set(normalizedUrl, null);
          return null;
        }
      };

      const getPartidaImageBufferFromPartida = async (partida: PartidaCotizacion) => {
        if (partida.archivo_imagen_1?.trim()) {
          return getPartidaImageBuffer(partida.archivo_imagen_1);
        }

        const productoArchivoUrl = await getProductoArchivoUrl(partida.producto_archivo_id ?? null, empresaId);
        return getPartidaImageBuffer(productoArchivoUrl);
      };

      const computeRowMetrics = (values: string[], observaciones?: string | null, hasImage = false) => {
        const baseRowHeight = 17;
        const bodyPaddingY = 4;
        setFont(false, 9, mutedText);
        const textHeights = values.map((text, idx) =>
          doc.heightOfString(text, { width: columnWidths[idx] - 12 })
        );
        const maxTextHeight = Math.max(...textHeights, 9);
        const descriptionHeight = doc.heightOfString(values[descripcionIndex] || '', {
          width: columnWidths[descripcionIndex] - 12,
        });

        const obsText = showObservaciones ? (observaciones ?? '').trim() : '';
        let obsHeight = 0;
        if (obsText) {
          doc.save();
          doc.font(observacionesFontName);
          doc.fontSize(observacionesFontSize).fillColor(mutedText);
          obsHeight = doc.heightOfString(obsText, { width: columnWidths[descripcionIndex] - 12 });
          doc.restore();
        }

        const textBlockHeight = Math.max(baseRowHeight, maxTextHeight + bodyPaddingY * 2) + (obsHeight ? obsHeight + observacionesPadding : 0);
        const imageBlockHeight = hasImage ? imagenPartidaHeight + imagenPartidaGap : 0;
        const rowHeight = Math.max(textBlockHeight, descriptionHeight + bodyPaddingY * 2 + (obsHeight ? obsHeight + observacionesPadding : 0) + imageBlockHeight);

        return { rowHeight, bodyPaddingY, descriptionHeight, obsHeight, obsText, imageBlockHeight };
      };

      const drawRow = (
        values: string[],
        y: number,
        isHeader = false,
        observaciones?: string | null,
        imageBuffer?: Buffer | null,
      ) => {
        const baseRowHeight = isHeader ? 20 : 17;
        const bodyPaddingY = 4;
        let rowHeight = baseRowHeight;
        const rowWidth = columnWidths.reduce((acc, w) => acc + w, 0);

        let descriptionHeight = 0;
        let obsHeight = 0;
        let obsText = '';
        if (!isHeader) {
          const metrics = computeRowMetrics(values, observaciones, Boolean(imageBuffer));
          rowHeight = metrics.rowHeight;
          descriptionHeight = metrics.descriptionHeight;
          obsHeight = metrics.obsHeight;
          obsText = metrics.obsText;
        }

        if (isHeader) {
          const colorTablaHeader = normalizarColorHex(layout.colorTablaHeader) ?? primaryColor;
          doc.rect(startX, y, rowWidth, rowHeight).fill(colorTablaHeader);
        }

        doc.save();
        const headerFontSize = 9;
        let headerTextY = y + 6;
        if (isHeader) {
          setFont(true, headerFontSize, '#ffffff');
          const headerTextHeight = doc.heightOfString('Ay', { width: columnWidths[0] - 12 });
          headerTextY = y + (rowHeight - headerTextHeight) / 2;
        }
        values.forEach((text, idx) => {
          const x = startX + columnWidths.slice(0, idx).reduce((acc, w) => acc + w, 0) + 6;
          setFont(isHeader, isHeader ? headerFontSize : 9, isHeader ? '#ffffff' : mutedText);
          const textY = isHeader ? headerTextY : y + bodyPaddingY;
          doc.text(text, x, textY, { width: columnWidths[idx] - 12, align: idx >= 2 ? 'right' : 'left' });
        });

        if (!isHeader && obsHeight > 0 && obsText) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          const obsY = y + bodyPaddingY + descriptionHeight + observacionesPadding;
          doc.font(observacionesFontName);
          doc.fontSize(observacionesFontSize).fillColor(mutedText);
          doc.text(obsText, descX, obsY, { width: columnWidths[descripcionIndex] - 12, align: 'left' });
        }

        if (!isHeader && imageBuffer) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          const imageY = y + bodyPaddingY + descriptionHeight + (obsHeight > 0 && obsText ? obsHeight + observacionesPadding : 0) + imagenPartidaGap;
          const imageWidth = columnWidths[descripcionIndex] - 12;
          const imageFit: [number, number] = maxAnchoImagenPartida !== null
            ? [maxAnchoImagenPartida, imagenPartidaHeight]
            : [imageWidth, imagenPartidaHeight];
          try {
            doc.image(imageBuffer, descX, imageY, {
              fit: imageFit,
            });
          } catch (error) {
            console.warn('[pdf] No se pudo renderizar imagen de partida', {
              documentoId: documento?.id ?? null,
              error: (error as Error)?.message ?? error,
            });
          }
        }
        doc.restore();
        return y + rowHeight;
      };

      const pageBottom = doc.page.height - doc.page.margins.bottom;
      let currentY = doc.y;

      currentY = drawRow(headers, currentY, true);

      for (const p of partidas) {
        const cantidad = Number(p.cantidad ?? 0);
        const precioUnitario = Number(p.precio_unitario ?? 0);
        const subtotalNeto = Number(p.subtotal_partida ?? 0);
        const subtotalBruto = cantidad * precioUnitario;
        const descuento = Math.max(0, subtotalBruto - subtotalNeto);
        const values = [
          p.producto_clave || '',
          p.descripcion_alterna || '',
          cantidad.toFixed(2),
          formatCurrency(precioUnitario),
          formatCurrency(descuento),
          formatCurrency(subtotalNeto),
        ];
        const imageBuffer = await getPartidaImageBufferFromPartida(p as PartidaCotizacion);
        const metrics = computeRowMetrics(values, (p as PartidaCotizacion).observaciones ?? null, Boolean(imageBuffer));
        const rowHeight = metrics.rowHeight;

        if (currentY + rowHeight > pageBottom) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }

        currentY = drawRow(
          values,
          currentY,
          false,
          (p as PartidaCotizacion).observaciones ?? null,
          imageBuffer,
        );
      }

      doc.y = currentY;
      doc.moveDown(0.5);
    };

    const renderTotales = () => {
      console.log('[PDF DEBUG]', {
        bloque: 'renderTotales:inicio',
        y: doc.y,
        pageHeight: doc.page.height,
        estaTimbrado,
      });
      // Totales se renderizarán en el pie de página
      const totalRows: Array<[string, number | null | undefined]> = [
        ['Subtotal bruto', subtotalBrutoDocumento],
        ['Descuentos', descuentoTotalDocumento],
        ['Subtotal neto', subtotalNetoDocumento],
        ['IVA', documento?.iva],
        ['Total', documento?.total],
      ];

      doc.moveDown(0.4);

      // Observaciones (antes de reservar espacio del pie)
      const qrWidth = 110;
      const textoWidthBase = qrBuffer ? contentWidth - qrWidth - 24 : contentWidth;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      const footerBottomMargin = 22; // margen inferior ~20-25 px para garantizar que no se corte

      const calcularAlturaPie = () => {
        if (!estaTimbrado) return 50; // margen de seguridad mínimo cuando no hay timbre

        const textoLargo: Array<[string, string, number]> = [
          ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
          ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
          ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
        ];

        let hIzq = 0;
        const gapCols = 12;
        const totalsLabelWidth = 70;
        const totalsValueWidth = 90;
        const totalsWidth = totalsLabelWidth + totalsValueWidth;
        const textoWidth = contentWidth - totalsWidth - gapCols;

        textoLargo.forEach(([label, value, size]) => {
          setFont(true, 8, textColor);
          hIzq += doc.heightOfString(`${label}:`, { width: textoWidth });
          setFont(false, size, mutedText);
          hIzq += doc.heightOfString(value, { width: textoWidth, lineGap: size <= 6 ? 0.2 : 0 });
          hIzq += 4; // espaciado equivalente a moveDown corto
        });

        // Altura del bloque de totales (columna derecha, sin recuadro)
        const rowHeightCompact = 12; // espaciado compacto
        const totalsHeight = totalRows.length * rowHeightCompact;

        // QR debajo de totales (ligeramente más pequeño y con gap)
        const qrGap = 10;
        const qrHeight = qrBuffer ? Math.min(qrWidth, 85) : 0;

        // Leyenda final
        setFont(true, 10, textColor);
        const alturaLeyenda = doc.heightOfString('** Este documento es una representación impresa de un CFDI. **', {
          width: contentWidth,
        });

        const padding = 10; // padding superior/inferior
        const topOffset = 8; // desplazamiento usado al comenzar el footer (doc.y = footerY + 8)

        const alturaTotalBloque = Math.max(hIzq, totalsHeight + qrGap + qrHeight) + alturaLeyenda + 12;

        return alturaTotalBloque + padding + topOffset;
      };

  const footerHeight = estaTimbrado ? calcularAlturaPie() : 0;
  const footerTop = estaTimbrado ? doc.page.height - footerBottomMargin - footerHeight : pageBottom;

      console.log('[PDF DEBUG]', {
        bloque: 'renderTotales:calculoFooter',
        y: doc.y,
        pageHeight: doc.page.height,
        footerHeight,
        footerTop,
        estaTimbrado,
      });

      if (documento?.observaciones) {
        const obsWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const obsHeight = doc.heightOfString(documento.observaciones, { width: obsWidth }) + (esOrdenServicio ? 18 : 28);
        console.log('[PDF DEBUG]', {
          bloque: 'observaciones:antesEvaluar',
          y: doc.y,
          pageHeight: doc.page.height,
          obsHeight,
          footerTop,
          estaTimbrado,
        });
        if (doc.y + obsHeight > footerTop - 6) {
          console.log('[PDF DEBUG]', {
            bloque: 'observaciones:addPage',
            y: doc.y,
            pageHeight: doc.page.height,
            accion: 'doc.addPage',
            estaTimbrado,
          });
          doc.addPage();
        }
        doc.moveDown(0.6);
        drawSectionHeader('Observaciones');
        setFont(false, 10, mutedText);
        doc.text(documento.observaciones, { width: obsWidth });
        doc.moveDown(0.6);
      }

      if (esCotizacion || esOrdenServicio) {
        const totalsLabelWidth = 84;
        const totalsValueWidth = 90;
        const rowHeightCompact = 12;
        const totalsPaddingX = 12;
        const totalsPaddingY = 8;
        const totalsInnerGap = 8;
        const totalsRightExtra = 12;
        const totalsHeight = totalRows.length * rowHeightCompact + totalsPaddingY * 2;
        const gapBottom = esOrdenServicio ? 10 : 14;
        const bloqueHeight = totalsHeight;
        const anchorY = pageBottom - gapBottom - bloqueHeight;
        const totalsAmountRightX = startX + columnWidths.reduce((acc, width) => acc + width, 0);
        const totalsPanelRightX = totalsAmountRightX + totalsRightExtra;
        const totalsPanelWidth = totalsPaddingX + totalsLabelWidth + totalsInnerGap + totalsValueWidth + totalsRightExtra;
        const totalsPanelLeftX = totalsPanelRightX - totalsPanelWidth;

        if (doc.y + bloqueHeight > anchorY) {
          doc.addPage();
        }

        doc
          .roundedRect(totalsPanelLeftX, anchorY - 4, totalsPanelWidth, totalsHeight, 5)
          .fillAndStroke('#f3f4f6', '#e5e7eb');

        let totY = anchorY + totalsPaddingY - 4;
        totalRows.forEach(([label, value]) => {
          const isTotal = label === 'Total';
          setFont(isTotal, isTotal && esOrdenServicio ? 10 : 9, textColor);

          const importeX = totalsAmountRightX - totalsValueWidth;
          const gapLabelValor = totalsInnerGap;
          const labelRight = importeX - gapLabelValor;
          const labelX = labelRight - totalsLabelWidth;

          doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right' });
          doc.text(formatCurrency(value), importeX, totY, {
            width: totalsValueWidth,
            align: 'right',
          });
          totY += rowHeightCompact;
        });

        doc.y = totY;
        return;
      }

      // Pie fijo timbrado CFDI anclado al borde inferior
      const necesitaNuevaPagina = doc.y > footerTop - 8;
      console.log('[PDF DEBUG]', {
        bloque: 'footer:antesEvaluar',
        y: doc.y,
        pageHeight: doc.page.height,
        footerTop,
        necesitaNuevaPagina,
        estaTimbrado,
      });
      if (necesitaNuevaPagina) {
        if (!estaTimbrado) {
          console.log('[PDF DEBUG]', {
            bloque: 'footer:saltaAddPage',
            y: doc.y,
            pageHeight: doc.page.height,
            accion: 'skip addPage (Borrador)',
            estaTimbrado,
          });
          return; // evita crear una página extra solo para "Borrador"
        }
        console.log('[PDF DEBUG]', {
          bloque: 'footer:addPage',
          y: doc.y,
          pageHeight: doc.page.height,
          accion: 'doc.addPage',
          estaTimbrado,
        });
        doc.addPage();
      }

      const footerY = doc.page.height - footerBottomMargin - footerHeight;
      doc
        .moveTo(doc.page.margins.left, footerY)
        .lineTo(doc.page.width - doc.page.margins.right, footerY)
        .strokeColor('#cccccc')
        .stroke();

      doc.y = footerY + 8;

      console.log('[PDF DEBUG]', {
        bloque: 'footer:antesRender',
        y: doc.y,
        pageHeight: doc.page.height,
        estaTimbrado,
        accion: estaTimbrado ? 'render timbrado' : 'render borrador',
      });

      if (!estaTimbrado) {
        setFont(true, 11, textColor);
        doc.text('Estatus: Borrador');
      } else {
        const startYTimbrado = doc.y;
        const gapCols = 12;
        const totalsLabelWidth = 84;
        const totalsValueWidth = 90;
        const totalsWidth = totalsLabelWidth + totalsValueWidth;
        const colLeftX = doc.page.margins.left;
        const textoWidth = contentWidth - totalsWidth - gapCols;
        const colRightX = colLeftX + textoWidth + gapCols;
        let selloCfdiEndY = startYTimbrado;

        // Columna izquierda: cadena y sellos
        const textoLargo: Array<[string, string, number]> = [
          ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
          ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
          ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
        ];

        textoLargo.forEach(([label, value, size]) => {
          setFont(true, 8, textColor);
          doc.text(`${label}:`, colLeftX, doc.y, { width: textoWidth });
          setFont(false, size, mutedText);
          doc.text(value, {
            width: textoWidth,
            lineGap: size <= 6 ? 0.2 : 0,
          });
          if (label === 'Sello digital del CFDI') {
            selloCfdiEndY = doc.y;
          }
          doc.moveDown(0.35);
        });

        // Columna derecha: Subtotal bruto / descuentos / neto / IVA / total compactos
        let totY = startYTimbrado;
        const rowHeightCompact = 12;
        const totalsPaddingX = 12;
        const totalsPaddingY = 8;
        const totalsInnerGap = 8;
        const totalsPanelRightX = startX + columnWidths.reduce((acc, width) => acc + width, 0);
        const totalsPanelWidth = totalsPaddingX + totalsLabelWidth + totalsInnerGap + totalsValueWidth;
        const totalsPanelLeftX = totalsPanelRightX - totalsPanelWidth;
        const totalsPanelHeight = totalRows.length * rowHeightCompact + totalsPaddingY * 2;

        doc
          .roundedRect(totalsPanelLeftX, startYTimbrado - 4, totalsPanelWidth, totalsPanelHeight, 5)
          .fillAndStroke('#f3f4f6', '#e5e7eb');

        totY = startYTimbrado + totalsPaddingY - 4;
        totalRows.forEach(([label, value]) => {
          const isTotal = label === 'Total';
          setFont(isTotal, 9, textColor); // mismo tamaño para TOTAL, mantiene negritas

          const importeX = totalsPanelRightX - totalsValueWidth;
          const gapLabelValor = totalsInnerGap; // mantiene el monto alineado al borde derecho de la tabla
          const labelRight = importeX - gapLabelValor;
          const labelX = labelRight - totalsLabelWidth;

          doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right' });
          doc.text(formatCurrency(value), importeX, totY, {
            width: totalsValueWidth,
            align: 'right',
          });
          totY += rowHeightCompact;
        });

        // QR debajo de los totales
        if (qrBuffer) {
          const qrWidthAdjusted = Math.min(qrWidth, 85); // ~10-15% más pequeño
          const qrX = doc.page.width - doc.page.margins.right - qrWidthAdjusted; // alinea borde derecho con margen
          const qrY = totY + 10; // más espacio vertical respecto al TOTAL
          doc.image(qrBuffer, qrX, qrY, { width: qrWidthAdjusted });
          totY = qrY + qrWidthAdjusted;
        }

        // Leyenda final centrada en todo el ancho disponible del pie
        const leyendaY = Math.max(doc.y, totY + 4, selloCfdiEndY + 2); // reduce gap para que no salte de página
        doc.y = leyendaY;
        setFont(true, 10, textColor);
        doc.text('** Este documento es una representación impresa de un CFDI. **', colLeftX, doc.y, {
          width: contentWidth,
          align: 'center',
        });
      }
    };

    void (async () => {
      if (layout.mostrarHeader) {
        renderHeader();
      }

      if (layout.mostrarCliente) {
        renderCliente();
      }

      if (layout.mostrarPartidas) {
        await renderPartidas();
      }

      if (layout.mostrarTotales) {
        renderTotales();
      }

      doc.end();
    })().catch(reject);
  });
  } catch (error) {
    console.error('[pdf] Error al generar PDF', {
      documentoId: documento?.id,
      tipoDocumento: documento?.tipo_documento,
      empresaId,
      hasPartidas: Boolean(partidas?.length),
      error: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    throw error;
  }
}
