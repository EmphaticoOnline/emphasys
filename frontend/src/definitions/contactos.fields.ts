export type DefinicionCampo = {
  campo: string;
  etiqueta: string;
};

export const CONTACTOS_CAMPOS: DefinicionCampo[] = [
  { campo: "nombre",             etiqueta: "Empresa / Razón social" },
  { campo: "nombre_contacto",    etiqueta: "Contacto (persona)" },
  { campo: "email",              etiqueta: "Email" },
  { campo: "telefono",           etiqueta: "Teléfono" },
  { campo: "telefono_secundario",etiqueta: "Teléfono secundario" },
  { campo: "clasificacion",      etiqueta: "Clasificación" },
  { campo: "origen_contacto",    etiqueta: "Origen de contacto" },
  { campo: "vendedor_id",        etiqueta: "Vendedor" },
  { campo: "precio_lista_id",    etiqueta: "Lista de precios" },
  { campo: "interes_inicial",    etiqueta: "Interés inicial" },
  { campo: "observaciones",      etiqueta: "Observaciones" },
  { campo: "calle",              etiqueta: "Calle" },
  { campo: "numero_exterior",    etiqueta: "Número exterior" },
  { campo: "numero_interior",    etiqueta: "Número interior" },
  { campo: "colonia",            etiqueta: "Colonia" },
  { campo: "ciudad",             etiqueta: "Ciudad" },
  { campo: "estado",             etiqueta: "Estado" },
  { campo: "cp",                 etiqueta: "Código postal" },
  { campo: "pais",               etiqueta: "País" },
  { campo: "cp_sat",             etiqueta: "Código postal SAT" },
  { campo: "colonia_sat",        etiqueta: "Colonia SAT" },
  { campo: "rfc_fiscal",         etiqueta: "RFC" },
  { campo: "regimen_fiscal",     etiqueta: "Régimen fiscal" },
  { campo: "uso_cfdi",           etiqueta: "Uso CFDI" },
  { campo: "forma_pago",         etiqueta: "Forma de pago" },
  { campo: "metodo_pago",        etiqueta: "Método de pago" },
];
