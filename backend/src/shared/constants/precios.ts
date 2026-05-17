export const TIPOS_PRECIO_LISTA = ['VENTA', 'COMPRA'] as const;

export type TipoPrecioLista = (typeof TIPOS_PRECIO_LISTA)[number];