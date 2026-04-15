import Handlebars from 'handlebars';

export type PlantillaEmpresa = {
  nombre?: string | null;
  rfc?: string | null;
  direccion?: string | null;
};

export type PlantillaCliente = {
  nombre?: string | null;
  rfc?: string | null;
};

export type PlantillaDocumento = {
  folio?: string | null;
  fecha?: string | Date | null;
  tipo_documento?: string | null;
  total?: number | null;
  subtotal?: number | null;
};

export type PlantillaPartida = {
  descripcion?: string | null;
  cantidad?: number | null;
  precio?: number | null;
  importe?: number | null;
};

export type PlantillaData = {
  empresa?: PlantillaEmpresa;
  cliente?: PlantillaCliente;
  documento?: PlantillaDocumento;
  partidas?: PlantillaPartida[];
};

let helpersRegistrados = false;

const registerHelpers = () => {
  if (helpersRegistrados) return;

  Handlebars.registerHelper('currency', (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? Number(value) : Number(value ?? 0);
    if (!Number.isFinite(num)) return '$0.00';
    return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  });

  Handlebars.registerHelper('date', (value: string | Date | null | undefined) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX');
  });

  helpersRegistrados = true;
};

export function renderPlantillaHTML(contenido_html: string, data: PlantillaData): string {
  registerHelpers();
  const template = Handlebars.compile(contenido_html);
  return template(data);
}

/*
Ejemplo de uso (mock):

const mockData: PlantillaData = {
  empresa: {
    nombre: 'Emphasys S.A. de C.V.',
    rfc: 'EMP010203AA1',
    direccion: 'Av. Principal 123, CDMX',
  },
  cliente: {
    nombre: 'Cliente Demo',
    rfc: 'CLI990101BB2',
  },
  documento: {
    folio: 'FAC-1001',
    fecha: '2026-04-11',
    tipo_documento: 'factura',
    total: 1450.5,
    subtotal: 1250,
  },
  partidas: [
    { descripcion: 'Servicio A', cantidad: 1, precio: 500, importe: 500 },
    { descripcion: 'Producto B', cantidad: 2, precio: 375.25, importe: 750.5 },
  ],
};

const mockTemplate = `
  <h1>{{empresa.nombre}}</h1>
  <p>Cliente: {{cliente.nombre}} ({{cliente.rfc}})</p>
  <p>Folio: {{documento.folio}} | Fecha: {{date documento.fecha}}</p>
  <p>Subtotal: {{currency documento.subtotal}} | Total: {{currency documento.total}}</p>
  <ul>
    {{#each partidas}}
      <li>{{descripcion}} - {{cantidad}} - {{currency precio}} - {{currency importe}}</li>
    {{/each}}
  </ul>
`;

const resultado = renderPlantillaHTML(mockTemplate, mockData);

Resultado esperado (extracto):
- Incluye el nombre de empresa y cliente
- Renderiza partidas con #each
- Muestra moneda con helper currency y fecha con helper date
*/
