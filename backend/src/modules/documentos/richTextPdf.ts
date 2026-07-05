// Parser y render mínimos para el subconjunto de HTML permitido por
// sanitizarRichTextBasico (p, br, strong, b, em, i, ul, ol, li). No ejecuta
// HTML ni interpreta nada fuera de estas etiquetas: todo lo demás se
// aplana a texto plano.

export interface RichTextPdfFonts {
  regular: string;
  bold: string;
  italic: string;
}

export interface RichTextPdfOptions {
  width: number;
  fontSize: number;
  fonts: RichTextPdfFonts;
  color?: string;
  // Coordenada Y absoluta de la página a partir de la cual se deja de dibujar.
  // Al fijar `height` en cada doc.text() evita que PDFKit inserte páginas
  // automáticamente por desbordamiento; el contenido simplemente se recorta.
  maxY?: number;
  // Overrides opcionales de espaciado entre bloques (por defecto PARAGRAPH_SPACING/
  // LIST_ITEM_SPACING) para permitir un render más compacto tipo "letra pequeña legal".
  paragraphSpacing?: number;
  listItemSpacing?: number;
}

type HtmlNode =
  | { type: 'element'; tag: string; children: HtmlNode[] }
  | { type: 'text'; text: string };

type RichRun = { text: string; bold: boolean; italic: boolean };
type RichLine = RichRun[];

type RichBlock =
  | { kind: 'paragraph'; lines: RichLine[] }
  | { kind: 'list'; ordered: boolean; items: RichLine[][] };

const PARAGRAPH_SPACING = 4;
const LIST_ITEM_SPACING = 2;
const LIST_INDENT = 14;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

type Token = { type: 'open' | 'close' | 'text'; name?: string; text?: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const tagRe = /<\/?([a-zA-Z0-9]+)\s*\/?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html))) {
    if (match.index > lastIndex) {
      const text = decodeEntities(html.slice(lastIndex, match.index));
      if (text) tokens.push({ type: 'text', text });
    }
    const name = match[1].toLowerCase();
    tokens.push({ type: match[0].startsWith('</') ? 'close' : 'open', name });
    lastIndex = tagRe.lastIndex;
  }

  if (lastIndex < html.length) {
    const text = decodeEntities(html.slice(lastIndex));
    if (text) tokens.push({ type: 'text', text });
  }

  return tokens;
}

function parseToNodes(html: string): HtmlNode[] {
  const tokens = tokenize(html);
  let i = 0;

  function parseChildren(stopTag?: string): HtmlNode[] {
    const nodes: HtmlNode[] = [];
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.type === 'close') {
        i++;
        if (tok.name === stopTag) return nodes;
        continue;
      }
      if (tok.type === 'text') {
        nodes.push({ type: 'text', text: tok.text! });
        i++;
        continue;
      }
      const tagName = tok.name!;
      i++;
      if (tagName === 'br') {
        nodes.push({ type: 'element', tag: 'br', children: [] });
        continue;
      }
      nodes.push({ type: 'element', tag: tagName, children: parseChildren(tagName) });
    }
    return nodes;
  }

  return parseChildren();
}

function isLineNonEmpty(line: RichLine): boolean {
  return line.some((run) => run.text.trim().length > 0);
}

function extractLines(nodes: HtmlNode[]): RichLine[] {
  const lines: RichLine[] = [];
  let currentLine: RichRun[] = [];

  function walk(nodeList: HtmlNode[], bold: boolean, italic: boolean) {
    for (const node of nodeList) {
      if (node.type === 'text') {
        if (node.text) currentLine.push({ text: node.text, bold, italic });
        continue;
      }
      switch (node.tag) {
        case 'br':
          lines.push(currentLine);
          currentLine = [];
          break;
        case 'strong':
        case 'b':
          walk(node.children, true, italic);
          break;
        case 'em':
        case 'i':
          walk(node.children, bold, true);
          break;
        default:
          // Etiqueta no soportada: se degrada a su contenido de texto plano.
          walk(node.children, bold, italic);
      }
    }
  }

  walk(nodes, false, false);
  lines.push(currentLine);
  return lines;
}

function collectListItems(children: HtmlNode[], items: RichLine[][]) {
  for (const child of children) {
    if (child.type !== 'element' || child.tag !== 'li') continue;

    const ownInline: HtmlNode[] = [];
    const nestedLists: HtmlNode[] = [];
    for (const c of child.children) {
      if (c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol')) {
        nestedLists.push(c);
      } else {
        ownInline.push(c);
      }
    }

    items.push(extractLines(ownInline));

    // Listas anidadas: se degradan aplanándolas como items adicionales de
    // la misma lista, sin sangría extra.
    for (const nested of nestedLists) {
      if (nested.type === 'element') collectListItems(nested.children, items);
    }
  }
}

