import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

type DocumentoCotizacion = {
  id?: number;
  tipo_documento?: string | null;
  serie?: string | null;
  numero?: number | null;
  fecha_documento?: string | null;
  estatus_documento?: string | null;
  cliente_nombre?: string | null;
  cliente_direccion?: string | null;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  cliente_rfc?: string | null;
  regimen_fiscal?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal?: string | null;
  subtotal?: number | null;
  iva?: number | null;
  total?: number | null;
  observaciones?: string | null;
};

type PartidaCotizacion = {
  producto_clave?: string | null;
  descripcion_alterna?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
};

type DataCotizacion = {
  documento: DocumentoCotizacion;
  partidas: PartidaCotizacion[];
};

const formatCurrency = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

const formatDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-MX');
};

const tituloPorTipo = (tipo: string | null | undefined) => {
  const t = (tipo || '').toString().toLowerCase();
  if (t === 'factura') return 'FACTURA';
  if (t === 'pedido') return 'PEDIDO';
  if (t === 'remision') return 'REMISIÓN';
  return 'COTIZACIÓN';
};

export async function generarDocumentoPDF(data: DataCotizacion): Promise<Buffer> {
  const { documento, partidas } = data;
  const contentWidth = 595.28 - 2 * 50; // A4 width minus default margins (approx)
  const primaryColor = '#1d2f68';
  const textColor = '#111827';
  const mutedText = '#374151';
  const borderGray = '#e5e7eb';

  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const logoPath = path.resolve(backendRoot, '..', 'frontend', 'public', 'logos', 'logo-emphasys.jpg');
  const hasLogo = fs.existsSync(logoPath);

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Encabezado con logo y datos de la cotización
    const headerTop = doc.y;
    const headerHeight = 90;
    const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(doc.page.margins.left, headerTop, headerWidth, headerHeight).fill('#f7f8fb');

    if (hasLogo) {
      doc.image(logoPath, doc.page.margins.left + 12, headerTop + 12, { width: 120, fit: [120, 60] });
    }

    const folio = `${documento?.serie ?? ''}${documento?.numero ? `-${documento.numero}` : ''}`.trim();
    const infoX = doc.page.width - doc.page.margins.right - 230;
    const infoWidth = 220;

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(primaryColor)
      .text(tituloPorTipo(documento?.tipo_documento), infoX, headerTop + 14, { width: infoWidth, align: 'right' });

    const encabezadoDatos: Array<[string, string]> = [
      ['Folio', folio || 'N/D'],
      ['Fecha', formatDate(documento?.fecha_documento) || 'N/D'],
      ['Estatus', documento?.estatus_documento || 'N/D'],
    ];

    encabezadoDatos.forEach(([label, value], idx) => {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(mutedText)
        .text(`${label}: ${value}`, infoX, headerTop + 44 + idx * 14, { width: infoWidth, align: 'right' });
    });

    doc.y = headerTop + headerHeight + 16;

    // Cliente
    const drawSectionHeader = (title: string) => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, contentWidth, 22).fill(primaryColor);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(title.toUpperCase(), doc.page.margins.left + 10, y + 6, { width: contentWidth - 20 });
      doc.y = y + 28;
      doc.fillColor(textColor).font('Helvetica').fontSize(10);
    };

    drawSectionHeader('Cliente');

  const clientStartX = doc.page.margins.left;
  const labelWidth = 85;
  const gap = 8;
  const valueWidth = contentWidth - labelWidth - gap;
  const startY = doc.y;
  let currentY = startY;

    const clienteCampos: Array<[string, string | null | undefined]> = [
      ['Nombre', documento?.cliente_nombre],
      ['Correo', documento?.cliente_email],
      ['RFC', documento?.cliente_rfc],
      ['Dirección', documento?.cliente_direccion],
    ];

    clienteCampos.forEach(([label, value]) => {
      const textValue = value || 'N/D';
      // Label
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(textColor)
        .text(`${label}:`, clientStartX, currentY, { width: labelWidth });

      // Value (slightly smaller font per requirement)
      doc.font('Helvetica').fontSize(9).fillColor(mutedText);
      const valueHeight = doc.heightOfString(textValue, { width: valueWidth });
      doc.text(textValue, clientStartX + labelWidth + gap, currentY, { width: valueWidth });

      doc.font('Helvetica-Bold').fontSize(10); // set to measure label height consistently
      const labelHeight = doc.heightOfString('Ag', { width: labelWidth });
      const lineHeight = Math.max(labelHeight, valueHeight);
      currentY += lineHeight + 4;
    });

    doc.y = currentY + 8;

    // Separador entre secciones
    doc.moveDown(0.5);

    // Tabla de partidas (sin título "Partidas")
  const startX = doc.page.margins.left;
  const columnWidths = [90, 210, 60, 70, 65]; // total = contentWidth
    const headers = ['Producto', 'Descripción', 'Cantidad', 'Precio unitario', 'Importe'];

    const drawRow = (values: string[], isHeader = false) => {
      const rowHeight = isHeader ? 20 : 18;
      const y = doc.y;
      const rowWidth = columnWidths.reduce((acc, w) => acc + w, 0);

      if (isHeader) {
        doc.rect(startX, y, rowWidth, rowHeight).fill(primaryColor);
      } else {
        doc.moveTo(startX, y + rowHeight).lineTo(startX + rowWidth, y + rowHeight).strokeColor(borderGray).stroke();
      }

      doc.save();
      values.forEach((text, idx) => {
        const x = startX + columnWidths.slice(0, idx).reduce((acc, w) => acc + w, 0) + 6;
        doc
          .fontSize(isHeader ? 10 : 9)
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isHeader ? '#ffffff' : mutedText)
          .text(text, x, y + 6, { width: columnWidths[idx] - 12, align: idx >= 2 ? 'right' : 'left' });
      });
      doc.restore();
      doc.y = y + rowHeight;
    };

    drawRow(headers, true);

    partidas.forEach((p) => {
      const values = [
        p.producto_clave || '',
        p.descripcion_alterna || '',
        Number(p.cantidad ?? 0).toFixed(2),
        formatCurrency(Number(p.precio_unitario ?? 0)),
        formatCurrency(Number(p.subtotal_partida ?? 0)),
      ];
      drawRow(values, false);
    });

    doc.moveDown(0.8);

    // Totales (debajo de la tabla, alineados a la derecha)
  const totalLabelWidth = 90;
  const totalValueWidth = 100;
  const tableWidth = columnWidths.reduce((acc, w) => acc + w, 0);
  const tableEndX = startX + tableWidth;
  const totalsStartX = tableEndX - (totalLabelWidth + totalValueWidth) - 12;

    // Llevar totales hacia la parte inferior de la página sin saltar de página
    const minYForTotals = doc.page.height - doc.page.margins.bottom - 90;
    if (doc.y < minYForTotals) {
      doc.y = minYForTotals;
    }

    const totalRows: Array<[string, number | null | undefined]> = [
      ['Subtotal', documento?.subtotal],
      ['IVA', documento?.iva],
      ['Total', documento?.total],
    ];

    const totalsBoxHeight = totalRows.length * 18 + 16;
    doc
      .roundedRect(totalsStartX - 12, doc.y - 6, totalLabelWidth + totalValueWidth + 24, totalsBoxHeight)
      .strokeColor(borderGray)
      .lineWidth(1.6)
      .stroke();

    totalRows.forEach(([label, value], idx) => {
      const y = doc.y + idx * 18;
      doc
        .font(label === 'Total' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text(label === 'Total' ? 'TOTAL' : label, totalsStartX, y, { width: totalLabelWidth, align: 'right' })
        .text(formatCurrency(value), totalsStartX + totalLabelWidth, y, { width: totalValueWidth, align: 'right' });
    });

    doc.y += totalRows.length * 18 + 10;

    // Observaciones
    if (documento?.observaciones) {
      doc.moveDown(1);
      drawSectionHeader('Observaciones');
      doc.fontSize(10).fillColor(mutedText).text(documento.observaciones, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
    }

    doc.end();
  });
}
