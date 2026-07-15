// Layout y render del bloque "campos configurables de la partida" dentro del
// PDF de documentos. Aísla el algoritmo de orden (padre antes que hijo) y la
// distribución en renglones (varios pares "Etiqueta: Valor" por línea cuando
// el ancho lo permite) para que el cálculo de altura y el dibujo usen
// exactamente la misma lógica.

export type CampoConfigurablePartidaValor = {
  campoId: number;
  campoPadreId: number | null;
  orden: number | null;
  nombre: string;
  valorTexto: string;
};

type OpcionesDistribucion = {
  width: number;
  fontSize: number;
  gap: number;
  fontRegular: string;
  fontBold: string;
};

type OpcionesRender = OpcionesDistribucion & {
  lineHeight: number;
  color: string;
};

/**
 * Ordena los campos configurables de una partida garantizando que un campo
 * dependiente (campo_padre_id) se imprima siempre después de su campo padre,
 * sin importar el valor de `orden` (incluso invertido o igual). Entre campos
 * sin relación de dependencia se respeta `orden` ASC (NULLS LAST). Admite
 * cualquier número de niveles de dependencia (no está atado a un caso
 * particular como Marca/Modelo) y usa un orden estable como respaldo si la
 * configuración de padres tuviera un ciclo inválido.
 */
export function ordenarCamposConfigurablesPartida(
  campos: CampoConfigurablePartidaValor[]
): CampoConfigurablePartidaValor[] {
  const idsPresentes = new Set(campos.map((c) => c.campoId));

  const compararEstable = (a: CampoConfigurablePartidaValor, b: CampoConfigurablePartidaValor) => {
    const ordenA = a.orden ?? Number.POSITIVE_INFINITY;
    const ordenB = b.orden ?? Number.POSITIVE_INFINITY;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return a.campoId - b.campoId;
  };

  const indegree = new Map<number, number>();
  const hijosPorPadre = new Map<number, CampoConfigurablePartidaValor[]>();

  campos.forEach((campo) => indegree.set(campo.campoId, 0));

  campos.forEach((campo) => {
    const padreId = campo.campoPadreId;
    // Solo se aplica la restricción de orden si el padre también viene
    // presente (con valor capturado) en esta misma partida.
    if (padreId !== null && padreId !== undefined && padreId !== campo.campoId && idsPresentes.has(padreId)) {
      indegree.set(campo.campoId, (indegree.get(campo.campoId) ?? 0) + 1);
      const hijos = hijosPorPadre.get(padreId) ?? [];
      hijos.push(campo);
      hijosPorPadre.set(padreId, hijos);
    }
  });

  const disponibles = campos.filter((campo) => (indegree.get(campo.campoId) ?? 0) === 0).sort(compararEstable);
  const resultado: CampoConfigurablePartidaValor[] = [];
  const visitados = new Set<number>();

  while (disponibles.length > 0) {
    const actual = disponibles.shift()!;
    if (visitados.has(actual.campoId)) continue;
    visitados.add(actual.campoId);
    resultado.push(actual);

    const hijos = (hijosPorPadre.get(actual.campoId) ?? []).sort(compararEstable);
    hijos.forEach((hijo) => {
      const nuevoIndegree = (indegree.get(hijo.campoId) ?? 0) - 1;
      indegree.set(hijo.campoId, nuevoIndegree);
      if (nuevoIndegree === 0 && !visitados.has(hijo.campoId)) {
        disponibles.push(hijo);
        disponibles.sort(compararEstable);
      }
    });
  }

  // Configuración inválida (ciclo de dependencias entre campos): en vez de
  // recursar o bloquear la impresión, se agregan los campos restantes con un
  // orden estable (por `orden`/id) como respaldo.
  if (resultado.length < campos.length) {
    const restantes = campos.filter((campo) => !visitados.has(campo.campoId)).sort(compararEstable);
    resultado.push(...restantes);
  }

  return resultado;
}