function extractBlocks(nodes: HtmlNode[]): RichBlock[] {
  const hasBlockLevel = nodes.some((n) => n.type === 'element' && (n.tag === 'p' || n.tag === 'ul' || n.tag === 'ol'));
  if (!hasBlockLevel) {
    return [{ kind: 'paragraph', lines: extractLines(nodes) }];
  }

  const blocks: RichBlock[] = [];
  let stray: HtmlNode[] = [];
  const flushStray = () => {
    if (stray.length) {
      blocks.push({ kind: 'paragraph', lines: extractLines(stray) });
      stray = [];
    }
  };

  for (const node of nodes) {
    if (node.type === 'element' && node.tag === 'p') {
      flushStray();
      blocks.push({ kind: 'paragraph', lines: extractLines(node.children) });
    } else if (node.type === 'element' && (node.tag === 'ul' || node.tag === 'ol')) {
      flushStray();
      const items: RichLine[][] = [];
      collectListItems(node.children, items);
      blocks.push({ kind: 'list', ordered: node.tag === 'ol', items });
    } else {
      stray.push(node);
    }
  }
  flushStray();

  return blocks;
}

function parseRichTextBasico(html: string): RichBlock[] {
  if (!html || !html.trim()) return [];
  return extractBlocks(parseToNodes(html));
}

export function richTextBasicoEstaVacio(html: string | null | undefined): boolean {
  if (!html) return true;
  const blocks = parseRichTextBasico(html);
  return !blocks.some((block) =>
    block.kind === 'paragraph'
      ? block.lines.some(isLineNonEmpty)
      : block.items.some((item) => item.some(isLineNonEmpty))
  );
}

function resolveFont(run: RichRun, fonts: RichTextPdfFonts): string {
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

function lineHeight(doc: PDFKit.PDFDocument, line: RichLine, width: number): number {
  const text = line.map((run) => run.text).join('');
  return doc.heightOfString(text || ' ', { width });
}

function drawLine(doc: PDFKit.PDFDocument, line: RichLine, x: number, y: number, width: number, options: RichTextPdfOptions): number {
  const height = lineHeight(doc, line, width);
  const plainText = line.map((run) => run.text).join('');

  if (!line.length || !plainText.trim()) {
    return y + height;
  }

  // Si se definió un límite de página, se acota `height` en cada doc.text()
  // para que PDFKit recorte el contenido en vez de insertar páginas nuevas.
  if (options.maxY != null && y >= options.maxY) {
    return y + height;
  }
  const boundedHeight = options.maxY != null ? Math.max(options.maxY - y, 0) : undefined;

  doc.fontSize(options.fontSize).fillColor(options.color ?? '#000000');

  const uniformStyle = line.every((run) => run.bold === line[0].bold && run.italic === line[0].italic);
  if (uniformStyle) {
    doc.font(resolveFont(line[0], options.fonts));
    doc.text(plainText, x, y, { width, height: boundedHeight });
  } else {
    line.forEach((run, idx) => {
      doc.font(resolveFont(run, options.fonts));
      const isLast = idx === line.length - 1;
      if (idx === 0) {
        doc.text(run.text, x, y, { width, height: boundedHeight, continued: !isLast });
      } else {
        doc.text(run.text, { continued: !isLast });
      }
    });
  }

  return y + height;
}

export function heightOfRichTextBasicoPdf(doc: PDFKit.PDFDocument, html: string, options: RichTextPdfOptions): number {
  const blocks = parseRichTextBasico(html);
  if (!blocks.length) return 0;

  const paragraphSpacing = options.paragraphSpacing ?? PARAGRAPH_SPACING;
  const listItemSpacing = options.listItemSpacing ?? LIST_ITEM_SPACING;

  doc.save();
  doc.font(options.fonts.regular).fontSize(options.fontSize);

  let total = 0;
  blocks.forEach((block, idx) => {
    if (idx > 0) total += paragraphSpacing;
    if (block.kind === 'paragraph') {
      block.lines.forEach((line) => {
        total += lineHeight(doc, line, options.width);
      });
    } else {
      block.items.forEach((item, itemIdx) => {
        if (itemIdx > 0) total += listItemSpacing;
        item.forEach((line) => {
          total += lineHeight(doc, line, options.width - LIST_INDENT);
        });
      });
    }
  });

  doc.restore();
  return total;
}

export function renderRichTextBasicoPdf(doc: PDFKit.PDFDocument, html: string, x: number, y: number, options: RichTextPdfOptions): number {
  const blocks = parseRichTextBasico(html);
  if (!blocks.length) return y;

  const paragraphSpacing = options.paragraphSpacing ?? PARAGRAPH_SPACING;
  const listItemSpacing = options.listItemSpacing ?? LIST_ITEM_SPACING;

  doc.save();
  let cursorY = y;

  blocks.forEach((block, idx) => {
    if (idx > 0) cursorY += paragraphSpacing;
    if (block.kind === 'paragraph') {
      block.lines.forEach((line) => {
        cursorY = drawLine(doc, line, x, cursorY, options.width, options);
      });
    } else {
      block.items.forEach((item, itemIdx) => {
        if (itemIdx > 0) cursorY += listItemSpacing;
        if (options.maxY != null && cursorY >= options.maxY) {
          return;
        }
        doc.font(options.fonts.regular).fontSize(options.fontSize).fillColor(options.color ?? '#000000');
        const prefix = block.ordered ? `${itemIdx + 1}.` : '•';
        const prefixHeight = options.maxY != null ? Math.max(options.maxY - cursorY, 0) : undefined;
        doc.text(prefix, x, cursorY, { width: LIST_INDENT - 2, height: prefixHeight });
        item.forEach((line) => {
          cursorY = drawLine(doc, line, x + LIST_INDENT, cursorY, options.width - LIST_INDENT, options);
        });
      });
    }
  });

  doc.restore();
  return cursorY;
}