/**
 * Distribuye los campos ya ordenados en renglones: agrega pares consecutivos
 * "Etiqueta: Valor" en el mismo renglón mientras quepan en `width` (midiendo
 * ancho real con PDFKit, incluyendo la separación respecto al campo
 * anterior), y solo salta de línea cuando el siguiente par ya no cabe. Nunca
 * corta un par entre dos líneas.
 */
export function distribuirCamposConfigurablesEnLineas(
  doc: PDFKit.PDFDocument,
  camposOrdenados: CampoConfigurablePartidaValor[],
  opciones: OpcionesDistribucion
): CampoConfigurablePartidaValor[][] {
  const { width, fontSize, gap, fontRegular, fontBold } = opciones;
  const lineas: CampoConfigurablePartidaValor[][] = [];
  let lineaActual: CampoConfigurablePartidaValor[] = [];
  let anchoLineaActual = 0;

  const medirAnchoCampo = (campo: CampoConfigurablePartidaValor) => {
    doc.font(fontBold).fontSize(fontSize);
    const anchoEtiqueta = doc.widthOfString(`${campo.nombre}: `);
    doc.font(fontRegular).fontSize(fontSize);
    const anchoValor = doc.widthOfString(campo.valorTexto);
    return anchoEtiqueta + anchoValor;
  };

  camposOrdenados.forEach((campo) => {
    const anchoCampo = medirAnchoCampo(campo);
    const anchoConSeparacion = lineaActual.length > 0 ? gap + anchoCampo : anchoCampo;

    if (lineaActual.length > 0 && anchoLineaActual + anchoConSeparacion > width) {
      lineas.push(lineaActual);
      lineaActual = [campo];
      anchoLineaActual = anchoCampo;
    } else {
      lineaActual.push(campo);
      anchoLineaActual += anchoConSeparacion;
    }
  });

  if (lineaActual.length > 0) lineas.push(lineaActual);

  return lineas;
}

/**
 * Calcula la altura del bloque de campos configurables reutilizando la misma
 * distribución en líneas que usará el render (`distribuirCamposConfigurablesEnLineas`),
 * de modo que la altura reservada por partida nunca difiera de lo dibujado.
 * Devuelve también las líneas ya calculadas para que el render no tenga que
 * recalcularlas.
 */
export function calcularAlturaCamposConfigurablesPartida(
  doc: PDFKit.PDFDocument,
  camposOrdenados: CampoConfigurablePartidaValor[],
  opciones: OpcionesRender
): { altura: number; lineas: CampoConfigurablePartidaValor[][] } {
  if (!camposOrdenados.length) return { altura: 0, lineas: [] };

  const lineas = distribuirCamposConfigurablesEnLineas(doc, camposOrdenados, opciones);
  const altura = lineas.length * opciones.lineHeight;

  return { altura, lineas };
}

/**
 * Dibuja el bloque de campos configurables a partir de las líneas ya
 * calculadas por `calcularAlturaCamposConfigurablesPartida` (no vuelve a
 * distribuir), garantizando que lo dibujado coincida exactamente con lo
 * medido para la altura de la fila.
 */
export function renderCamposConfigurablesPartida(
  doc: PDFKit.PDFDocument,
  lineas: CampoConfigurablePartidaValor[][],
  x: number,
  y: number,
  opciones: OpcionesRender
): void {
  const { fontSize, gap, lineHeight, fontRegular, fontBold, color } = opciones;

  lineas.forEach((linea, indiceLinea) => {
    let cursorX = x;
    const lineaY = y + indiceLinea * lineHeight;

    linea.forEach((campo, indiceCampo) => {
      if (indiceCampo > 0) cursorX += gap;

      const etiqueta = `${campo.nombre}: `;
      doc.font(fontBold).fontSize(fontSize).fillColor(color);
      doc.text(etiqueta, cursorX, lineaY, { lineBreak: false });
      cursorX += doc.widthOfString(etiqueta);

      doc.font(fontRegular).fontSize(fontSize).fillColor(color);
      doc.text(campo.valorTexto, cursorX, lineaY, { lineBreak: false });
      cursorX += doc.widthOfString(campo.valorTexto);
    });
  });
}
